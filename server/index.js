const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");

const { pool, initDb, nowIso, newId } = require("./db");
const {
  DEFAULT_SETTINGS, customerDict, transactionDict, quoteDict, settingsDict, computeTotals, round2,
} = require("./helpers");
const { sendEmail, buildQuoteEmailHtml, EMAIL_FROM_NAME } = require("./email");

const SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());

const api = express.Router();

// ---------- helpers ----------
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  const status = e.status || 500;
  if (status >= 500) console.error(e);
  res.status(status).json({ detail: e.detail || e.message || "Sunucu hatası" });
});
function httpErr(status, detail) { const e = new Error(detail); e.status = status; e.detail = detail; return e; }

function setAuthCookies(res, access, refresh) {
  const base = { httpOnly: true, secure: true, sameSite: "none", path: "/" };
  res.cookie("access_token", access, { ...base, maxAge: 3600 * 1000 });
  res.cookie("refresh_token", refresh, { ...base, maxAge: 7 * 24 * 3600 * 1000 });
}
const makeAccess = (id, email) => jwt.sign({ sub: id, email, type: "access" }, SECRET, { expiresIn: "60m" });
const makeRefresh = (id) => jwt.sign({ sub: id, type: "refresh" }, SECRET, { expiresIn: "7d" });

async function requireAuth(req, res, next) {
  let token = req.cookies && req.cookies.access_token;
  if (!token) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) token = h.slice(7);
  }
  if (!token) return res.status(401).json({ detail: "Oturum açılmadı" });
  try {
    const p = jwt.verify(token, SECRET);
    if (p.type !== "access") return res.status(401).json({ detail: "Geçersiz token tipi" });
    const [rows] = await pool.query("SELECT id,email,name,role,created_at FROM users WHERE id=?", [p.sub]);
    if (!rows.length) return res.status(401).json({ detail: "Kullanıcı bulunamadı" });
    req.user = rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ detail: "Geçersiz veya süresi dolmuş oturum" });
  }
}

async function loadItems(qid) {
  const [r] = await pool.query("SELECT * FROM quote_items WHERE quote_id=? ORDER BY position", [qid]);
  return r;
}
async function loadPayments(qid) {
  const [r] = await pool.query("SELECT * FROM payments WHERE quote_id=? ORDER BY date", [qid]);
  return r;
}
async function getQuoteRow(qid) {
  const [r] = await pool.query("SELECT * FROM quotes WHERE id=?", [qid]);
  return r[0] || null;
}

// ---------- Health ----------
api.get("/health", wrap(async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const [t] = await pool.query("SHOW TABLES");
    const tables = t.map((row) => Object.values(row)[0]).sort();
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    let adminExists = false;
    if (adminEmail) {
      const [a] = await pool.query("SELECT COUNT(*) c FROM users WHERE email=?", [adminEmail]);
      adminExists = a[0].c > 0;
    }
    res.json({ status: "ok", database: "connected", dialect: "mysql", tables, admin_exists: adminExists });
  } catch (e) {
    res.json({ status: "error", database: "unreachable", dialect: "mysql", detail: e.message });
  }
}));

// ---------- Auth ----------
api.post("/auth/register", wrap(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  const { password, name } = req.body;
  if (!email || !password) throw httpErr(422, "email ve password zorunlu");
  const [ex] = await pool.query("SELECT id FROM users WHERE email=?", [email]);
  if (ex.length) throw httpErr(400, "Bu email zaten kayıtlı");
  const id = newId();
  await pool.query("INSERT INTO users (id,email,password_hash,name,role,created_at) VALUES (?,?,?,?,?,?)",
    [id, email, bcrypt.hashSync(password, 10), name || "", "user", nowIso()]);
  setAuthCookies(res, makeAccess(id, email), makeRefresh(id));
  res.json({ id, email, name: name || "", role: "user" });
}));

