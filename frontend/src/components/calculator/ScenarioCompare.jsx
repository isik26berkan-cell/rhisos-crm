import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { buildPlan } from "@/lib/calculations";
import { resolveInput } from "@/lib/resolve";
import { fmtTL, fmtPct, fmtMonthYear } from "@/lib/format";
import { useState } from "react";

const ROWS = [
  { key: "financingAmount", label: "Finansman Tutarı", fmt: fmtTL },
  { key: "downPayment", label: "Peşinat", fmt: fmtTL },
  { key: "downPaymentRate", label: "Peşinat Oranı", fmt: (v) => fmtPct(v) },
  { key: "organizationFee", label: "Organizasyon Bedeli", fmt: fmtTL },
  { key: "deliveryDate", label: "Teslim Tarihi", fmt: fmtMonthYear },
  { key: "preDeliveryMonths", label: "Teslime Kadar Ay", fmt: (v) => `${v} ay` },
  { key: "minimumMonthly", label: "Min. Aylık Ödeme", fmt: fmtTL, best: "min" },
  { key: "deliveryCumulative", label: "Teslimde Ödenmiş", fmt: fmtTL },
  { key: "teslimSonrasiKalan", label: "Teslim Sonrası Kalan", fmt: fmtTL, best: "min" },
  { key: "termMonths", label: "Toplam Vade", fmt: (v) => `${v} ay` },
];

export function ScenarioCompare({ open, onOpenChange, savedPlans, settings }) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev
    );
  };

  const chosen = savedPlans.filter((p) => selected.includes(p.id));
  const computed = chosen.map((p) => ({
    name: p.name,
    summary: buildPlan(resolveInput(p, settings), settings).summary,
  }));

  const bestFor = (row) => {
    if (!row.best || computed.length < 2) return null;
    const vals = computed.map((c) => c.summary[row.key]);
    return Math.min(...vals);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Senaryo Karşılaştırma</DialogTitle>
        </DialogHeader>

        {savedPlans.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">
            Karşılaştırmak için önce plan kaydedin.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {savedPlans.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 text-sm border border-zinc-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-zinc-50"
                  data-testid={`compare-select-${p.id}`}
                >
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-400">En fazla 4 plan seçebilirsiniz.</p>

            {computed.length > 0 && (
              <div className="overflow-x-auto mt-2" data-testid="compare-grid">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-zinc-400 font-medium"></th>
                      {computed.map((c, i) => (
                        <th key={i} className="text-left p-2 font-heading font-semibold">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => {
                      const best = bestFor(row);
                      return (
                        <tr key={row.key} className="border-t border-zinc-100">
                          <td className="p-2 text-zinc-500">{row.label}</td>
                          {computed.map((c, i) => {
                            const v = c.summary[row.key];
                            const isBest = best !== null && v === best;
                            return (
                              <td
                                key={i}
                                className={`p-2 tabular-nums ${
                                  isBest
                                    ? "text-emerald-600 font-semibold bg-emerald-50 rounded-lg"
                                    : "text-zinc-800"
                                }`}
                              >
                                {row.fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
