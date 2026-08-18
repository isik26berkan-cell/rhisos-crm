import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fmtMoney, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const emptyItem = { description: "", quantity: 1, unit_price: 0, vat_rate: 20 };

export default function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("Mobilya Teklifi");
  const [currency, setCurrency] = useState("TRY");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([{ ...emptyItem }]);

  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data));
    if (id) {
      api.get(`/quotes/${id}`).then(({ data }) => {
        setCustomerId(data.customer_id);
        setTitle(data.title);
        setCurrency(data.currency);
        setNotes(data.notes || "");
        setValidUntil(data.valid_until || "");
        setDiscount(data.discount || 0);
        setItems(data.items.length ? data.items : [{ ...emptyItem }]);
      });
    }
  }, [id]);

  const updateItem = (i, field, value) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: field === "description" ? value : parseFloat(value) || 0 };
    setItems(copy);
  };
  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vatTotal = items.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
  const grandTotal = subtotal - discount + vatTotal;

  const save = async () => {
    if (!customerId) { toast.error("Müşteri seçin"); return; }
    if (items.some((it) => !it.description.trim())) { toast.error("Tüm kalemlerin açıklaması olmalı"); return; }
    const customer = customers.find((c) => c.id === customerId);
    const payload = {
      customer_id: customerId,
      customer_name: customer?.name || "",
      title, items, currency, notes, valid_until: validUntil, discount: parseFloat(discount) || 0,
    };
    try {
      let res;
      if (id) res = await api.put(`/quotes/${id}`, payload);
      else res = await api.post("/quotes", payload);
      toast.success("Teklif kaydedildi");
      navigate(`/quotes/${res.data.id}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate("/quotes")} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Tekliflere Dön</Button>
      <h1 className="font-display text-3xl font-bold mb-8">{id ? "Teklifi Düzenle" : "Yeni Teklif"}</h1>

      <Card className="p-6 rounded-xl border shadow-none mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Müşteri *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger data-testid="quote-customer-select"><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
              <SelectContent className="bg-card">
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Teklif Başlığı</Label><Input data-testid="quote-title-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Para Birimi</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger data-testid="quote-currency-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="TRY">₺ Türk Lirası</SelectItem>
                <SelectItem value="USD">$ Dolar</SelectItem>
                <SelectItem value="EUR">€ Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Geçerlilik Tarihi</Label><Input data-testid="quote-valid-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
        </div>
      </Card>

      <Card className="p-6 rounded-xl border shadow-none mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">Ürün Kalemleri</h3>
          <Button data-testid="add-item-button" onClick={addItem} variant="outline" size="sm" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Kalem Ekle</Button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground font-medium px-1">
            <div className="col-span-5">Açıklama</div>
            <div className="col-span-2 text-right">Adet</div>
            <div className="col-span-2 text-right">Birim Fiyat</div>
            <div className="col-span-1 text-right">KDV%</div>
            <div className="col-span-1 text-right">Tutar</div>
            <div className="col-span-1"></div>
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-center" data-testid={`item-row-${i}`}>
              <Input className="col-span-5" data-testid={`item-desc-${i}`} placeholder="Ürün / hizmet" value={it.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
              <Input className="col-span-2 text-right font-mono" data-testid={`item-qty-${i}`} type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
              <Input className="col-span-2 text-right font-mono" data-testid={`item-price-${i}`} type="number" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} />
              <Input className="col-span-1 text-right font-mono" data-testid={`item-vat-${i}`} type="number" value={it.vat_rate} onChange={(e) => updateItem(i, "vat_rate", e.target.value)} />
              <div className="col-span-1 text-right font-mono text-sm">{fmtMoney(it.quantity * it.unit_price, currency)}</div>
              <div className="col-span-1 flex justify-end">
                <Button data-testid={`remove-item-${i}`} variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl border shadow-none">
          <Label>Notlar</Label>
          <Textarea data-testid="quote-notes-input" className="mt-2" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Teklif ile ilgili notlar, ödeme koşulları..." />
        </Card>
        <Card className="p-6 rounded-xl border shadow-none">
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ara Toplam</span><span className="font-mono">{fmtMoney(subtotal, currency)}</span></div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">İskonto</span>
              <Input data-testid="quote-discount-input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-32 text-right font-mono h-8" />
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">KDV</span><span className="font-mono">{fmtMoney(vatTotal, currency)}</span></div>
            <div className="border-t pt-3 flex justify-between font-display font-bold text-lg"><span>Genel Toplam</span><span className="font-mono" data-testid="quote-grand-total">{fmtMoney(grandTotal, currency)}</span></div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate("/quotes")}>İptal</Button>
        <Button data-testid="save-quote-button" onClick={save} className="rounded-full"><Save className="h-4 w-4 mr-2" /> Teklifi Kaydet</Button>
      </div>
    </div>
  );
}
