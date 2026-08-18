from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import io
from datetime import date
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import secrets
import uuid
import re
import ipaddress
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

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

class SettingsIn(BaseModel):
    company_name: str = "Rhisos Mobilya"
    tagline: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    tax_office: str = ""
    tax_number: str = ""
    logo: str = ""  # base64 data URL

class PaymentIn(BaseModel):
    amount: float
    date: str
    method: str = "cash"
    note: Optional[str] = ""

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

# ---------------- Email (Emergent managed Resend) ----------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Rhisos Mobilya")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str, reply_to: str = None):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logging.getLogger(__name__).error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="E-posta gönderilemedi")
    except Exception as e:
        logging.getLogger(__name__).error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="E-posta gönderilemedi")

def _fmt_try(amount, currency="TRY"):
    sym = {"TRY": "₺", "USD": "$", "EUR": "€"}.get(currency, "")
    return f"{sym}{float(amount or 0):,.2f}"

def build_quote_email_html(doc: dict, settings_doc: dict) -> str:
    company = escape(settings_doc.get("company_name") or EMAIL_FROM_NAME)
    cur = doc.get("currency", "TRY")
    rows = ""
    for it in doc.get("items", []):
        line = it.get("quantity", 0) * it.get("unit_price", 0)
        rows += (
            f'<tr>'
            f'<td style="padding:8px 6px;border-bottom:1px solid #eee">{escape(str(it.get("description","")))}</td>'
            f'<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">{escape(str(it.get("quantity",0)))}</td>'
            f'<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">{escape(_fmt_try(it.get("unit_price",0),cur))}</td>'
            f'<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">%{escape(str(it.get("vat_rate",0)))}</td>'
            f'<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">{escape(_fmt_try(line,cur))}</td>'
            f'</tr>'
        )
    paid = doc.get("paid_total", 0)
    remaining = doc.get("grand_total", 0) - paid
    contact_bits = []
    if settings_doc.get("phone"):
        contact_bits.append(f"Tel: {escape(settings_doc['phone'])}")
    if settings_doc.get("email"):
        contact_bits.append(escape(settings_doc["email"]))
    if settings_doc.get("address"):
        contact_bits.append(escape(settings_doc["address"]))
    contact = " &nbsp;•&nbsp; ".join(contact_bits)
    return (
        f'<table role="presentation" width="100%" style="background:#FDFBF7;padding:24px 0"><tr><td align="center">'
        f'<table role="presentation" width="600" style="background:#ffffff;border:1px solid #E8E5E1;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1F1A17">'
        f'<tr><td style="background:#4A3B32;color:#ffffff;padding:20px 28px">'
        f'<div style="font-size:22px;font-weight:bold">{company}</div>'
        f'<div style="font-size:13px;color:#e9e2da">Teklif Belgesi</div></td></tr>'
        f'<tr><td style="padding:24px 28px">'
        f'<p style="margin:0 0 4px">Sayın <strong>{escape(str(doc.get("customer_name","")))}</strong>,</p>'
        f'<p style="margin:0 0 16px;color:#6B615A">Aşağıda <strong>{escape(str(doc.get("quote_number","")))}</strong> numaralı teklifimizin detaylarını bulabilirsiniz.</p>'
        f'<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">'
        f'<tr style="color:#6B615A;text-align:left">'
        f'<th style="padding:8px 6px;border-bottom:2px solid #4A3B32">Açıklama</th>'
        f'<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Adet</th>'
        f'<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Birim</th>'
        f'<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">KDV</th>'
        f'<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Tutar</th></tr>'
        f'{rows}</table>'
        f'<table role="presentation" width="100%" style="margin-top:16px;font-size:14px">'
        f'<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">Ara Toplam</td><td style="text-align:right;padding:2px 6px;width:140px">{escape(_fmt_try(doc.get("subtotal",0),cur))}</td></tr>'
        f'<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">İskonto</td><td style="text-align:right;padding:2px 6px">-{escape(_fmt_try(doc.get("discount",0),cur))}</td></tr>'
        f'<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">KDV</td><td style="text-align:right;padding:2px 6px">{escape(_fmt_try(doc.get("vat_total",0),cur))}</td></tr>'
        f'<tr><td style="text-align:right;font-weight:bold;font-size:16px;padding:6px 6px;border-top:1px solid #E8E5E1">Genel Toplam</td><td style="text-align:right;font-weight:bold;font-size:16px;padding:6px 6px;border-top:1px solid #E8E5E1">{escape(_fmt_try(doc.get("grand_total",0),cur))}</td></tr>'
        f'<tr><td style="text-align:right;color:#3A5A40;padding:2px 6px">Ödenen</td><td style="text-align:right;color:#3A5A40;padding:2px 6px">{escape(_fmt_try(paid,cur))}</td></tr>'
        f'<tr><td style="text-align:right;color:#9C3D38;padding:2px 6px">Kalan Bakiye</td><td style="text-align:right;color:#9C3D38;padding:2px 6px">{escape(_fmt_try(remaining,cur))}</td></tr>'
        f'</table>'
        + (f'<p style="margin:16px 0 0;color:#6B615A;font-size:13px">{escape(str(doc.get("notes","")))}</p>' if doc.get("notes") else "")
        + f'</td></tr>'
        f'<tr><td style="padding:16px 28px;background:#FDFBF7;color:#6B615A;font-size:12px;border-top:1px solid #E8E5E1">'
        f'{contact}<br/>Bu e-posta {company} tarafından gönderilmiştir. Şifre veya kart bilgisi asla e-posta ile istenmez.</td></tr>'
        f'</table></td></tr></table>'
    )

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

