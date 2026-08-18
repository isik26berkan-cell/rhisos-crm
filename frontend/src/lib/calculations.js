// Ev Planı Hesaplama - çekirdek hesaplama motoru (modüler fonksiyonlar)

export const PAYMENT_TYPES = {
  ORG: "Organizasyon Ücreti Peşinat",
  DOWN: "Proje Peşinatı",
  PRE: "Tasarruf Taksiti",
  POST: "Finansman Taksiti",
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
  return d;
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

// --- Adım fonksiyonları (52. madde) ---
export const calculateOrganizationFee = (financing, rate) => financing * rate;

export const calculateDownPaymentRatio = (down, financing) =>
  financing > 0 ? (down / financing) * 100 : 0;

export const calculateDeliveryTarget = (financing, rate) => financing * rate;

export const calculateRequiredPreDeliveryPayment = (target, down) =>
  Math.max(0, target - down);

export const calculateMinimumMonthlyPayment = (required, months) =>
  months > 0 ? required / months : 0;

export const calculateRemainingBalance = (financing, paid) =>
  Math.max(0, financing - paid);

// Verilen aylık ödeme ile %45 hedefine ulaşmak için gereken ay sayısı
export function calculateEarliestDeliveryDate(startDate, down, target, monthly) {
  if (down >= target) return { months: 0, date: startDate };
  if (!monthly || monthly <= 0) return null;
  const months = Math.ceil((target - down) / monthly);
  return { months, date: installmentDate(startDate, months, 20) };
}

/**
 * Ana ödeme planı üretici.
 * input: {
 *   financingAmount, downPayment, startDate(Date), deliveryDate(Date),
 *   paymentDay, termMonths, preMode('auto'|'manual'), preMonthly,
 *   postMode('auto'|'manual'), postMonthly, tiers[], edits{}, additional{}
 * }
 * settings: { organizationRate, deliveryTargetRate }
 */
export function buildPlan(input, settings) {
  const {
    financingAmount,
    downPayment,
    startDate,
    deliveryDate,
    paymentDay,
    termMonths,
    preMode,
    preMonthly,
    postMode,
    postMonthly,
    tiers = [],
    edits = {},
    additional = {},
  } = input;

  const orgRate = settings.organizationRate;
  const targetRate = settings.deliveryTargetRate;

  // --- Doğrulamalar (46. madde) ---
  const errors = [];
  if (!(financingAmount > 0))
    errors.push("Finansman tutarı 0'dan büyük olmalıdır.");
  if (downPayment < 0) errors.push("Peşinat negatif olamaz.");
  if (downPayment > financingAmount)
    errors.push("Peşinat finansman tutarından yüksek olamaz.");
  if (deliveryDate <= startDate)
    errors.push("Teslim tarihi plan başlangıç tarihinden sonra olmalıdır.");

  const N = clamp(monthDiff(startDate, deliveryDate), 0, termMonths); // teslim öncesi dönem
  if (termMonths < monthDiff(startDate, deliveryDate))
    errors.push("Toplam vade teslim tarihinden önce bitemez.");

  // Kademe çakışma kontrolü
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
  const minimumMonthly = calculateMinimumMonthlyPayment(requiredPreDelivery, N);
  const postCount = Math.max(0, termMonths - N);

  const findTier = (p) => sorted.find((t) => p >= t.startMonth && p <= t.endMonth);

  const preMonthlyAuto = N > 0 ? requiredPreDelivery / N : 0;

  // Teslim sonrası otomatik taksit için planlanan teslim öncesi toplam
  let preTotalPlanned = 0;
  for (let p = 1; p <= N; p++) {
    const t = findTier(p);
    if (edits[p] !== undefined) preTotalPlanned += edits[p];
    else if (t) preTotalPlanned += t.amount;
    else if (preMode === "manual") preTotalPlanned += preMonthly;
    else preTotalPlanned += preMonthlyAuto;
  }
  const teslimSonrasiKalanPlanned = Math.max(
    0,
    financingAmount - downPayment - preTotalPlanned
  );
  const postMonthlyAuto = postCount > 0 ? teslimSonrasiKalanPlanned / postCount : 0;

  const basePlanned = (p) => {
    const t = findTier(p);
    if (edits[p] !== undefined) return edits[p];
    if (t) return t.amount;
    if (p <= N) return preMode === "manual" ? preMonthly : preMonthlyAuto;
    return postMode === "manual" ? postMonthly : postMonthlyAuto;
  };

  const rows = [];
  let remaining = financingAmount;
  let cumulative = 0;

  if (errors.length === 0) {
    // Organizasyon ücreti satırı (finansman geri ödemesine dahil DEĞİL)
    rows.push({
      period: "#",
      date: startDate,
      amount: organizationFee,
      baseAmount: organizationFee,
      additionalPayment: 0,
      cumulative: null,
      remaining: remaining,
      paymentType: PAYMENT_TYPES.ORG,
      isDeliveryMonth: false,
      editable: false,
    });

    // Proje peşinatı satırı
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
      if (p === termMonths) pay = remaining; // son taksit düzeltmesi
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
        isDeliveryMonth: p === N,
        editable: true,
      });
    }
  }

  // Teslimde ödenen (peşinat + teslim öncesi taksitler)
  let deliveryCumulative = downPayment;
  const deliveryRow = rows.find((r) => r.isDeliveryMonth);
  if (deliveryRow) deliveryCumulative = deliveryRow.cumulative;
  else if (N === 0) deliveryCumulative = downPayment;

  const teslimSonrasiKalan = Math.max(0, financingAmount - deliveryCumulative);
  const deliveryMet = deliveryCumulative >= deliveryTargetAmount - 0.5;

  const summary = {
    financingAmount,
    organizationFee,
    downPayment,
    downPaymentRate,
    deliveryTargetRate: targetRate * 100,
    deliveryTargetAmount,
    requiredPreDelivery,
    preDeliveryMonths: N,
    postDeliveryMonths: postCount,
    minimumMonthly,
    termMonths,
    deliveryDate,
    startDate,
    deliveryCumulative,
    teslimSonrasiKalan,
    deliveryMet,
    downCoversDelivery: downPayment >= deliveryTargetAmount - 0.5,
  };

  return { rows, summary, errors };
}
