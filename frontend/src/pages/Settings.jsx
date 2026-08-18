import { Link } from "react-router-dom";
import { useSettings } from "@/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const FieldLabel = ({ children }) => (
  <Label className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 font-medium">
    {children}
  </Label>
);

export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      <header className="border-b border-zinc-200/70 bg-white sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-xl" data-testid="btn-back">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <h1 className="font-heading text-lg font-semibold tracking-tight">Ayarlar</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 sm:p-8 space-y-7">
          <div className="space-y-2">
            <FieldLabel>Organizasyon Oranı (%)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              data-testid="setting-org-rate"
              value={String(Math.round(settings.organizationRate * 1000) / 10)}
              onChange={(e) =>
                update({ organizationRate: (parseFloat(e.target.value) || 0) / 100 })
              }
              className="bg-zinc-50 border-zinc-200 rounded-xl h-11 max-w-xs focus-visible:ring-zinc-900"
            />
            <p className="text-xs text-zinc-400">Varsayılan: %7</p>
          </div>

          <div className="space-y-2">
            <FieldLabel>Teslim Hedef Oranı (%)</FieldLabel>
            <Input
              type="number"
              step="1"
              data-testid="setting-delivery-rate"
              value={String(Math.round(settings.deliveryTargetRate * 1000) / 10)}
              onChange={(e) =>
                update({ deliveryTargetRate: (parseFloat(e.target.value) || 0) / 100 })
              }
              className="bg-zinc-50 border-zinc-200 rounded-xl h-11 max-w-xs focus-visible:ring-zinc-900"
            />
            <p className="text-xs text-zinc-400">Varsayılan: %45</p>
          </div>

          <div className="space-y-2">
            <FieldLabel>Varsayılan Ödeme Günü</FieldLabel>
            <Select
              value={String(settings.defaultPaymentDay)}
              onValueChange={(v) => update({ defaultPaymentDay: parseInt(v) })}
            >
              <SelectTrigger data-testid="setting-payment-day" className="bg-zinc-50 border-zinc-200 rounded-xl h-11 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel>Para Birimi</FieldLabel>
            <Select
              value={settings.currency}
              onValueChange={(v) => update({ currency: v })}
            >
              <SelectTrigger data-testid="setting-currency" className="bg-zinc-50 border-zinc-200 rounded-xl h-11 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRY">TRY - Türk Lirası</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                update(DEFAULT_SETTINGS);
                toast.success("Ayarlar sıfırlandı");
              }}
              data-testid="btn-reset-settings"
              className="rounded-xl"
            >
              <RotateCcw size={15} className="mr-1.5" /> Varsayılana Sıfırla
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
