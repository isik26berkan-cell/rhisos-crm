// Plan state (localStorage/paylaşım) -> buildPlan girdisi
export function resolveInput(plan) {
  return {
    financingAmount: plan.financingAmount,
    downPayment: plan.downPayment,
    startDate: new Date(`${plan.startDate}T00:00:00`),
    paymentDay: plan.paymentDay,
    termMonths: plan.termMonths,
    monthlyPayment: plan.monthlyPayment,
    postMode: plan.postMode,
    postMonthly: plan.postMonthly,
    tiers: plan.tiers,
    edits: plan.edits,
    additional: plan.additional,
  };
}
