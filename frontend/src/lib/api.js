import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Bir hata oluştu. Lütfen tekrar deneyin.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const CURRENCY_SYMBOLS = { TRY: "₺", USD: "$", EUR: "€" };

export const LOGO_HORIZONTAL = "https://customer-assets-lqy194kg.emergentagent.net/job_rhisos-crm/artifacts/y5h1i0t3_rhisos2.webp";
export const LOGO_EMBLEM = "https://customer-assets-lqy194kg.emergentagent.net/job_rhisos-crm/artifacts/4rpi5rbm_rhisos.webp";

export function fmtMoney(amount, currency = "TRY") {
  const sym = CURRENCY_SYMBOLS[currency] || "";
  const n = Number(amount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${n}`;
}

export default api;