@api_router.get("/customers/{cid}/history")
async def customer_history(cid: str, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"_id": ObjectId(cid)})
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    customer["id"] = str(customer.pop("_id"))
    quotes = await db.quotes.find({"customer_id": cid}).sort("created_at", -1).to_list(1000)
    quote_ids = []
    for q in quotes:
        q["id"] = str(q.pop("_id"))
        quote_ids.append(q["id"])
    payments = []
    for q in quotes:
        for p in q.get("payments", []):
            payments.append({**p, "quote_id": q["id"], "quote_number": q.get("quote_number"), "currency": q.get("currency", "TRY")})
    payments.sort(key=lambda x: x.get("date", ""), reverse=True)
    total_quoted = round(sum(q.get("grand_total", 0) for q in quotes), 2)
    total_approved = round(sum(q.get("grand_total", 0) for q in quotes if q.get("status") == "approved"), 2)
    total_paid = round(sum(p["amount"] for p in payments), 2)
    return {
        "customer": customer,
        "quotes": quotes,
        "payments": payments,
        "totals": {
            "total_quoted": total_quoted,
            "total_approved": total_approved,
            "total_paid": total_paid,
            "quote_count": len(quotes),
        },
    }

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
        "payments": [],
        "paid_total": 0,
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
    updated = await db.quotes.find_one({"_id": ObjectId(qid)})
    updated["id"] = str(updated.pop("_id"))
    return updated

@api_router.post("/quotes/{qid}/payments")
async def add_quote_payment(qid: str, body: PaymentIn, user: dict = Depends(get_current_user)):
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Geçerli bir tutar girin")
    pid = str(uuid.uuid4())
    payment = {"id": pid, "amount": round(body.amount, 2), "date": body.date, "method": body.method, "note": body.note or ""}
    payments = doc.get("payments", []) + [payment]
    paid_total = round(sum(p["amount"] for p in payments), 2)
    await db.quotes.update_one({"_id": ObjectId(qid)}, {"$set": {"payments": payments, "paid_total": paid_total}})
    # linked income transaction so cash flow reflects real money in
    await db.transactions.insert_one({
        "type": "income",
        "amount": payment["amount"],
        "category": "Kapora / Teklif Ödemesi",
        "payment_method": body.method,
        "description": f"{doc['quote_number']} - {doc['customer_name']} ödemesi",
        "date": body.date,
        "currency": doc.get("currency", "TRY"),
        "quote_id": qid,
        "payment_id": pid,
        "auto": True,
        "created_at": now_iso(),
    })
    updated = await db.quotes.find_one({"_id": ObjectId(qid)})
    updated["id"] = str(updated.pop("_id"))
    return updated

@api_router.delete("/quotes/{qid}/payments/{pid}")
async def delete_quote_payment(qid: str, pid: str, user: dict = Depends(get_current_user)):
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    payments = [p for p in doc.get("payments", []) if p.get("id") != pid]
    paid_total = round(sum(p["amount"] for p in payments), 2)
    await db.quotes.update_one({"_id": ObjectId(qid)}, {"$set": {"payments": payments, "paid_total": paid_total}})
    await db.transactions.delete_one({"payment_id": pid})
    updated = await db.quotes.find_one({"_id": ObjectId(qid)})
    updated["id"] = str(updated.pop("_id"))
    return updated

