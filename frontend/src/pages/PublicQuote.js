import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtMoney, LOGO_HORIZONTAL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";

const STATUS = {
  pending: { label: "Beklemede", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Onaylandı", cls: "bg-positive/10 text-positive border-positive/30" },
  rejected: { label: "Reddedildi", cls: "bg-negative/10 text-negative border-negative/30" },
};

export default function PublicQuote() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/public/quotes/${id}`).then((res) => setData(res.data)).catch(() => setError(true));
  }, [id]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="public-quote-error">Teklif bulunamadı.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;

  const { quote, company } = data;
  const paid = quote.paid_total || 0;
  const remaining = (quote.grand_total || 0) - paid;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto print-wrap">
        <div className="flex justify-end mb-4 no-print">
          <Button data-testid="public-print-button" onClick={() => window.print()} className="rounded-full"><Printer className="h-4 w-4 mr-2" /> Yazdır / PDF</Button>
        </div>

        <Card className="p-10 rounded-xl border shadow-none print-area bg-white" data-testid="public-quote">
          <div className="flex items-start justify-between pb-8 border-b">
            <div className="flex items-center gap-4">
              <img src={company?.logo || LOGO_HORIZONTAL} alt="Rhisos Mobilya" className="h-16 object-contain" />
              {(company?.company_name || company?.tagline || company?.phone || company?.email || company?.address || company?.tax_office || company?.tax_number) && (
                <div className="text-xs text-muted-foreground space-y-0.5 border-l pl-4">
                  {company?.company_name && <div className="font-display font-bold text-base text-foreground">{company.company_name}</div>}
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
              {paid > 0 && <div className="flex justify-between text-sm text-positive"><span>Ödenen</span><span className="font-mono">{fmtMoney(paid, quote.currency)}</span></div>}
              {paid > 0 && <div className="flex justify-between text-sm font-semibold text-negative border-t pt-2"><span>Kalan Bakiye</span><span className="font-mono">{fmtMoney(remaining, quote.currency)}</span></div>}
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
    </div>
  );
}