api.post("/auth/login", wrap(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase();
  const password = req.body.password || "";
  const ident = `${req.ip || "unknown"}:${email}`;
  const [ar] = await pool.query("SELECT * FROM login_attempts WHERE identifier=?", [ident]);
  const att = ar[0];
  if (att && att.count >= 5 && att.locked_until && new Date(att.locked_until) > new Date()) {
    throw httpErr(429, "Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.");
  }
  const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const locked = new Date(Date.now() + 15 * 60000).toISOString();
    if (att) await pool.query("UPDATE login_attempts SET count=count+1, locked_until=? WHERE identifier=?", [locked, ident]);
    else await pool.query("INSERT INTO login_attempts (identifier,count,locked_until) VALUES (?,?,?)", [ident, 1, locked]);
    throw httpErr(401, "Email veya şifre hatalı");
  }
  if (att) await pool.query("DELETE FROM login_attempts WHERE identifier=?", [ident]);
  setAuthCookies(res, makeAccess(user.id, email), makeRefresh(user.id));
  res.json({ id: user.id, email, name: user.name, role: user.role || "user" });
}));

api.post("/auth/logout", requireAuth, wrap(async (req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.json({ ok: true });
}));

api.get("/auth/me", requireAuth, wrap(async (req, res) => res.json(req.user)));

api.post("/auth/refresh", wrap(async (req, res) => {
  const token = req.cookies && req.cookies.refresh_token;
  if (!token) throw httpErr(401, "Refresh token yok");
  try {
    const p = jwt.verify(token, SECRET);
    if (p.type !== "refresh") throw httpErr(401, "Geçersiz token");
    const [rows] = await pool.query("SELECT id,email FROM users WHERE id=?", [p.sub]);
    if (!rows.length) throw httpErr(401, "Kullanıcı bulunamadı");
    res.cookie("access_token", makeAccess(rows[0].id, rows[0].email),
      { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 3600 * 1000 });
    res.json({ ok: true });
  } catch (e) {
    if (e.status) throw e;
    throw httpErr(401, "Geçersiz token");
  }
}));

// ---------- Customers ----------
api.get("/customers", requireAuth, wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM customers ORDER BY created_at DESC");
  res.json(rows.map(customerDict));
}));

api.post("/customers", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  if (!b.name) throw httpErr(422, "name zorunlu");
  const id = newId();
  await pool.query("INSERT INTO customers (id,name,company,email,phone,address,notes,created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, b.name, b.company || "", b.email || "", b.phone || "", b.address || "", b.notes || "", nowIso()]);
  const [r] = await pool.query("SELECT * FROM customers WHERE id=?", [id]);
  res.json(customerDict(r[0]));
}));

api.get("/customers/:cid", requireAuth, wrap(async (req, res) => {
  const [r] = await pool.query("SELECT * FROM customers WHERE id=?", [req.params.cid]);
  if (!r.length) throw httpErr(404, "Müşteri bulunamadı");
  res.json(customerDict(r[0]));
}));

api.put("/customers/:cid", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const [ex] = await pool.query("SELECT id FROM customers WHERE id=?", [req.params.cid]);
  if (!ex.length) throw httpErr(404, "Müşteri bulunamadı");
  await pool.query("UPDATE customers SET name=?,company=?,email=?,phone=?,address=?,notes=? WHERE id=?",
    [b.name, b.company || "", b.email || "", b.phone || "", b.address || "", b.notes || "", req.params.cid]);
  const [r] = await pool.query("SELECT * FROM customers WHERE id=?", [req.params.cid]);
  res.json(customerDict(r[0]));
}));

api.delete("/customers/:cid", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM customers WHERE id=?", [req.params.cid]);
  res.json({ ok: true });
}));