@api_router.post("/quotes/{qid}/email")
async def email_quote(qid: str, user: dict = Depends(get_current_user)):
    doc = await db.quotes.find_one({"_id": ObjectId(qid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    customer = None
    try:
        customer = await db.customers.find_one({"_id": ObjectId(doc["customer_id"])})
    except Exception:
        customer = None
    to_email = (customer or {}).get("email", "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Müşterinin kayıtlı e-posta adresi yok. Önce müşteriye e-posta ekleyin.")
    settings_doc = await db.settings.find_one({"key": "company"}) or {}
    subject = f"{EMAIL_FROM_NAME} - Teklif {doc['quote_number']}"
    html = build_quote_email_html(doc, settings_doc)
    email_id = await send_email(to=to_email, subject=subject, html=html)
    await db.quotes.update_one({"_id": ObjectId(qid)}, {"$set": {"emailed_at": now_iso(), "emailed_to": to_email}})
    return {"ok": True, "email_id": email_id, "to": to_email}

@api_router.delete("/quotes/{qid}")
async def delete_quote(qid: str, user: dict = Depends(get_current_user)):
    await db.quotes.delete_one({"_id": ObjectId(qid)})
    await db.transactions.delete_many({"quote_id": qid, "auto": True})
    return {"ok": True}

# ---------------- Transaction Routes ----------------
@api_router.get("/transactions/export")
async def export_transactions(
    type: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    q = {}
    if type:
        q["type"] = type
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    docs = await db.transactions.find(q).sort("date", 1).to_list(5000)

    type_tr = {"income": "Gelir", "expense": "Gider"}
    pay_tr = {"cash": "Nakit", "bank": "Banka/Havale", "card": "Kredi Kartı", "check": "Çek/Senet"}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Kasa Raporu"
    headers = ["Tarih", "Tür", "Kategori", "Ödeme Yöntemi", "Açıklama", "Tutar", "Para Birimi"]
    ws.append(headers)
    header_fill = PatternFill(start_color="4A3B32", end_color="4A3B32", fill_type="solid")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    total_income = 0.0
    total_expense = 0.0
    for d in docs:
        amt = d.get("amount", 0)
        if d.get("type") == "income":
            total_income += amt
        else:
            total_expense += amt
        ws.append([
            d.get("date", ""),
            type_tr.get(d.get("type"), d.get("type")),
            d.get("category", ""),
            pay_tr.get(d.get("payment_method"), d.get("payment_method", "")),
            d.get("description", ""),
            amt,
            d.get("currency", "TRY"),
        ])

    ws.append([])
    ws.append(["", "", "", "", "Toplam Gelir", round(total_income, 2), ""])
    ws.append(["", "", "", "", "Toplam Gider", round(total_expense, 2), ""])
    ws.append(["", "", "", "", "Net Bakiye", round(total_income - total_expense, 2), ""])
    for row in ws.iter_rows(min_row=ws.max_row - 2, max_row=ws.max_row):
        row[4].font = Font(bold=True)
        row[5].font = Font(bold=True)

    widths = [14, 10, 20, 16, 40, 14, 12]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=rhisos_kasa_raporu.xlsx"},
    )

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

# ---------------- Settings ----------------
DEFAULT_SETTINGS = {
    "company_name": "Rhisos Mobilya", "tagline": "", "address": "", "phone": "",
    "email": "", "website": "", "tax_office": "", "tax_number": "", "logo": "",
}

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "company"})
    if not doc:
        return DEFAULT_SETTINGS
    doc.pop("_id", None)
    doc.pop("key", None)
    return {**DEFAULT_SETTINGS, **doc}

@api_router.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"key": "company"}, {"$set": {**body.model_dump(), "key": "company"}}, upsert=True)
    return body.model_dump()

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
    expiring = []
    today = datetime.now(timezone.utc).date()
    soon = today + timedelta(days=7)
    for q in quotes:
        st = q.get("status", "pending")
        quote_counts[st] = quote_counts.get(st, 0) + 1
        vu = q.get("valid_until")
        if st == "pending" and vu:
            try:
                vu_date = date.fromisoformat(vu)
            except (ValueError, TypeError):
                continue
            if vu_date <= soon:
                expiring.append({
                    "id": str(q["_id"]),
                    "quote_number": q.get("quote_number"),
                    "customer_name": q.get("customer_name"),
                    "valid_until": vu,
                    "days_left": (vu_date - today).days,
                    "grand_total": q.get("grand_total", 0),
                    "currency": q.get("currency", "TRY"),
                })
    expiring.sort(key=lambda x: x["days_left"])

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
        "expiring_quotes": expiring,
    }

@api_router.get("/dashboard/monthly-profit")
async def monthly_profit(month: str, user: dict = Depends(get_current_user)):
    # month format YYYY-MM
    txns = await db.transactions.find({"date": {"$gte": f"{month}-01", "$lte": f"{month}-31"}}).to_list(5000)
    income = round(sum(t["amount"] for t in txns if t["type"] == "income"), 2)
    expense = round(sum(t["amount"] for t in txns if t["type"] == "expense"), 2)
    return {"month": month, "income": income, "expense": expense, "profit": round(income - expense, 2)}

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
