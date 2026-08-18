// Ev Planı Hesaplama - çekirdek hesaplama motoru (modüler fonksiyonlar)
// KURAL: Teslim ayı kullanıcı tarafından seçilmez. Teslim, en erken 6. ayda
// olabilir VE ancak toplam finansmanın %45'i o aya kadar ödenmişse gerçekleşir.
// %45 daha erken dolsa bile teslim en erken 6. aydır; 6. ayda dolmuyorsa
// %45'in dolduğu ilk ay teslim ayı olur.

export const MIN_DELIVERY_MONTHS = 6;

export const PAYMENT_TYPES = {
  ORG: "Organizasyon Ücreti Peşinat",
  DOWN: "Proje Peşinatı",
  PRE: "Tasarruf Taksiti",
  POST: "Finansman Taksiti",
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

export function monthDiff(start, end) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export function installmentDate(startDate, period, paymentDay) {
  return new Date(
    startDate.getFullYear(),
    startDate.getMonth() + period,
    clamp(paymentDay, 1, 28)
  );
}

// --- Adım fonksiyonları ---
export const calculateOrganizationFee = (financing, rate) => financing * rate;

export const calculateDownPaymentRatio = (down, financing) =>
  financing > 0 ? (down / financing) * 100 : 0;

export const calculateDeliveryTarget = (financing, rate) => financing * rate;

export const calculateRequiredPreDeliveryPayment = (target, down) =>
  Math.max(0, target - down);

// 6. ayda (en erken) teslim için gereken minimum aylık ödeme
export const calculateMinimumMonthlyPayment = (required) =>
  required / MIN_DELIVERY_MONTHS;

/**
 * Ana ödeme planı üretici. Teslim ayı otomatik hesaplanır.
 * input: {
 *   financingAmount, downPayment, startDate(Date), paymentDay, termMonths,
 *   monthlyPayment (teslim öncesi aylık ödeme),
 *   postMode('auto'|'manual'), postMonthly, tiers[], edits{}, additional{}
 * }
 * settings: { organizationRate, deliveryTargetRate }
 */
export function buildPlan(input, settings) {
  const {
    financingAmount,
    downPayment,
    startDate,
    paymentDay,
    termMonths,
    monthlyPayment,
    postMode,
    postMonthly,
    tiers = [],
    edits = {},
    additional = {},
  } = input;

  const orgRate = settings.organizationRate;
  const targetRate = settings.deliveryTargetRate;

  // --- Doğrulamalar ---
  const errors = [];
  if (!(financingAmount > 0))
    errors.push("Finansman tutarı 0'dan büyük olmalıdır.");
  if (downPayment < 0) errors.push("Peşinat negatif olamaz.");
  if (downPayment > financingAmount)
    errors.push("Peşinat finansman tutarından yüksek olamaz.");
  if (monthlyPayment < 0) errors.push("Aylık ödeme negatif olamaz.");

  const sorted = [...tiers].sort((a, b) => a.startMonth - b.startMonth);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMonth <= sorted[i - 1].endMonth) {
      errors.push("Kademeli ödeme dönemleri çakışmamalıdır.");
      break;
    }
  }

  const organizationFee = calculateOrganizationFee(financingAmount, orgRate);
  const downPaymentRate = calculateDownPaymentRatio(downPayment, financingAmount);
  const deliveryTargetAmount = calculateDeliveryTarget(financingAmount, targetRate);
  const requiredPreDelivery = calculateRequiredPreDeliveryPayment(
    deliveryTargetAmount,
    downPayment
  );
  const minimumMonthly = calculateMinimumMonthlyPayment(requiredPreDelivery);

  const findTier = (p) => sorted.find((t) => p >= t.startMonth && p <= t.endMonth);
  // teslim öncesi (tasarruf) aylık ödeme tutarı
  const prePay = (p) => {
    if (edits[p] !== undefined) return edits[p];
    const t = findTier(p);
    if (t) return t.amount;
    return monthlyPayment;
  };

  // --- Teslim ayını bul (en erken 6. ay + %45 kuralı) ---
  let deliveryPeriod = null; // N
  let searchCum = downPayment;
  if (financingAmount > 0) {
    if (downPayment >= deliveryTargetAmount - 0.5) {
      deliveryPeriod = MIN_DELIVERY_MONTHS;
    } else {
      for (let m = 1; m <= termMonths; m++) {
        searchCum += prePay(m) + (additional[m] || 0);
        if (searchCum >= deliveryTargetAmount - 0.5) {
          deliveryPeriod = Math.max(MIN_DELIVERY_MONTHS, m);
          break;
        }
      }
    }
  }
  const deliveryAchievable = deliveryPeriod !== null && deliveryPeriod <= termMonths;
  const N = deliveryAchievable ? deliveryPeriod : Infinity;
  const postCount = deliveryAchievable ? Math.max(0, termMonths - deliveryPeriod) : 0;

  // Teslim sonrası otomatik taksit için planlanan teslim öncesi toplam
  let preTotalPlanned = 0;
  if (deliveryAchievable) {
    for (let p = 1; p <= deliveryPeriod; p++) {
      preTotalPlanned += prePay(p);
    }
  }
  const teslimSonrasiKalanPlanned = Math.max(
    0,
    financingAmount - downPayment - preTotalPlanned
  );
  const postMonthlyAuto = postCount > 0 ? teslimSonrasiKalanPlanned / postCount : 0;

  const basePlanned = (p) => {
    if (p <= N) return prePay(p);
    return postMode === "manual" ? postMonthly : postMonthlyAuto;
  };

  const rows = [];
  let remaining = financingAmount;
  let cumulative = 0;

  if (errors.length === 0 && financingAmount > 0) {
    rows.push({
      period: "#",
      date: startDate,
      amount: organizationFee,
      baseAmount: organizationFee,
      additionalPayment: 0,
      cumulative: null,
      remaining,
      paymentType: PAYMENT_TYPES.ORG,
      isDeliveryMonth: false,
      editable: false,
    });

    remaining = Math.max(0, remaining - downPayment);
    cumulative += downPayment;
    rows.push({
      period: "#",
      date: startDate,
      amount: downPayment,
      baseAmount: downPayment,
      additionalPayment: 0,
      cumulative,
      remaining,
      paymentType: PAYMENT_TYPES.DOWN,
      isDeliveryMonth: false,
      editable: false,
    });

    for (let p = 1; p <= termMonths; p++) {
      if (remaining <= 0.5) break;
      const base = basePlanned(p);
      const extra = additional[p] || 0;
      let pay = Math.min(base + extra, remaining);
      if (p === termMonths) pay = remaining;
      remaining = Math.max(0, remaining - pay);
      cumulative += pay;
      rows.push({
        period: p,
        date: installmentDate(startDate, p, paymentDay),
        amount: pay,
        baseAmount: base,
        additionalPayment: extra,
        cumulative,
        remaining,
        paymentType: p <= N ? PAYMENT_TYPES.PRE : PAYMENT_TYPES.POST,
        isDeliveryMonth: p === deliveryPeriod,
        editable: true,
      });
    }
  }

  const deliveryRow = rows.find((r) => r.isDeliveryMonth);
  const deliveryCumulative = deliveryRow ? deliveryRow.cumulative : searchCum;
  const teslimSonrasiKalan = Math.max(0, financingAmount - deliveryCumulative);
  const deliveryDate = deliveryAchievable
    ? installmentDate(startDate, deliveryPeriod, paymentDay)
    : null;

  const summary = {
    financingAmount,
    organizationFee,
    downPayment,
    downPaymentRate,
    deliveryTargetRate: targetRate * 100,
    deliveryTargetAmount,
    requiredPreDelivery,
    preDeliveryMonths: deliveryAchievable ? deliveryPeriod : null,
    postDeliveryMonths: postCount,
    minimumMonthly,
    termMonths,
    monthlyPayment,
    deliveryDate,
    deliveryAchievable,
    startDate,
    deliveryCumulative,
    teslimSonrasiKalan,
    deliveryMet: deliveryAchievable,
    downCoversDelivery: downPayment >= deliveryTargetAmount - 0.5,
    minDeliveryMonths: MIN_DELIVERY_MONTHS,
  };

  return { rows, summary, errors };
}
