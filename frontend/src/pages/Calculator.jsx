import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSettings } from "@/context/SettingsContext";
import { buildPlan, calculateEarliestDeliveryDate, calculateDeliveryTarget, addMonths } from "@/lib/calculations";
import { resolveInput } from "@/lib/resolve";
import { parseNum, fmtTL, fmtMonthYear } from "@/lib/format";
import { loadPlans, upsertPlan, deletePlan } from "@/lib/storage";
import { exportPlanPDF, exportPlanExcel } from "@/lib/exporters";
import { PlanForm } from "@/components/calculator/PlanForm";
import { SummaryCards } from "@/components/calculator/SummaryCards";
import { PaymentTable } from "@/components/calculator/PaymentTable";
import { ScenarioCompare } from "@/components/calculator/ScenarioCompare";
import {
  Save,
  FolderOpen,
  GitCompare,
  FileDown,
  FileSpreadsheet,
  Settings,
  Home,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Trash2,
} from "lucide-react";

const makeDefaultPlan = (settings) => {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const d = addMonths(today, 10);
  return {
    id: crypto.randomUUID(),
    name: "",
    financingAmount: 2000000,
    downPayment: 300000,
    startDate: iso,
    deliveryMonth: d.getMonth(),
    deliveryYear: d.getFullYear(),
    paymentDay: settings.defaultPaymentDay,
    termMonths: 36,
    customTerm: false,
    calcMode: "delivery",
    preMode: "auto",
    preMonthly: 60000,
    postMode: "auto",
    postMonthly: 50000,
    monthlyBudget: 50000,
    tiers: [],
    edits: {},
    additional: {},
  };
};