api.get("/customers/:cid/history", requireAuth, wrap(async (req, res) => {
  const [cr] = await pool.query("SELECT * FROM customers WHERE id=?", [req.params.cid]);
  if (!cr.length) throw httpErr(404, "Müşteri bulunamadı");
  const [quotes] = await pool.query("SELECT * FROM quotes WHERE customer_id=? ORDER BY created_at DESC", [req.params.cid]);
  const quoteDicts = [];
  const payments = [];
  for (const q of quotes) {
    const items = await loadItems(q.id);
    const pays = await loadPayments(q.id);
    quoteDicts.push(quoteDict(q, items, pays));
    for (const p of pays) {
      payments.push({ id: p.id, amount: p.amount, date: p.date, method: p.method, note: p.note || "", quote_id: q.id, quote_number: q.quote_number, currency: q.currency });
    }
  }
  payments.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const totalQuoted = round2(quotes.reduce((s, q) => s + (q.grand_total || 0), 0));
  const totalApproved = round2(quotes.filter((q) => q.status === "approved").reduce((s, q) => s + (q.grand_total || 0), 0));
  const totalPaid = round2(payments.reduce((s, p) => s + p.amount, 0));
  res.json({
    customer: customerDict(cr[0]), quotes: quoteDicts, payments,
    totals: { total_quoted: totalQuoted, total_approved: totalApproved, total_paid: totalPaid, quote_count: quotes.length },
  });
}));

