// Plan paylaşımı: planı kısa anahtarlarla minimize edip LZ-string ile
// URL-güvenli, kısa bir koda sıkıştırır. Eski (base64) kodlarla da uyumludur.
import LZString from "lz-string";

const KEY_MAP = {
  financingAmount: "f",
  downPayment: "d",
  startDate: "s",
  paymentDay: "pd",
  termMonths: "t",
  customTerm: "ct",
  monthlyPayment: "mp",
  postMode: "om",
  postMonthly: "omv",
  tiers: "ti",
  edits: "e",
  additional: "a",
  name: "n",
};
const REV_MAP = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

const isEmpty = (v) =>
  v == null ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

function compact(plan) {
  const out = {};
  for (const [key, short] of Object.entries(KEY_MAP)) {
    const val = plan[key];
    if (val === undefined) continue;
    if (["tiers", "edits", "additional"].includes(key) && isEmpty(val)) continue;
    out[short] = val;
  }
  return out;
}

function expand(obj) {
  const plan = {
    tiers: [],
    edits: {},
    additional: {},
    customTerm: false,
    name: "",
    monthlyPayment: 0,
    postMode: "auto",
    postMonthly: 0,
  };
  for (const [short, val] of Object.entries(obj)) {
    const key = REV_MAP[short];
    if (key) plan[key] = val;
  }
  return { ...plan, id: crypto.randomUUID() };
}

export function encodePlan(plan) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(compact(plan)));
}

export function decodePlan(code) {
  // Yeni format: LZ-string
  try {
    const json = LZString.decompressFromEncodedURIComponent(code);
    if (json) {
      const obj = JSON.parse(json);
      if (obj && typeof obj === "object") return expand(obj);
    }
  } catch {
    /* eski formata düş */
  }
  // Eski format: unicode-güvenli base64
  try {
    const json = decodeURIComponent(escape(atob(code)));
    const plan = JSON.parse(json);
    return { ...plan, id: crypto.randomUUID() };
  } catch {
    return null;
  }
}

export function buildShareUrl(plan) {
  return `${window.location.origin}/?p=${encodePlan(plan)}`;
}
