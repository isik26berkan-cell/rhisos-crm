from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import secrets

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# ---------------- Helpers ----------------
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

PyObjectId = Annotated[str, BeforeValidator(str)]

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Oturum açılmadı")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token tipi")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class CustomerIn(BaseModel):
    name: str
    company: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""

class LineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    vat_rate: float = 20  # KDV %

class QuoteIn(BaseModel):
    customer_id: str
    customer_name: str
    title: str = "Teklif"
    items: List[LineItem]
    currency: str = "TRY"
    notes: Optional[str] = ""
    valid_until: Optional[str] = ""
    discount: float = 0

class QuoteStatusIn(BaseModel):
    status: Literal["pending", "approved", "rejected"]

class TransactionIn(BaseModel):
    type: Literal["income", "expense"]
    amount: float
    category: str
    payment_method: str = "cash"
    description: Optional[str] = ""
    date: str
    currency: str = "TRY"
    quote_id: Optional[str] = None

# ---------------- Quote calc ----------------
def compute_quote_totals(items, discount=0):
    subtotal = 0.0
    vat_total = 0.0
    for it in items:
        line = it["quantity"] * it["unit_price"]
        subtotal += line
        vat_total += line * (it["vat_rate"] / 100.0)
    subtotal_after_disc = subtotal - discount
    # apply discount proportionally to vat? keep simple: vat on pre-discount
    grand_total = subtotal_after_disc + vat_total
    return {
        "subtotal": round(subtotal, 2),
        "vat_total": round(vat_total, 2),
        "discount": round(discount, 2),
        "grand_total": round(grand_total, 2),
    }

# ---------------- Auth Routes ----------------
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    doc = {"email": email, "password_hash": hash_password(body.password), "name": body.name, "role": "user", "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": body.name, "role": "user"}

@api_router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")
    await db.login_attempts.delete_one({"identifier": ident})
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": user.get("name"), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token yok")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Geçersiz token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

# ---------------- Customer Routes ----------------
@api_router.get("/customers")
async def list_customers(user: dict = Depends(get_current_user)):
    docs = await db.customers.find().sort("created_at", -1).to_list(1000)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs

@api_router.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    res = await db.customers.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user: dict = Depends(get_current_user)):
    await db.customers.update_one({"_id": ObjectId(cid)}, {"$set": body.model_dump()})
    doc = await db.customers.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    doc["id"] = str(doc.pop("_id"))
    return doc

@api_router.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(get_current_user)):
    await db.customers.delete_one({"_id": ObjectId(cid)})
    return {"ok": True}

# ---------------- Quote Routes ----------------
async def next_quote_number():
    count = await db.quotes.count_documents({})
    return f"TKF-{datetime.now().year}-{count + 1:04d}"

@api_router.get("/quotes")
async def list_quotes(user: dict = Depends(get_current_user)):
    docs = await db.quotes.find().sort("created_at", -1).to_list(1000)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs

@api_router.get("/quotes/{qid}")
async def get_quote(qid: str, user: dict = Depends(get_current_user)):
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    doc["id"] = str(doc.pop("_id"))
    return doc

@api_router.post("/quotes")
async def create_quote(body: QuoteIn, user: dict = Depends(get_current_user)):
    items = [i.model_dump() for i in body.items]
    totals = compute_quote_totals(items, body.discount)
    doc = {
        "quote_number": await next_quote_number(),
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "title": body.title,
        "items": items,
        "currency": body.currency,
        "notes": body.notes,
        "valid_until": body.valid_until,
        "status": "pending",
        **totals,
        "created_at": now_iso(),
        "created_by": user["name"],
    }
    res = await db.quotes.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.put("/quotes/{qid}")
async def update_quote(qid: str, body: QuoteIn, user: dict = Depends(get_current_user)):
    items = [i.model_dump() for i in body.items]
    totals = compute_quote_totals(items, body.discount)
    update = {
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "title": body.title,
        "items": items,
        "currency": body.currency,
        "notes": body.notes,
        "valid_until": body.valid_until,
        **totals,
    }
    await db.quotes.update_one({"_id": ObjectId(qid)}, {"$set": update})
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    doc["id"] = str(doc.pop("_id"))
    return doc

