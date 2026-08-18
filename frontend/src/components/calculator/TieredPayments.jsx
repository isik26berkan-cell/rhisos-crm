import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Layers } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";

export function TieredPayments({ tiers, update }) {
  const add = () => {
    const last = tiers[tiers.length - 1];
    const start = last ? last.endMonth + 1 : 1;
    update({
      tiers: [...tiers, { startMonth: start, endMonth: start + 5, amount: 50000 }],
    });
  };

  const change = (idx, key, val) => {
    const next = tiers.map((t, i) => (i === idx ? { ...t, [key]: val } : t));
    update({ tiers: next });
  };

  const remove = (idx) => update({ tiers: tiers.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 font-medium flex items-center gap-2">
          <Layers size={14} className="text-zinc-400" /> Kademeli Ödeme Planı
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          data-testid="btn-add-tier"
          className="rounded-lg h-8 text-xs"
        >
          <Plus size={14} className="mr-1" /> Kademe Ekle
        </Button>
      </div>

      {tiers.length === 0 && (
        <p className="text-xs text-zinc-400">
          Farklı dönemler için farklı aylık ödeme tanımlayabilirsiniz.
        </p>
      )}

      {tiers.map((t, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-end bg-zinc-50 rounded-xl p-3"
          data-testid={`tier-row-${idx}`}
        >
          <div>
            <span className="text-[10px] text-zinc-400 block mb-1">Baş. Ay</span>
            <Input
              type="number"
              min="1"
              value={t.startMonth}
              onChange={(e) => change(idx, "startMonth", parseInt(e.target.value) || 1)}
              className="h-9 rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block mb-1">Bitiş Ay</span>
            <Input
              type="number"
              min="1"
              value={t.endMonth}
              onChange={(e) => change(idx, "endMonth", parseInt(e.target.value) || 1)}
              className="h-9 rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block mb-1">Aylık</span>
            <CurrencyInput
              value={t.amount}
              onChange={(v) => change(idx, "amount", v)}
              className="h-9 rounded-lg bg-white text-sm pr-10"
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => remove(idx)}
            data-testid={`btn-remove-tier-${idx}`}
            className="h-9 w-9 text-zinc-400 hover:text-red-500"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
    </div>
  );
}
