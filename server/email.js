const axios = require("axios");

const EMAIL_BASE_URL = "https://integrations.emergentagent.com";
const EMAIL_KEY = process.env.EMERGENT_EMAIL_KEY || "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Rhisos Mobilya";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || null;

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly"];
const CRED_ASK = [
  "reply with your password", "send your password", "cvv", "seed phrase", "recovery phrase",
  "social security number", "confirm your card number", "your full card number", "confirm your bank details",
];

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtMoney(a, cur = "TRY") {
  const sym = { TRY: "₺", USD: "$", EUR: "€" }[cur] || "";
  return sym + Number(a || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function assertSafeEmail(subject, html) {
  if (/<\s*(form|input|textarea|select)\b/i.test(html)) throw new Error("No forms in email (G2)");
  const body = (subject + "\n" + html).toLowerCase();
  for (const a of CRED_ASK) if (body.includes(a)) throw new Error("Email asks for credentials (G2)");
  const urls = [...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const u of urls) {
    const low = u.trim().toLowerCase();
    if (low.startsWith("mailto:") || low.startsWith("tel:") || low.startsWith("cid:") || low.startsWith("#")) continue;
    if (!low.startsWith("https://")) throw new Error("Email links must be https (G3)");
    let host = "";
    try { host = new URL(low).hostname; } catch (e) { throw new Error("Bad URL in email (G3)"); }
    if (!host || SHORTENERS.some((s) => host === s || host.endsWith("." + s))) throw new Error("Shortened/bad host (G3)");
  }
}

async function sendEmail({ to, subject, html }) {
  assertSafeEmail(subject, html);
  const payload = { to: [to], subject, html, from_name: EMAIL_FROM_NAME };
  if (EMAIL_REPLY_TO) payload.contact_email = EMAIL_REPLY_TO;
  try {
    const r = await axios.post(`${EMAIL_BASE_URL}/api/v1/email/send`, payload, {
      headers: { "X-Email-Key": EMAIL_KEY }, timeout: 30000,
    });
    return r.data && r.data.id;
  } catch (e) {
    console.error("Email send error:", e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
    const status = e.response ? 502 : 500;
    const err = new Error("E-posta gönderilemedi");
    err.status = status;
    throw err;
  }
}

function buildQuoteEmailHtml(doc, s) {
  const company = escapeHtml(s.company_name || EMAIL_FROM_NAME);
  const cur = doc.currency || "TRY";
  let rows = "";
  for (const it of doc.items || []) {
    const line = (it.quantity || 0) * (it.unit_price || 0);
    rows +=
      `<tr>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #eee">${escapeHtml(it.description)}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(it.quantity)}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(fmtMoney(it.unit_price, cur))}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">%${escapeHtml(it.vat_rate)}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(fmtMoney(line, cur))}</td>` +
      `</tr>`;
  }
  const paid = doc.paid_total || 0;
  const remaining = (doc.grand_total || 0) - paid;
  const bits = [];
  if (s.phone) bits.push("Tel: " + escapeHtml(s.phone));
  if (s.email) bits.push(escapeHtml(s.email));
  if (s.address) bits.push(escapeHtml(s.address));
  const contact = bits.join(" &nbsp;•&nbsp; ");
  return (
    `<table role="presentation" width="100%" style="background:#FDFBF7;padding:24px 0"><tr><td align="center">` +
    `<table role="presentation" width="600" style="background:#ffffff;border:1px solid #E8E5E1;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1F1A17">` +
    `<tr><td style="background:#4A3B32;color:#ffffff;padding:20px 28px">` +
    `<div style="font-size:22px;font-weight:bold">${company}</div>` +
    `<div style="font-size:13px;color:#e9e2da">Teklif Belgesi</div></td></tr>` +
    `<tr><td style="padding:24px 28px">` +
    `<p style="margin:0 0 4px">Sayın <strong>${escapeHtml(doc.customer_name)}</strong>,</p>` +
    `<p style="margin:0 0 16px;color:#6B615A">Aşağıda <strong>${escapeHtml(doc.quote_number)}</strong> numaralı teklifimizin detaylarını bulabilirsiniz.</p>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">` +
    `<tr style="color:#6B615A;text-align:left">` +
    `<th style="padding:8px 6px;border-bottom:2px solid #4A3B32">Açıklama</th>` +
    `<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Adet</th>` +
    `<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Birim</th>` +
    `<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">KDV</th>` +
    `<th style="padding:8px 6px;border-bottom:2px solid #4A3B32;text-align:right">Tutar</th></tr>` +
    `${rows}</table>` +
    `<table role="presentation" width="100%" style="margin-top:16px;font-size:14px">` +
    `<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">Ara Toplam</td><td style="text-align:right;padding:2px 6px;width:140px">${escapeHtml(fmtMoney(doc.subtotal, cur))}</td></tr>` +
    `<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">İskonto</td><td style="text-align:right;padding:2px 6px">-${escapeHtml(fmtMoney(doc.discount, cur))}</td></tr>` +
    `<tr><td style="text-align:right;color:#6B615A;padding:2px 6px">KDV</td><td style="text-align:right;padding:2px 6px">${escapeHtml(fmtMoney(doc.vat_total, cur))}</td></tr>` +
    `<tr><td style="text-align:right;font-weight:bold;font-size:16px;padding:6px 6px;border-top:1px solid #E8E5E1">Genel Toplam</td><td style="text-align:right;font-weight:bold;font-size:16px;padding:6px 6px;border-top:1px solid #E8E5E1">${escapeHtml(fmtMoney(doc.grand_total, cur))}</td></tr>` +
    `<tr><td style="text-align:right;color:#3A5A40;padding:2px 6px">Ödenen</td><td style="text-align:right;color:#3A5A40;padding:2px 6px">${escapeHtml(fmtMoney(paid, cur))}</td></tr>` +
    `<tr><td style="text-align:right;color:#9C3D38;padding:2px 6px">Kalan Bakiye</td><td style="text-align:right;color:#9C3D38;padding:2px 6px">${escapeHtml(fmtMoney(remaining, cur))}</td></tr>` +
    `</table>` +
    (doc.notes ? `<p style="margin:16px 0 0;color:#6B615A;font-size:13px">${escapeHtml(doc.notes)}</p>` : "") +
    `</td></tr>` +
    `<tr><td style="padding:16px 28px;background:#FDFBF7;color:#6B615A;font-size:12px;border-top:1px solid #E8E5E1">` +
    `${contact}<br/>Bu e-posta ${company} tarafından gönderilmiştir. Şifre veya kart bilgisi asla e-posta ile istenmez.</td></tr>` +
    `</table></td></tr></table>`
  );
}

module.exports = { sendEmail, buildQuoteEmailHtml, EMAIL_FROM_NAME };
