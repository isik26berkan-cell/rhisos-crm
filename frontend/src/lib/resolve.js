import {
  calculateDeliveryTarget,
  calculateEarliestDeliveryDate,
} from "@/lib/calculations";

export function resolveInput(plan, settings) {
  const startDate = new Date(`${plan.startDate}T00:00:00`);
  let deliveryDate = new Date(plan.deliveryYear, plan.deliveryMonth, 1);
  let preMode = plan.preMode;
  let preMonthly = plan.preMonthly;

  if (plan.calcMode === "budget") {
    const target = calculateDeliveryTarget(
      plan.financingAmount,
      settings.deliveryTargetRate
    );
    const est = calculateEarliestDeliveryDate(
      startDate,
      plan.downPayment,
      target,
      plan.monthlyBudget
    );
    const months = est ? Math.max(est.months, 1) : 1;
    deliveryDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + months,
      1
    );
    preMode = "manual";
    preMonthly = plan.monthlyBudget;
  }

  return {
    financingAmount: plan.financingAmount,
    downPayment: plan.downPayment,
    startDate,
    deliveryDate,
    paymentDay: plan.paymentDay,
    termMonths: plan.termMonths,
    preMode,
    preMonthly,
    postMode: plan.postMode,
    postMonthly: plan.postMonthly,
    tiers: plan.tiers,
    edits: plan.edits,
    additional: plan.additional,
  };
}
