import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fmtMoney } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Pencil, Armchair } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  pending: { label: "Beklemede", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Onaylandı", cls: "bg-positive/10 text-positive border-positive/30" },
  rejected: { label: "Reddedildi", cls: "bg-negative/10 text-negative border-negative/30" },
};

export default function QuoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);

  const load = () => api.get(`/quotes/${id}`).then(({ data }) => setQuote(data));
  useEffect(() => { load(); }, [id]);

  const changeStatus = async (status) => {
    await api.patch(`/quotes/${id}/status`, { status });
    toast.success(status === "approved" ? "Teklif onaylandı, gelir kaydı oluşturuldu" : "Durum güncellendi");
    load();
  };

  if (!quote) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate("/quotes")}><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>
        <div className="flex items-center gap-3">
          <Select value={quote.status} onValueChange={changeStatus}>
            <SelectTrigger data-testid="quote-status-select" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="pending">Beklemede</SelectItem>
              <SelectItem value="approved">Onaylandı</SelectItem>
              <SelectItem value="rejected">Reddedildi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate(`/quotes/${id}/edit`)}><Pencil className="h-4 w-4 mr-2" /> Düzenle</Button>
          <Button data-testid="print-quote-button" onClick={() => window.print()} className="rounded-full"><Printer className="h-4 w-4 mr-2" /> Yazdır / PDF</Button>
        </div>
      </div>

      <Card className="p-10 rounded-xl border shadow-none print-area bg-white">
        <div className="flex items-start justify-between pb-8 border-b">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Armchair className="h-6 w-6 text-warning" />
            </div>
            <div>
              <div className="font-display font-bold text-2xl">Rhisos Mobilya</div>
              <div className="text-sm text-muted-foreground">Teklif Belgesi</div>
            </div>
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
          </div>
        </div>

        {quote.notes && (
          <div className="mt-8 pt-6 border-t">
            <div className="text-xs uppercase text-muted-foreground tracking-wide mb-2">Notlar</div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
