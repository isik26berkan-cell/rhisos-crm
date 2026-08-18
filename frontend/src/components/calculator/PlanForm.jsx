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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fmtPct } from "@/lib/format";
import { TieredPayments } from "./TieredPayments";
import { ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const TERMS = [12, 18, 24, 30, 36, 48, 60, 72];

const FieldLabel = ({ children }) => (
  <Label className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 font-medium">
    {children}
  </Label>
);

export function PlanForm({ plan, update, summary }) {
  const [advanced, setAdvanced] = useState(false);
  const years = [];
  const nowY = new Date().getFullYear();
  for (let y = nowY; y <= nowY + 8; y++) years.push(y);

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

      {/* Hesaplama Modu */}
      <div className="space-y-2">
        <FieldLabel>Hesaplama Modu</FieldLabel>
        <Tabs value={plan.calcMode} onValueChange={(v) => update({ calcMode: v })}>
          <TabsList className="grid grid-cols-3 w-full bg-zinc-100 rounded-xl h-auto p-1">
            <TabsTrigger value="delivery" data-testid="mode-delivery" className="rounded-lg text-xs py-2 data-[state=active]:bg-white">
              Teslim Tarihine Göre
            </TabsTrigger>
            <TabsTrigger value="budget" data-testid="mode-budget" className="rounded-lg text-xs py-2 data-[state=active]:bg-white">
              Aylık Bütçeme Göre
            </TabsTrigger>
            <TabsTrigger value="scenario" data-testid="mode-scenario" className="rounded-lg text-xs py-2 data-[state=active]:bg-white">
              Peşinat + Teslim
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

      {/* Aylık Bütçe (budget mode) */}
      {plan.calcMode === "budget" && (
        <div className="space-y-2">
          <FieldLabel>Aylık Ödeyebileceğim Tutar</FieldLabel>
          <CurrencyInput
            data-testid="input-budget"
            value={plan.monthlyBudget}
            onChange={(v) => update({ monthlyBudget: v })}
          />
        </div>
      )}

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

      {/* Teslim Ayı (yalnızca bütçe modunda gizli) */}
      {plan.calcMode !== "budget" && (
        <div className="space-y-2">
          <FieldLabel>İstenen Teslim Tarihi</FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={String(plan.deliveryMonth)}
              onValueChange={(v) => update({ deliveryMonth: parseInt(v) })}
            >
              <SelectTrigger data-testid="select-delivery-month" className="bg-zinc-50 border-zinc-200 rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(plan.deliveryYear)}
              onValueChange={(v) => update({ deliveryYear: parseInt(v) })}
            >
              <SelectTrigger data-testid="select-delivery-year" className="bg-zinc-50 border-zinc-200 rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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

          {/* Teslim Öncesi Ödeme */}
          <div className="space-y-2">
            <FieldLabel>Teslim Öncesi Ödeme</FieldLabel>
            <RadioGroup
              value={plan.preMode}
              onValueChange={(v) => update({ preMode: v })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="auto" data-testid="pre-mode-auto" /> Otomatik
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="manual" data-testid="pre-mode-manual" /> Manuel
              </label>
            </RadioGroup>
            {plan.preMode === "manual" && (
              <CurrencyInput
                data-testid="input-pre-monthly"
                value={plan.preMonthly}
                onChange={(v) => update({ preMonthly: v })}
              />
            )}
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