// ---------- Quotes ----------
async function nextQuoteNumber() {
  const [c] = await pool.query("SELECT COUNT(*) c FROM quotes");
  const n = c[0].c + 1;
  return `TKF-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}

api.get("/quotes", requireAuth, wrap(async (req, res) => {
  const [quotes] = await pool.query("SELECT * FROM quotes ORDER BY created_at DESC");
  const out = [];
  for (const q of quotes) out.push(quoteDict(q, await loadItems(q.id), await loadPayments(q.id)));
  res.json(out);
}));

api.get("/quotes/:qid", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  res.json(quoteDict(q, await loadItems(q.id), await loadPayments(q.id)));
}));

api.post("/quotes", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const items = b.items || [];
  const totals = computeTotals(items, b.discount || 0);
  const id = newId();
  await pool.query(
    "INSERT INTO quotes (id,quote_number,customer_id,customer_name,title,currency,notes,valid_until,status,subtotal,vat_total,discount,grand_total,paid_total,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, await nextQuoteNumber(), b.customer_id, b.customer_name, b.title || "Teklif", b.currency || "TRY", b.notes || "", b.valid_until || "", "pending",
      totals.subtotal, totals.vat_total, totals.discount, totals.grand_total, 0, nowIso(), req.user.name]);
  let pos = 0;
  for (const it of items) {
    await pool.query("INSERT INTO quote_items (id,quote_id,description,quantity,unit_price,vat_rate,position) VALUES (?,?,?,?,?,?,?)",
      [newId(), id, it.description || "", it.quantity || 0, it.unit_price || 0, it.vat_rate || 0, pos++]);
  }
  const q = await getQuoteRow(id);
  res.json(quoteDict(q, await loadItems(id), []));
}));

api.put("/quotes/:qid", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  const b = req.body;
  const items = b.items || [];
  const totals = computeTotals(items, b.discount || 0);
  await pool.query(
    "UPDATE quotes SET customer_id=?,customer_name=?,title=?,currency=?,notes=?,valid_until=?,subtotal=?,vat_total=?,discount=?,grand_total=? WHERE id=?",
    [b.customer_id, b.customer_name, b.title || "Teklif", b.currency || "TRY", b.notes || "", b.valid_until || "",
      totals.subtotal, totals.vat_total, totals.discount, totals.grand_total, q.id]);
  await pool.query("DELETE FROM quote_items WHERE quote_id=?", [q.id]);
  let pos = 0;
  for (const it of items) {
    await pool.query("INSERT INTO quote_items (id,quote_id,description,quantity,unit_price,vat_rate,position) VALUES (?,?,?,?,?,?,?)",
      [newId(), q.id, it.description || "", it.quantity || 0, it.unit_price || 0, it.vat_rate || 0, pos++]);
  }
  const q2 = await getQuoteRow(q.id);
  res.json(quoteDict(q2, await loadItems(q.id), await loadPayments(q.id)));
}));

api.patch("/quotes/:qid/status", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  const status = req.body.status;
  if (!["pending", "approved", "rejected"].includes(status)) throw httpErr(422, "Geçersiz durum");
  await pool.query("UPDATE quotes SET status=? WHERE id=?", [status, q.id]);
  const q2 = await getQuoteRow(q.id);
  res.json(quoteDict(q2, await loadItems(q.id), await loadPayments(q.id)));
}));

api.post("/quotes/:qid/payments", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) throw httpErr(400, "Geçerli bir tutar girin");
  const pid = newId();
  const method = req.body.method || "cash";
  await pool.query("INSERT INTO payments (id,quote_id,amount,date,method,note) VALUES (?,?,?,?,?,?)",
    [pid, q.id, round2(amount), req.body.date, method, req.body.note || ""]);
  const pays = await loadPayments(q.id);
  const paid = round2(pays.reduce((s, p) => s + p.amount, 0));
  await pool.query("UPDATE quotes SET paid_total=? WHERE id=?", [paid, q.id]);
  await pool.query(
    "INSERT INTO transactions (id,type,amount,category,payment_method,description,date,currency,quote_id,payment_id,auto,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [newId(), "income", round2(amount), "Kapora / Teklif Ödemesi", method, `${q.quote_number} - ${q.customer_name} ödemesi`, req.body.date, q.currency, q.id, pid, 1, nowIso()]);
  const q2 = await getQuoteRow(q.id);
  res.json(quoteDict(q2, await loadItems(q.id), await loadPayments(q.id)));
}));

api.delete("/quotes/:qid/payments/:pid", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  await pool.query("DELETE FROM payments WHERE id=?", [req.params.pid]);
  await pool.query("DELETE FROM transactions WHERE payment_id=?", [req.params.pid]);
  const pays = await loadPayments(q.id);
  const paid = round2(pays.reduce((s, p) => s + p.amount, 0));
  await pool.query("UPDATE quotes SET paid_total=? WHERE id=?", [paid, q.id]);
  const q2 = await getQuoteRow(q.id);
  res.json(quoteDict(q2, await loadItems(q.id), pays));
}));

api.post("/quotes/:qid/email", requireAuth, wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  const [cr] = await pool.query("SELECT * FROM customers WHERE id=?", [q.customer_id]);
  const toEmail = ((cr[0] && cr[0].email) || "").trim();
  if (!toEmail) throw httpErr(400, "Müşterinin kayıtlı e-posta adresi yok. Önce müşteriye e-posta ekleyin.");
  const [sr] = await pool.query("SELECT * FROM settings WHERE `key`='company'");
  const settings = sr.length ? settingsDict(sr[0]) : DEFAULT_SETTINGS;
  const doc = quoteDict(q, await loadItems(q.id), await loadPayments(q.id));
  const html = buildQuoteEmailHtml(doc, settings);
  const emailId = await sendEmail({ to: toEmail, subject: `${EMAIL_FROM_NAME} - Teklif ${q.quote_number}`, html });
  await pool.query("UPDATE quotes SET emailed_at=?, emailed_to=? WHERE id=?", [nowIso(), toEmail, q.id]);
  res.json({ ok: true, email_id: emailId, to: toEmail });
}));

api.delete("/quotes/:qid", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM quotes WHERE id=?", [req.params.qid]);
  res.json({ ok: true });
}));

// ---------- Public (no auth) ----------
api.get("/public/quotes/:qid", wrap(async (req, res) => {
  const q = await getQuoteRow(req.params.qid);
  if (!q) throw httpErr(404, "Teklif bulunamadı");
  const [sr] = await pool.query("SELECT * FROM settings WHERE `key`='company'");
  const company = Object.assign({}, DEFAULT_SETTINGS, sr.length ? settingsDict(sr[0]) : {});
  res.json({ quote: quoteDict(q, await loadItems(q.id), await loadPayments(q.id)), company });
}));

// ---------- Transactions ----------
api.get("/transactions/export", requireAuth, wrap(async (req, res) => {
  const { type, start, end } = req.query;
  let sql = "SELECT * FROM transactions WHERE 1=1";
  const args = [];
  if (type) { sql += " AND type=?"; args.push(type); }
  if (start) { sql += " AND date>=?"; args.push(start); }
  if (end) { sql += " AND date<=?"; args.push(end); }
  sql += " ORDER BY date";
  const [docs] = await pool.query(sql, args);
  const typeTr = { income: "Gelir", expense: "Gider" };
  const payTr = { cash: "Nakit", bank: "Banka/Havale", card: "Kredi Kartı", check: "Çek/Senet" };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kasa Raporu");
  ws.addRow(["Tarih", "Tür", "Kategori", "Ödeme Yöntemi", "Açıklama", "Tutar", "Para Birimi"]);
  ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A3B32" } }; c.alignment = { horizontal: "center" }; });
  let inc = 0, exp = 0;
  for (const d of docs) {
    if (d.type === "income") inc += d.amount; else exp += d.amount;
    ws.addRow([d.date, typeTr[d.type] || d.type, d.category, payTr[d.payment_method] || d.payment_method, d.description || "", d.amount, d.currency]);
  }
  ws.addRow([]);
  const r1 = ws.addRow(["", "", "", "", "Toplam Gelir", round2(inc), ""]);
  const r2 = ws.addRow(["", "", "", "", "Toplam Gider", round2(exp), ""]);
  const r3 = ws.addRow(["", "", "", "", "Net Bakiye", round2(inc - exp), ""]);
  [r1, r2, r3].forEach((r) => { r.getCell(5).font = { bold: true }; r.getCell(6).font = { bold: true }; });
  ws.columns = [{ width: 14 }, { width: 10 }, { width: 20 }, { width: 16 }, { width: 40 }, { width: 14 }, { width: 12 }];
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=rhisos_kasa_raporu.xlsx");
  await wb.xlsx.write(res);
  res.end();
}));

api.get("/transactions", requireAuth, wrap(async (req, res) => {
  const { type, start, end, category } = req.query;
  let sql = "SELECT * FROM transactions WHERE 1=1";
  const args = [];
  if (type) { sql += " AND type=?"; args.push(type); }
  if (category) { sql += " AND category=?"; args.push(category); }
  if (start) { sql += " AND date>=?"; args.push(start); }
  if (end) { sql += " AND date<=?"; args.push(end); }
  sql += " ORDER BY date DESC";
  const [rows] = await pool.query(sql, args);
  res.json(rows.map(transactionDict));
}));

api.post("/transactions", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const id = newId();
  await pool.query(
    "INSERT INTO transactions (id,type,amount,category,payment_method,description,date,currency,quote_id,payment_id,auto,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, b.type, b.amount, b.category, b.payment_method || "cash", b.description || "", b.date, b.currency || "TRY", b.quote_id || null, null, 0, nowIso()]);
  const [r] = await pool.query("SELECT * FROM transactions WHERE id=?", [id]);
  res.json(transactionDict(r[0]));
}));

api.put("/transactions/:tid", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const [ex] = await pool.query("SELECT id FROM transactions WHERE id=?", [req.params.tid]);
  if (!ex.length) throw httpErr(404, "Kayıt bulunamadı");
  await pool.query(
    "UPDATE transactions SET type=?,amount=?,category=?,payment_method=?,description=?,date=?,currency=?,quote_id=? WHERE id=?",
    [b.type, b.amount, b.category, b.payment_method || "cash", b.description || "", b.date, b.currency || "TRY", b.quote_id || null, req.params.tid]);
  const [r] = await pool.query("SELECT * FROM transactions WHERE id=?", [req.params.tid]);
  res.json(transactionDict(r[0]));
}));

api.delete("/transactions/:tid", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM transactions WHERE id=?", [req.params.tid]);
  res.json({ ok: true });
}));

// ---------- Dashboard ----------
api.get("/dashboard/stats", requireAuth, wrap(async (req, res) => {
  const [txns] = await pool.query("SELECT * FROM transactions");
  const totalIncome = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthly = {};
  for (const t of txns) {
    const m = (t.date || "").slice(0, 7);
    if (!m) continue;
    if (!monthly[m]) monthly[m] = { month: m, income: 0, expense: 0 };
    monthly[m][t.type] += t.amount;
  }
  const monthlyList = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const cat = {};
  for (const t of txns) if (t.type === "expense") cat[t.category] = (cat[t.category] || 0) + t.amount;
  const expenseByCat = Object.entries(cat).map(([name, value]) => ({ name, value: round2(value) }));
  const [quotes] = await pool.query("SELECT * FROM quotes");
  const quoteCounts = { pending: 0, approved: 0, rejected: 0 };
  const expiring = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
  for (const q of quotes) {
    const st = q.status || "pending";
    quoteCounts[st] = (quoteCounts[st] || 0) + 1;
    if (st === "pending" && q.valid_until) {
      const d = new Date(q.valid_until + "T00:00:00");
      if (!isNaN(d) && d <= soon) {
        const daysLeft = Math.round((d - today) / (24 * 3600 * 1000));
        expiring.push({ id: q.id, quote_number: q.quote_number, customer_name: q.customer_name, valid_until: q.valid_until, days_left: daysLeft, grand_total: q.grand_total || 0, currency: q.currency || "TRY" });
      }
    }
  }
  expiring.sort((a, b) => a.days_left - b.days_left);
  const [cc] = await pool.query("SELECT COUNT(*) c FROM customers");
  res.json({
    total_income: round2(totalIncome), total_expense: round2(totalExpense), balance: round2(totalIncome - totalExpense),
    monthly: monthlyList, expense_by_category: expenseByCat, quote_counts: quoteCounts,
    total_quotes: quotes.length, customer_count: cc[0].c, expiring_quotes: expiring,
  });
}));

api.get("/dashboard/monthly-profit", requireAuth, wrap(async (req, res) => {
  const month = req.query.month;
  const [txns] = await pool.query("SELECT * FROM transactions WHERE date>=? AND date<=?", [`${month}-01`, `${month}-31`]);
  const income = round2(txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
  const expense = round2(txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  res.json({ month, income, expense, profit: round2(income - expense) });
}));

// ---------- Settings ----------
api.get("/settings", requireAuth, wrap(async (req, res) => {
  const [r] = await pool.query("SELECT * FROM settings WHERE `key`='company'");
  res.json(r.length ? settingsDict(r[0]) : DEFAULT_SETTINGS);
}));

api.put("/settings", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  const vals = { ...DEFAULT_SETTINGS, ...b };
  const [r] = await pool.query("SELECT `key` FROM settings WHERE `key`='company'");
  if (r.length) {
    await pool.query(
      "UPDATE settings SET company_name=?,tagline=?,address=?,phone=?,email=?,website=?,tax_office=?,tax_number=?,logo=? WHERE `key`='company'",
      [vals.company_name, vals.tagline, vals.address, vals.phone, vals.email, vals.website, vals.tax_office, vals.tax_number, vals.logo]);
  } else {
    await pool.query(
      "INSERT INTO settings (`key`,company_name,tagline,address,phone,email,website,tax_office,tax_number,logo) VALUES ('company',?,?,?,?,?,?,?,?,?)",
      [vals.company_name, vals.tagline, vals.address, vals.phone, vals.email, vals.website, vals.tax_office, vals.tax_number, vals.logo]);
  }
  res.json({ company_name: vals.company_name, tagline: vals.tagline, address: vals.address, phone: vals.phone, email: vals.email, website: vals.website, tax_office: vals.tax_office, tax_number: vals.tax_number, logo: vals.logo });
}));

app.use("/api", api);

// ---------- Static frontend + SPA fallback (production) ----------
const buildDir = path.join(__dirname, "..", "frontend", "build");
app.use(express.static(buildDir));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ detail: "Not found" });
  res.sendFile(path.join(buildDir, "index.html"), (err) => {
    if (err) res.status(404).send("Frontend build bulunamadı. Önce 'npm run build' çalıştırın.");
  });
});

const PORT = process.env.PORT || 8001;
const HOST = process.env.HOST || "0.0.0.0";

initDb()
  .then(() => {
    app.listen(PORT, HOST, () => console.log(`Rhisos CRM (Express) çalışıyor: http://${HOST}:${PORT}`));
  })
  .catch((e) => {
    console.error("DB init hatası:", e.message);
    // yine de ayağa kalk ki /api/health teşhis dönebilsin
    app.listen(PORT, HOST, () => console.log(`Express başlatıldı (DB init hatası): ${PORT}`));
  });

module.exports = app;
