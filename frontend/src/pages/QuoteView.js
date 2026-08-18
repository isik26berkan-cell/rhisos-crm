import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fmtMoney, formatApiErrorDetail, LOGO_HORIZONTAL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Printer, Pencil, Mail, Plus, Trash2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  pending: { label: "Beklemede", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Onaylandı", cls: "bg-positive/10 text-positive border-positive/30" },
  rejected: { label: "Reddedildi", cls: "bg-negative/10 text-negative border-negative/30" },
};
const PAYMENT = { cash: "Nakit", bank: "Banka / Havale", card: "Kredi Kartı", check: "Çek / Senet" };
const today = () => new Date().toISOString().slice(0, 10);

export default function QuoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [company, setCompany] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", date: today(), method: "bank", note: "" });
  const [emailing, setEmailing] = useState(false);

  const load = () => api.get(`/quotes/${id}`).then(({ data }) => setQuote(data));
  useEffect(() => {
    load();
    api.get("/settings").then(({ data }) => setCompany(data));
  }, [id]);

  useEffect(() => {
    if (quote?.customer_id) {
      api.get(`/customers/${quote.customer_id}`).then(({ data }) => setCustomer(data)).catch(() => {});
    }
  }, [quote?.customer_id]);

  const shareWhatsApp = () => {
    let phone = (customer?.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Müşterinin telefon numarası kayıtlı değil"); return; }
    if (phone.startsWith("0")) phone = "90" + phone.slice(1);
    else if (phone.length === 10) phone = "90" + phone;
    const link = `${window.location.origin}/q/${id}`;
    const msg = `Merhaba ${quote.customer_name}, ${quote.quote_number} numaralı teklifiniz hazır. Detaylar için: ${link}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const changeStatus = async (status) => {
    await api.patch(`/quotes/${id}/status`, { status });
    toast.success("Durum güncellendi");
    load();
  };

  const addPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error("Geçerli bir tutar girin"); return; }
    try {
      await api.post(`/quotes/${id}/payments`, { ...payForm, amount: parseFloat(payForm.amount) });
      toast.success("Ödeme (kapora) eklendi");
      setPayOpen(false);
      setPayForm({ amount: "", date: today(), method: "bank", note: "" });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const deletePayment = async (pid) => {
    await api.delete(`/quotes/${id}/payments/${pid}`);
    toast.success("Ödeme silindi");
    load();
  };

  const sendEmail = async () => {
    setEmailing(true);
    try {
      const { data } = await api.post(`/quotes/${id}/email`);
      toast.success(`Teklif e-posta ile gönderildi: ${data.to}`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setEmailing(false);
    }
  };

  if (!quote) return <div className="p-8">Yükleniyor...</div>;

  const paid = quote.paid_total || 0;
  const remaining = (quote.grand_total || 0) - paid;

  return (
    <div className="p-8 max-w-4xl print-wrap">
      <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate("/quotes")}><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={quote.status} onValueChange={changeStatus}>
            <SelectTrigger data-testid="quote-status-select" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="pending">Beklemede</SelectItem>
              <SelectItem value="approved">Onaylandı</SelectItem>
              <SelectItem value="rejected">Reddedildi</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="email-quote-button" variant="outline" onClick={sendEmail} disabled={emailing}>
            {emailing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />} E-posta Gönder
          </Button>
          <Button data-testid="whatsapp-quote-button" variant="outline" onClick={shareWhatsApp} disabled={!customer} className="text-positive border-positive/40 hover:bg-positive/10">
            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={() => navigate(`/quotes/${id}/edit`)}><Pencil className="h-4 w-4 mr-2" /> Düzenle</Button>
          <Button data-testid="print-quote-button" onClick={() => window.print()} className="rounded-full"><Printer className="h-4 w-4 mr-2" /> Yazdır / PDF</Button>
        </div>
      </div>

      <Card className="p-10 rounded-xl border shadow-none print-area bg-white">
        <div className="flex items-start justify-between pb-8 border-b">
          <div className="flex items-center gap-4">
            <img src={company?.logo || LOGO_HORIZONTAL} alt="Rhisos Mobilya" className="h-16 object-contain" data-testid="quote-logo" />
            {(company?.company_name || company?.tagline || company?.phone || company?.email || company?.address || company?.tax_office || company?.tax_number) && (
              <div className="text-xs text-muted-foreground space-y-0.5 border-l pl-4">
                {company?.company_name && <div className="font-display font-bold text-base text-foreground" data-testid="quote-company-name">{company.company_name}</div>}
                {company?.tagline && <div className="text-sm font-medium text-foreground">{company.tagline}</div>}
                {company?.phone && <div>Tel: {company.phone}</div>}
                {company?.email && <div>{company.email}</div>}
                {company?.address && <div>{company.address}</div>}
                {(company?.tax_office || company?.tax_number) && <div>VD: {company.tax_office} {company.tax_number}</div>}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-lg">{quote.quote_number}</div>
            <Badge variant="outline" className={`${STATUS[quote.status]?.cls} rounded-full mt-2`}>{STATUS[quote.status]?.label}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 py-8">
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">Müşteri</div>
            <div className="font-display font-semibold text-lg">{quote.customer_name}</div>
            <div className="text-sm text-muted-foreground mt-1">{quote.title}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">Tarih</div>
            <div className="font-mono">{(quote.created_at || "").slice(0, 10)}</div>
            {quote.valid_until && <><div className="text-xs uppercase text-muted-foreground tracking-wide mb-1 mt-3">Geçerlilik</div><div className="font-mono">{quote.valid_until}</div></>}
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-y text-left text-xs uppercase text-muted-foreground tracking-wide">
              <th className="py-3">Açıklama</th>
              <th className="py-3 text-right">Adet</th>
              <th className="py-3 text-right">Birim Fiyat</th>
              <th className="py-3 text-right">KDV%</th>
              <th className="py-3 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-3">{it.description}</td>
                <td className="py-3 text-right font-mono">{it.quantity}</td>
                <td className="py-3 text-right font-mono">{fmtMoney(it.unit_price, quote.currency)}</td>
                <td className="py-3 text-right font-mono">%{it.vat_rate}</td>
                <td className="py-3 text-right font-mono">{fmtMoney(it.quantity * it.unit_price, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ara Toplam</span><span className="font-mono">{fmtMoney(quote.subtotal, quote.currency)}</span></div>
            {quote.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">İskonto</span><span className="font-mono">-{fmtMoney(quote.discount, quote.currency)}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">KDV</span><span className="font-mono">{fmtMoney(quote.vat_total, quote.currency)}</span></div>
            <div className="flex justify-between font-display font-bold text-lg border-t pt-2"><span>Genel Toplam</span><span className="font-mono">{fmtMoney(quote.grand_total, quote.currency)}</span></div>
            <div className="flex justify-between text-sm text-positive"><span>Ödenen (Kapora)</span><span className="font-mono" data-testid="quote-paid">{fmtMoney(paid, quote.currency)}</span></div>
            <div className="flex justify-between text-sm font-semibold text-negative border-t pt-2"><span>Kalan Bakiye</span><span className="font-mono" data-testid="quote-remaining">{fmtMoney(remaining, quote.currency)}</span></div>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-8 pt-6 border-t">
            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">Notlar</div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
      </Card>

      <Card className="p-6 rounded-xl border shadow-none mt-6 no-print" data-testid="payments-section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-lg">Ödemeler / Kapora</h3>
            <p className="text-sm text-muted-foreground">Kalan bakiye: <span className="font-mono text-negative">{fmtMoney(remaining, quote.currency)}</span></p>
          </div>
          <Button data-testid="add-payment-button" onClick={() => setPayOpen(true)} className="rounded-full"><Plus className="h-4 w-4 mr-2" /> Ödeme Ekle</Button>
        </div>
        {(!quote.payments || quote.payments.length === 0) ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Henüz ödeme kaydı yok.</p>
        ) : (
          <div className="divide-y">
            {quote.payments.map((p) => (
              <div key={p.id} data-testid={`payment-row-${p.id}`} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-mono font-semibold text-positive">+{fmtMoney(p.amount, quote.currency)}</span>
                  <span className="text-sm text-muted-foreground ml-3">{p.date} • {PAYMENT[p.method] || p.method}{p.note ? ` • ${p.note}` : ""}</span>
                </div>
                <Button data-testid={`delete-payment-${p.id}`} variant="ghost" size="icon" onClick={() => deletePayment(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle className="font-display">Ödeme / Kapora Ekle</DialogTitle><DialogDescription>Bu teklife alınan kapora veya kısmi ödemeyi kaydedin.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tutar *</Label><Input data-testid="payment-amount-input" type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0.00" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tarih</Label><Input data-testid="payment-date-input" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Yöntem</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.entries(PAYMENT).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Not</Label><Textarea data-testid="payment-note-input" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>İptal</Button>
            <Button data-testid="save-payment-button" onClick={addPayment} className="rounded-full">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
