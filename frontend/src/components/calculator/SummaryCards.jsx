import { fmtTL, fmtPct, fmtMonthYear } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import {
  Wallet,
  Percent,
  CalendarDays,
  Target,
  TrendingDown,
  Coins,
  Banknote,
  Timer,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

const Card = ({ label, value, sub, icon: Icon, accent, testid }) => (
  <motion.div
    layout
    className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-5 flex flex-col justify-between"
    data-testid={testid}
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 font-medium">
        {label}
      </span>
      {Icon && <Icon size={16} className="text-zinc-300" />}
    </div>
    <div
      className={`mt-3 font-heading text-xl sm:text-2xl font-semibold tracking-tight tabular-nums ${
        accent || "text-zinc-900"
      }`}
    >
      {value}
    </div>
    {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
  </motion.div>
);

export function SummaryCards({ summary }) {
  return (
    <div className="space-y-6">
      <ProgressBar summary={summary} />

      {summary.downCoversDelivery && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="down-covers-delivery-box"
        >
          <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Teslim için gerekli %45 ödeme şartı peşinatınız ile karşılanmıştır.
            Teslime kadar minimum zorunlu taksit: 0 TL.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          label="Finansman Tutarı"
          value={fmtTL(summary.financingAmount)}
          icon={Wallet}
          testid="summary-finansman"
        />
        <Card
          label="Organizasyon Bedeli"
          value={fmtTL(summary.organizationFee)}
          sub="Finansmana dahil değil"
          icon={Coins}
          testid="summary-organizasyon"
        />
        <Card
          label="Proje Peşinatı"
          value={fmtTL(summary.downPayment)}
          icon={Banknote}
          testid="summary-pesinat"
        />
        <Card
          label="Peşinat Oranı"
          value={fmtPct(summary.downPaymentRate)}
          icon={Percent}
          testid="summary-pesinat-orani"
        />
        <Card
          label="Teslim Tarihi"
          value={fmtMonthYear(summary.deliveryDate)}
          icon={CalendarDays}
          testid="summary-teslim-tarihi"
        />
        <Card
          label="Teslim Hedefi"
          value={fmtTL(summary.deliveryTargetAmount)}
          sub={`%${summary.deliveryTargetRate} şartı`}
          icon={Target}
          accent="text-[#FF5A5F]"
          testid="summary-teslim-hedefi"
        />
        <Card
          label="Teslime Kadar Kalan"
          value={fmtTL(summary.requiredPreDelivery)}
          sub={`${summary.preDeliveryMonths} ödeme dönemi`}
          icon={Timer}
          testid="summary-teslime-kadar"
        />
        <Card
          label="Minimum Aylık Ödeme"
          value={fmtTL(summary.minimumMonthly)}
          icon={TrendingDown}
          accent="text-zinc-900"
          testid="summary-aylik-taksit"
        />
        <Card
          label="Teslim Sonrası Kalan"
          value={fmtTL(summary.teslimSonrasiKalan)}
          sub={`${summary.postDeliveryMonths} ay · Vade ${summary.termMonths} ay`}
          icon={TrendingDown}
          testid="summary-teslim-sonrasi"
        />
      </div>
    </div>
  );
}
