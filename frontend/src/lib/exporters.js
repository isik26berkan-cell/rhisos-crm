import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { fmtNum, fmtTL, fmtDate } from "@/lib/format";
import { PAYMENT_TYPES } from "@/lib/calculations";

export async function exportPlanPDF(elementId, filename = "ev-plani.pdf") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pw) / canvas.width;
  let heightLeft = imgH;
  let pos = 0;
  pdf.addImage(img, "PNG", 0, pos, pw, imgH);
  heightLeft -= ph;
  while (heightLeft > 0) {
    pos -= ph;
    pdf.addPage();
    pdf.addImage(img, "PNG", 0, pos, pw, imgH);
    heightLeft -= ph;
  }
  pdf.save(filename);
}

export function exportPlanExcel(rows, filename = "ev-plani.xlsx") {
  const data = rows.map((r) => ({
    Dönem: r.period,
    Tarih: fmtDate(r.date),
    "Aylık Ödeme": fmtNum(r.amount),
    "Toplam Ödeme": r.cumulative === null ? "-" : fmtNum(r.cumulative),
    "Kalan Borç": fmtNum(r.remaining),
    "Ödeme Türü": r.paymentType,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 26 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ödeme Planı");
  XLSX.writeFile(wb, filename);
}

export { fmtTL, PAYMENT_TYPES };