export default function Calculator() {
  const { settings } = useSettings();
  const [plan, setPlan] = useState(() => makeDefaultPlan(settings));
  const [savedPlans, setSavedPlans] = useState(loadPlans());
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const update = (patch) => setPlan((p) => ({ ...p, ...patch }));

  const { rows, summary, errors } = useMemo(
    () => buildPlan(resolveInput(plan, settings), settings),
    [plan, settings]
  );

  const onEditAmount = (period, valStr) => {
    const val = parseNum(valStr);
    setPlan((p) => ({ ...p, edits: { ...p.edits, [period]: val } }));
  };
  const onAddExtra = (period, val) => {
    setPlan((p) => ({ ...p, additional: { ...p.additional, [period]: val } }));
  };

  // Manuel taksit yeterlilik kontrolü
  const startDate = new Date(`${plan.startDate}T00:00:00`);
  const target = calculateDeliveryTarget(plan.financingAmount, settings.deliveryTargetRate);
  const manualMode = plan.calcMode === "budget" || plan.preMode === "manual";
  const checkPay = plan.calcMode === "budget" ? plan.monthlyBudget : plan.preMonthly;
  const est = calculateEarliestDeliveryDate(startDate, plan.downPayment, target, checkPay);

  const handleSave = () => {
    const named = {
      ...plan,
      id: crypto.randomUUID(),
      name: saveName || "İsimsiz Plan",
      updatedAt: Date.now(),
    };
    setSavedPlans(upsertPlan(named));
    setPlan(named);
    setSaveOpen(false);
    setSaveName("");
    toast.success("Plan kaydedildi", { description: named.name });
  };

  const loadPlan = (p) => {
    setPlan({ ...p });
    setListOpen(false);
    toast.success("Plan yüklendi", { description: p.name });
  };
  const copyPlan = (p) => {
    const copy = { ...p, id: crypto.randomUUID(), name: `${p.name} (kopya)` };
    setSavedPlans(upsertPlan(copy));
    toast.success("Plan kopyalandı");
  };
  const removePlan = (id) => {
    setSavedPlans(deletePlan(id));
    toast.success("Plan silindi");
  };

  const handlePDF = async () => {
    toast.info("PDF oluşturuluyor...");
    await exportPlanPDF("printable-plan", `${plan.name || "ev-plani"}.pdf`);
  };
  const handleExcel = () => {
    exportPlanExcel(rows, `${plan.name || "ev-plani"}.xlsx`);
    toast.success("Excel indirildi");
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      {/* Header */}
      <header className="border-b border-zinc-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Home size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-semibold tracking-tight leading-none">
                Ev Planı Hesaplama
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5 hidden sm:block">
                Size özel ödeme planınızı oluşturun
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} data-testid="btn-kaydet" className="rounded-xl">
              <Save size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Kaydet</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSavedPlans(loadPlans()); setListOpen(true); }} data-testid="btn-planlarim" className="rounded-xl">
              <FolderOpen size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Planlarım</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSavedPlans(loadPlans()); setCompareOpen(true); }} data-testid="btn-karsilastir" className="rounded-xl">
              <GitCompare size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Karşılaştır</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} data-testid="btn-pdf" className="rounded-xl">
              <FileDown size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExcel} data-testid="btn-excel" className="rounded-xl">
              <FileSpreadsheet size={15} className="sm:mr-1.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon" data-testid="btn-settings" className="rounded-xl">
                <Settings size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
            Ödeme Planınızı Oluşturun
          </h2>
          <p className="text-zinc-500 mt-2 max-w-2xl">
            Peşinatınıza, teslim tarihinize ve aylık bütçenize göre size özel ödeme
            planınızı oluşturun.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sol kolon */}
          <div className="lg:col-span-4">
            <PlanForm plan={plan} update={update} summary={summary} />
          </div>

          {/* Sağ kolon */}
          <div className="lg:col-span-8 space-y-6" id="printable-plan">
            {errors.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-1" data-testid="error-box">
                {errors.map((e, i) => (
                  <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={15} /> {e}
                  </p>
                ))}
              </div>
            )}

            {errors.length === 0 && (
              <>
                {/* Bütçe modu sonucu */}
                {plan.calcMode === "budget" && est && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4" data-testid="budget-result">
                    <p className="text-sm text-sky-800 font-medium">
                      Bu ödeme planıyla %{summary.deliveryTargetRate} hedefi{" "}
                      <span className="font-semibold">{fmtMonthYear(summary.deliveryDate)}</span>{" "}
                      tarihinde karşılanmaktadır.
                    </p>
                  </div>
                )}

                {/* Manuel yeterlilik uyarıları */}
                {manualMode && !summary.downCoversDelivery && (
                  summary.deliveryMet ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="manual-ok">
                      <p className="text-sm text-emerald-800 font-medium flex items-center gap-2">
                        <CheckCircle2 size={16} /> Seçtiğiniz ödeme planı teslim şartını karşılıyor.
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Teslimde toplam: {fmtTL(summary.deliveryCumulative)} · Gerekli minimum:{" "}
                        {fmtTL(summary.deliveryTargetAmount)} · Fazla:{" "}
                        {fmtTL(Math.max(0, summary.deliveryCumulative - summary.deliveryTargetAmount))}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4" data-testid="manual-fail">
                      <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                        <AlertTriangle size={16} /> Seçtiğiniz aylık ödeme ile{" "}
                        {fmtMonthYear(summary.deliveryDate)} tesliminde %
                        {summary.deliveryTargetRate} ödeme şartına ulaşılamıyor.
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Gerekli minimum aylık ödeme: {fmtTL(summary.minimumMonthly)}
                        {est && est.months > 0 &&
                          ` · Bu ödeme tutarıyla en erken teslim: ${fmtMonthYear(
                            addMonths(startDate, est.months)
                          )}`}
                      </p>
                    </div>
                  )
                )}

                <SummaryCards summary={summary} />
                <PaymentTable rows={rows} onEditAmount={onEditAmount} onAddExtra={onAddExtra} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Kaydet Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Planı Kaydet</DialogTitle>
          </DialogHeader>
          <Input
            data-testid="input-plan-name"
            placeholder="Örn: 2M - Mart 2027 Teslim"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="rounded-xl h-11"
          />
          <DialogFooter>
            <Button onClick={handleSave} data-testid="btn-save-confirm" className="rounded-xl bg-zinc-900 w-full">
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Planlarım Dialog */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Kayıtlı Planlarım</DialogTitle>
          </DialogHeader>
          {savedPlans.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Henüz kayıtlı plan yok.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedPlans.map((p) => (
                <div key={p.id} className="flex items-center justify-between border border-zinc-200 rounded-xl p-3" data-testid={`saved-plan-${p.id}`}>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-zinc-400">{fmtTL(p.financingAmount)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadPlan(p)} className="rounded-lg h-8 text-xs">Aç</Button>
                    <Button size="icon" variant="ghost" onClick={() => copyPlan(p)} className="h-8 w-8"><Copy size={15} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removePlan(p.id)} className="h-8 w-8 text-red-500"><Trash2 size={15} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScenarioCompare
        open={compareOpen}
        onOpenChange={setCompareOpen}
        savedPlans={savedPlans}
        settings={settings}
      />
    </div>
  );
}
