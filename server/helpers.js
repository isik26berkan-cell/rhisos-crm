const DEFAULT_SETTINGS = {
  company_name: "Rhisos Mobilya", tagline: "", address: "", phone: "",
  email: "", website: "", tax_office: "", tax_number: "", logo: "",
};

function customerDict(c) {
  return {
    id: c.id, name: c.name, company: c.company || "", email: c.email || "",
    phone: c.phone || "", address: c.address || "", notes: c.notes || "", created_at: c.created_at,
  };
}

function transactionDict(t) {
  return {
    id: t.id, type: t.type, amount: t.amount, category: t.category,
    payment_method: t.payment_method, description: t.description || "", date: t.date,
    currency: t.currency, quote_id: t.quote_id, payment_id: t.payment_id,
    auto: !!t.auto, created_at: t.created_at,
  };
}

function quoteDict(q, items, payments) {
  return {
    id: q.id, quote_number: q.quote_number, customer_id: q.customer_id,
    customer_name: q.customer_name, title: q.title,
    items: (items || []).map((i) => ({
      description: i.description, quantity: i.quantity, unit_price: i.unit_price, vat_rate: i.vat_rate,
    })),
    currency: q.currency, notes: q.notes || "", valid_until: q.valid_until || "",
    status: q.status,
    payments: (payments || []).map((p) => ({
      id: p.id, amount: p.amount, date: p.date, method: p.method, note: p.note || "",
    })),
    paid_total: q.paid_total || 0,
    subtotal: q.subtotal, vat_total: q.vat_total, discount: q.discount, grand_total: q.grand_total,
    created_at: q.created_at, created_by: q.created_by,
    emailed_at: q.emailed_at, emailed_to: q.emailed_to,
  };
}

function settingsDict(s) {
  return {
    company_name: s.company_name || "Rhisos Mobilya", tagline: s.tagline || "",
    address: s.address || "", phone: s.phone || "", email: s.email || "",
    website: s.website || "", tax_office: s.tax_office || "", tax_number: s.tax_number || "",
    logo: s.logo || "",
  };
}

function computeTotals(items, discount = 0) {
  let subtotal = 0, vatTotal = 0;
  for (const it of items) {
    const line = (it.quantity || 0) * (it.unit_price || 0);
    subtotal += line;
    vatTotal += line * ((it.vat_rate || 0) / 100);
  }
  const grand = subtotal - discount + vatTotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat_total: Math.round(vatTotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    grand_total: Math.round(grand * 100) / 100,
  };
}

function round2(n) { return Math.round((n || 0) * 100) / 100; }

module.exports = { DEFAULT_SETTINGS, customerDict, transactionDict, quoteDict, settingsDict, computeTotals, round2 };