@api_router.patch("/quotes/{qid}/status")
async def update_quote_status(qid: str, body: QuoteStatusIn, user: dict = Depends(get_current_user)):
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    await db.quotes.update_one({"_id": ObjectId(qid)}, {"$set": {"status": body.status}})
    # Auto-create income when approved
    if body.status == "approved":
        existing = await db.transactions.find_one({"quote_id": qid, "auto": True})
        if not existing:
            await db.transactions.insert_one({
                "type": "income",
                "amount": doc["grand_total"],
                "category": "Teklif Geliri",
                "payment_method": "bank",
                "description": f"Onaylanan teklif {doc['quote_number']} - {doc['customer_name']}",
                "date": now_iso()[:10],
                "currency": doc.get("currency", "TRY"),
                "quote_id": qid,
                "auto": True,
                "created_at": now_iso(),
            })
    else:
        # remove auto income if status reverted from approved
        await db.transactions.delete_one({"quote_id": qid, "auto": True})
    updated = await db.quotes.find_one({"_id": ObjectId(qid)})
    updated["id"] = str(updated.pop("_id"))
    return updated

@api_router.delete("/quotes/{qid}")
async def delete_quote(qid: str, user: dict = Depends(get_current_user)):
    await db.quotes.delete_one({"_id": ObjectId(qid)})
    await db.transactions.delete_many({"quote_id": qid, "auto": True})
    return {"ok": True}

# ---------------- Transaction Routes ----------------
@api_router.get("/transactions")
async def list_transactions(
    type: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    category: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = {}
    if type:
        q["type"] = type
    if category:
        q["category"] = category
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    docs = await db.transactions.find(q).sort("date", -1).to_list(2000)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs

@api_router.post("/transactions")
async def create_transaction(body: TransactionIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["auto"] = False
    doc["created_at"] = now_iso()
    res = await db.transactions.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api_router.put("/transactions/{tid}")
async def update_transaction(tid: str, body: TransactionIn, user: dict = Depends(get_current_user)):
    await db.transactions.update_one({"_id": ObjectId(tid)}, {"$set": body.model_dump()})
    doc = await db.transactions.find_one({"_id": ObjectId(tid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    doc["id"] = str(doc.pop("_id"))
    return doc

@api_router.delete("/transactions/{tid}")
async def delete_transaction(tid: str, user: dict = Depends(get_current_user)):
    await db.transactions.delete_one({"_id": ObjectId(tid)})
    return {"ok": True}

# ---------------- Dashboard ----------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find().to_list(5000)
    total_income = sum(t["amount"] for t in txns if t["type"] == "income")
    total_expense = sum(t["amount"] for t in txns if t["type"] == "expense")

    # monthly aggregation last 6 months
    monthly = {}
    for t in txns:
        month = (t.get("date") or "")[:7]
        if not month:
            continue
        monthly.setdefault(month, {"month": month, "income": 0, "expense": 0})
        monthly[month][t["type"]] += t["amount"]
    monthly_list = sorted(monthly.values(), key=lambda x: x["month"])[-6:]

    # expense by category
    cat = {}
    for t in txns:
        if t["type"] == "expense":
            cat[t["category"]] = cat.get(t["category"], 0) + t["amount"]
    expense_by_cat = [{"name": k, "value": round(v, 2)} for k, v in cat.items()]

    quotes = await db.quotes.find().to_list(2000)
    quote_counts = {"pending": 0, "approved": 0, "rejected": 0}
    for q in quotes:
        quote_counts[q.get("status", "pending")] = quote_counts.get(q.get("status", "pending"), 0) + 1

    customer_count = await db.customers.count_documents({})

    return {
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "balance": round(total_income - total_expense, 2),
        "monthly": monthly_list,
        "expense_by_category": expense_by_cat,
        "quote_counts": quote_counts,
        "total_quotes": len(quotes),
        "customer_count": customer_count,
    }

# ---------------- App wiring ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Rhisos Admin", "role": "admin", "created_at": now_iso(),
        })
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
