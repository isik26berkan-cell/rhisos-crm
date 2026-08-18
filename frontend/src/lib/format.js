import { format } from "date-fns";
import { tr } from "date-fns/locale";

export const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
};

export const fmtTL = (n) => `${fmtNum(n)} TL`;

export const fmtPct = (n, d = 2) => {
  if (n === null || n === undefined || isNaN(n)) return "%0";
  return `%${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  }).format(n)}`;
};

export const fmtDate = (date) => format(date, "d MMM yyyy", { locale: tr });

export const fmtMonthYear = (date) =>
  format(date, "MMMM yyyy", { locale: tr });

export const parseNum = (str) => {
  const digits = String(str ?? "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};
