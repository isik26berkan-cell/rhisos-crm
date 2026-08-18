import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fmtPct } from "@/lib/format";
import { TieredPayments } from "./TieredPayments";
import { ChevronDown, Settings2, Info } from "lucide-react";
import { useState } from "react";

const TERMS = [12, 18, 24, 30, 36, 48, 60, 72];

const FieldLabel = ({ children }) => (
  <Label className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 font-medium">
    {children}
  </Label>
);

export function PlanForm({ plan, update, summary }) {
  const [advanced, setAdvanced] = useState(false);
  const pesinatError = plan.downPayment > plan.financingAmount;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Plan Bilgileri
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Bilgileri değiştirdikçe plan anında güncellenir.
        </p>
      </div>

      {/* Finansman Tutarı */}
      <div className="space-y-2">
        <FieldLabel>Finansman Tutarı</FieldLabel>
        <CurrencyInput
          data-testid="input-finansman-tutari"
          value={plan.financingAmount}
          onChange={(v) => update({ financingAmount: v })}
        />
      </div>

      {/* Proje Peşinatı */}
      <div className="space-y-2">
        <FieldLabel>Proje Peşinatı</FieldLabel>
        <CurrencyInput
          data-testid="input-pesinat"
          value={plan.downPayment}
          onChange={(v) => update({ downPayment: v })}
        />
        {pesinatError ? (
          <p className="text-sm text-red-500 font-medium" data-testid="pesinat-error">
            Peşinat finansman tutarından yüksek olamaz.
          </p>
        ) : (
          <p className="text-sm text-zinc-500" data-testid="pesinat-orani-text">
            Peşinat oranınız:{" "}
            <span className="font-semibold text-zinc-800">
              {fmtPct(summary.downPaymentRate)}
            </span>
          </p>
        )}
      </div>

      {/* Aylık Ödeme (teslim öncesi tasarruf taksiti) */}
      <div className="space-y-2">
        <FieldLabel>Aylık Ödeme (Teslim Öncesi)</FieldLabel>
        <CurrencyInput
          data-testid="input-monthly-payment"
          value={plan.monthlyPayment}
          onChange={(v) => update({ monthlyPayment: v })}
        />
        <p className="text-xs text-zinc-400 flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          Teslim en erken {summary.minDeliveryMonths}. ayda olur ve ancak finansmanın
          %{summary.deliveryTargetRate}'i ödendiğinde gerçekleşir.
        </p>
      </div>

      {/* Başlangıç Tarihi */}
      <div className="space-y-2">
        <FieldLabel>Plan Başlangıç Tarihi</FieldLabel>
        <Input
          type="date"
          data-testid="input-start-date"
          value={plan.startDate}
          onChange={(e) => update({ startDate: e.target.value })}
          className="bg-zinc-50 border-zinc-200 rounded-xl h-11 focus-visible:ring-zinc-900"
        />
      </div>

      {/* Toplam Vade */}
      <div className="space-y-2">
        <FieldLabel>Toplam Vade</FieldLabel>
        <Select
          value={plan.customTerm ? "custom" : String(plan.termMonths)}
          onValueChange={(v) => {
            if (v === "custom") update({ customTerm: true });
            else update({ customTerm: false, termMonths: parseInt(v) });
          }}
        >
          <SelectTrigger data-testid="select-term" className="bg-zinc-50 border-zinc-200 rounded-xl h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERMS.map((t) => (
              <SelectItem key={t} value={String(t)}>{t} Ay</SelectItem>
            ))}
            <SelectItem value="custom">Özel Vade</SelectItem>
          </SelectContent>
        </Select>
        {plan.customTerm && (
          <Input
            type="number"
            min="1"
            data-testid="input-custom-term"
            value={plan.termMonths}
            onChange={(e) => update({ termMonths: parseInt(e.target.value) || 1 })}
            placeholder="Ay sayısı"
            className="bg-zinc-50 border-zinc-200 rounded-xl h-11 mt-2 focus-visible:ring-zinc-900"
          />
        )}
      </div>

      {/* Gelişmiş Ayarlar */}
      <Collapsible open={advanced} onOpenChange={setAdvanced}>
        <CollapsibleTrigger
          data-testid="toggle-advanced"
          className="flex items-center justify-between w-full text-sm font-medium text-zinc-700 py-2 border-t border-zinc-100 pt-4"
        >
          <span className="flex items-center gap-2">
            <Settings2 size={15} className="text-zinc-400" /> Gelişmiş Ayarlar
          </span>
          <ChevronDown
            size={16}
            className={`transition-transform ${advanced ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4">
          {/* Ödeme Günü */}
          <div className="space-y-2">
            <FieldLabel>Ödeme Günü</FieldLabel>
            <Select
              value={String(plan.paymentDay)}
              onValueChange={(v) => update({ paymentDay: parseInt(v) })}
            >
              <SelectTrigger data-testid="select-payment-day" className="bg-zinc-50 border-zinc-200 rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Teslim Sonrası Ödeme */}
          <div className="space-y-2">
            <FieldLabel>Teslim Sonrası Ödeme</FieldLabel>
            <RadioGroup
              value={plan.postMode}
              onValueChange={(v) => update({ postMode: v })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="auto" data-testid="post-mode-auto" /> Otomatik
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="manual" data-testid="post-mode-manual" /> Manuel
              </label>
            </RadioGroup>
            {plan.postMode === "manual" && (
              <CurrencyInput
                data-testid="input-post-monthly"
                value={plan.postMonthly}
                onChange={(v) => update({ postMonthly: v })}
              />
            )}
          </div>

          {/* Kademeli Ödeme */}
          <TieredPayments tiers={plan.tiers} update={update} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
