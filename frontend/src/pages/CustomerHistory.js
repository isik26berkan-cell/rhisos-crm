import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { fmtMoney } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Phone, Mail, FileText, Wallet, TrendingUp, CheckCircle2 } from "lucide-react";

const STATUS = {
  pending: { label: "Beklemede", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Onaylandı", cls: "bg-positive/10 text-positive border-positive/30" },
  rejected: { label: "Reddedildi", cls: "bg-negative/10 text-negative border-negative/30" },
};
const PAYMENT = { cash: "Nakit", bank: "Banka / Havale", card: "Kredi Kartı", check: "Çek / Senet" };

export default function CustomerHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/customers/${id}/history`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="p-8">Yükleniyor...</div>;
  const { customer, quotes, payments, totals } = data;

  return (
    <div className="p-8 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate("/customers")} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Müşterilere Dön</Button>

      <Card className="p-6 rounded-xl border shadow-none mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="history-customer-name">{customer.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {customer.company && <p className="flex items-center gap-2"><Building2 className="h-4 w-4" />{customer.company}</p>}
              {customer.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{customer.email}</p>}
              {customer.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{customer.phone}</p>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 rounded-xl border shadow-none">
          <div className="flex items-center gap-2 text-primary mb-2"><FileText className="h-4 w-4" /><span className="text-sm">Teklif Sayısı</span></div>
          <p className="font-mono text-2xl font-bold" data-testid="history-quote-count">{totals.quote_count}</p>
        </Card>
        <Card className="p-5 rounded-xl border shadow-none">
          <div className="flex items-center gap-2 text-muted-foreground mb-2"><TrendingUp className="h-4 w-4" /><span className="text-sm">Toplam Teklif Tutarı</span></div>
          <p className="font-mono text-2xl font-bold">{fmtMoney(totals.total_quoted)}</p>
        </Card>
        <Card className="p-5 rounded-xl border shadow-none">
          <div className="flex items-center gap-2 text-positive mb-2"><CheckCircle2 className="h-4 w-4" /><span className="text-sm">Onaylanan</span></div>
          <p className="font-mono text-2xl font-bold">{fmtMoney(totals.total_approved)}</p>
        </Card>
        <Card className="p-5 rounded-xl border shadow-none bg-primary text-primary-foreground">
          <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4" /><span className="text-sm">Tahsil Edilen</span></div>
          <p className="font-mono text-2xl font-bold" data-testid="history-total-paid">{fmtMoney(totals.total_paid)}</p>
        </Card>
      </div>

      <h2 className="font-display font-semibold text-xl mb-3">Teklifler</h2>
      {quotes.length === 0 ? (
        <Card className="p-10 text-center border shadow-none rounded-xl mb-8 text-muted-foreground">Bu müşteriye ait teklif yok.</Card>
      ) : (
        <Card className="border shadow-none rounded-xl overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="py-3 px-6 font-medium">Teklif No</th>
                <th className="py-3 px-6 font-medium">Başlık</th>
                <th className="py-3 px-6 font-medium">Durum</th>
                <th className="py-3 px-6 font-medium text-right">Tutar</th>
                <th className="py-3 px-6 font-medium text-right">Kalan</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} data-testid={`history-quote-${q.id}`} className="border-b last:border-0 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => navigate(`/quotes/${q.id}`)}>
                  <td className="py-3 px-6 font-mono text-sm">{q.quote_number}</td>
                  <td className="py-3 px-6">{q.title}</td>
                  <td className="py-3 px-6"><Badge variant="outline" className={`${STATUS[q.status]?.cls} rounded-full`}>{STATUS[q.status]?.label}</Badge></td>
                  <td className="py-3 px-6 text-right font-mono">{fmtMoney(q.grand_total, q.currency)}</td>
                  <td className="py-3 px-6 text-right font-mono text-negative">{fmtMoney((q.grand_total || 0) - (q.paid_total || 0), q.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="font-display font-semibold text-xl mb-3">Ödemeler</h2>
      {payments.length === 0 ? (
        <Card className="p-10 text-center border shadow-none rounded-xl text-muted-foreground">Henüz ödeme kaydı yok.</Card>
      ) : (
        <Card className="border shadow-none rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="py-3 px-6 font-medium">Tarih</th>
                <th className="py-3 px-6 font-medium">Teklif</th>
                <th className="py-3 px-6 font-medium">Yöntem</th>
                <th className="py-3 px-6 font-medium">Not</th>
                <th className="py-3 px-6 font-medium text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} data-testid={`history-payment-${p.id}`} className="border-b last:border-0">
                  <td className="py-3 px-6 font-mono text-sm">{p.date}</td>
                  <td className="py-3 px-6 font-mono text-sm">{p.quote_number}</td>
                  <td className="py-3 px-6 text-sm text-muted-foreground">{PAYMENT[p.method] || p.method}</td>
                  <td className="py-3 px-6 text-sm text-muted-foreground">{p.note || "-"}</td>
                  <td className="py-3 px-6 text-right font-mono font-semibold text-positive">+{fmtMoney(p.amount, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
