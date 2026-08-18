const PLANS_KEY = "evplan_saved_plans";
const SETTINGS_KEY = "evplan_settings";

export const DEFAULT_SETTINGS = {
  organizationRate: 0.07,
  deliveryTargetRate: 0.45,
  defaultPaymentDay: 20,
  currency: "TRY",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadPlans() {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePlans(plans) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function upsertPlan(plan) {
  const plans = loadPlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  savePlans(plans);
  return plans;
}

export function deletePlan(id) {
  const plans = loadPlans().filter((p) => p.id !== id);
  savePlans(plans);
  return plans;
}
