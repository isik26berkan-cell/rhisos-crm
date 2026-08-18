import { fmtTL, fmtPct } from "@/lib/format";
import { motion } from "framer-motion";

export function ProgressBar({ summary }) {
  const { deliveryCumulative, deliveryTargetAmount, financingAmount, deliveryMet } =
    summary;
  const paidPct = financingAmount > 0 ? (deliveryCumulative / financingAmount) * 100 : 0;
  const targetPct = summary.deliveryTargetRate;
  const fillPct = Math.min(100, targetPct > 0 ? (paidPct / targetPct) * 100 : 0);
  const remainingToTarget = Math.max(0, deliveryTargetAmount - deliveryCumulative);

  const fillColor = deliveryMet
    ? "bg-emerald-500"
    : fillPct >= 66
    ? "bg-[#FF5A5F]"
    : "bg-amber-500";

  return (
    <div
      className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 sm:p-7"
      data-testid="teslim-hedefi-card"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-medium">
          Teslim İçin Gerekli Ödeme
        </h3>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            deliveryMet
              ? "bg-emerald-50 text-emerald-700"
              : "bg-[rgba(255,90,95,0.1)] text-[#FF5A5F]"
          }`}
        >
          {deliveryMet ? "Şart Karşılandı" : "Şart Bekliyor"}
        </span>
      </div>

      <div className="flex items-end justify-between mt-3 mb-3">
        <div className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight tabular-nums">
          {fmtTL(deliveryCumulative)}
          <span className="text-base text-zinc-400 font-normal">
            {" "}
            / {fmtTL(deliveryTargetAmount)}
          </span>
        </div>
        <div className="text-right text-sm text-zinc-500 tabular-nums">
          {fmtPct(paidPct)} / {fmtPct(targetPct)}
        </div>
      </div>

      <div className="relative h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${fillColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <p className="mt-3 text-sm text-zinc-500">
        {deliveryMet
          ? "Teslim tarihinde %45 ödeme şartı karşılanmaktadır."
          : `Hedefe ulaşmak için ${fmtTL(remainingToTarget)} daha ödemeniz gerekiyor.`}
      </p>
    </div>
  );
}
