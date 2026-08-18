import { useEffect, useState } from "react";
import api, { fmtMoney, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet, Download } from "lucide-react";
import { toast } from "sonner";

const INCOME_CATS = ["Teklif Geliri", "Ürün Satışı", "Montaj Hizmeti", "Kapora", "Diğer Gelir"];
const EXPENSE_CATS = ["Hammadde", "İşçilik", "Kira", "Kargo / Nakliye", "Fatura / Enerji", "Pazarlama", "Diğer Gider"];
const PAYMENT = { cash: "Nakit", bank: "Banka / Havale", card: "Kredi Kartı", check: "Çek / Senet" };

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { type: "income", amount: "", category: "Teklif Geliri", payment_method: "bank", description: "", date: today(), currency: "TRY" };

export default function CashFlow() {
  const [txns, setTxns] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);

  const load = () => {
    const params = {};
    if (filterType !== "all") params.type = filterType;
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/transactions", { params }).then((res) => setTxns(res.data));
  };
  useEffect(() => { load(); }, [filterType, start, end]);

  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const openNew = (type) => { setForm({ ...emptyForm, type, category: type === "income" ? INCOME_CATS[0] : EXPENSE_CATS[0] }); setOpen(true); };

  const save = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Geçerli bir tutar girin"); return; }
    try {
      await api.post("/transactions", { ...form, amount: parseFloat(form.amount) });
      toast.success("Kayıt eklendi");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const doDelete = async (id) => {
    await api.delete(`/transactions/${id}`);
    toast.success("Kayıt silindi");
    load();
  };

  const exportExcel = async () => {
    try {
      const params = {};
      if (filterType !== "all") params.type = filterType;
      if (start) params.start = start;
      if (end) params.end = end;
      const res = await api.get("/transactions/export", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "rhisos_kasa_raporu.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel raporu indirildi");
    } catch (e) {
      toast.error("Rapor indirilemedi");
    }
  };

  const cats = form.type === "income" ? INCOME_CATS : EXPENSE_CATS;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Kasa / Para Akışı</h1>
          <p className="text-muted-foreground mt-1">Gelen ve giden para takibi.</p>
        </div>
        <div className="flex gap-3">
          <Button data-testid="export-excel-button" onClick={exportExcel} variant="outline" className="rounded-full"><Download className="h-4 w-4 mr-2" /> Excel İndir</Button>
          <Button data-testid="add-income-button" onClick={() => openNew("income")} className="rounded-full bg-positive hover:bg-positive/90"><ArrowUpRight className="h-4 w-4 mr-2" /> Gelir Ekle</Button>
          <Button data-testid="add-expense-button" onClick={() => openNew("expense")} className="rounded-full bg-negative hover:bg-negative/90"><ArrowDownRight className="h-4 w-4 mr-2" /> Gider Ekle</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 rounded-xl border shadow-none">
          <div className="flex items-center gap-2 text-positive mb-2"><TrendingUp className="h-4 w-4" /><span className="text-sm">Gelir</span></div>
          <p data-testid="cf-income" className="font-mono text-2xl font-bold">{fmtMoney(income)}</p>
        </Card>
        <Card className="p-6 rounded-xl border shadow-none">
          <div className="flex items-center gap-2 text-negative mb-2"><TrendingDown className="h-4 w-4" /><span className="text-sm">Gider</span></div>
          <p data-testid="cf-expense" className="font-mono text-2xl font-bold">{fmtMoney(expense)}</p>
        </Card>
        <Card className="p-6 rounded-xl border shadow-none bg-primary text-primary-foreground">
          <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4" /><span className="text-sm">Net Bakiye</span></div>
          <p data-testid="cf-balance" className="font-mono text-2xl font-bold">{fmtMoney(income - expense)}</p>
        </Card>
      </div>

      <Card className="border shadow-none rounded-xl overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-4 flex-wrap border-b bg-secondary/30">
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList>
              <TabsTrigger value="all" data-testid="filter-all">Tümü</TabsTrigger>
              <TabsTrigger value="income" data-testid="filter-income">Gelir</TabsTrigger>
              <TabsTrigger value="expense" data-testid="filter-expense">Gider</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Input type="date" data-testid="filter-start" value={start} onChange={(e) => setStart(e.target.value)} className="w-40 h-9" />
            <span className="text-muted-foreground text-sm">—</span>
            <Input type="date" data-testid="filter-end" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40 h-9" />
            {(start || end) && <Button variant="ghost" size="sm" onClick={() => { setStart(""); setEnd(""); }}>Temizle</Button>}
          </div>
        </div>

        {txns.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">Kayıt bulunamadı.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-secondary/20 border-b text-left text-sm text-muted-foreground">
              <tr>
                <th className="py-3 px-6 font-medium">Tarih</th>
                <th className="py-3 px-6 font-medium">Açıklama</th>
                <th className="py-3 px-6 font-medium">Kategori</th>
                <th className="py-3 px-6 font-medium">Ödeme</th>
                <th className="py-3 px-6 font-medium text-right">Tutar</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} data-testid={`txn-row-${t.id}`} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 px-6 font-mono text-sm">{t.date}</td>
                  <td className="py-4 px-6">{t.description || "-"}{t.auto && <span className="ml-2 text-xs text-muted-foreground">(otomatik)</span>}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{t.category}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{PAYMENT[t.payment_method] || t.payment_method}</td>
                  <td className={`py-4 px-6 text-right font-mono font-semibold ${t.type === "income" ? "text-positive" : "text-negative"}`}>
                    {t.type === "income" ? "+" : "-"}{fmtMoney(t.amount, t.currency)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {!t.auto && <Button data-testid={`delete-txn-${t.id}`} variant="ghost" size="icon" onClick={() => doDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">{form.type === "income" ? "Gelir Ekle" : "Gider Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Tutar *</Label><Input data-testid="txn-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger data-testid="txn-currency-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card"><SelectItem value="TRY">₺ TL</SelectItem><SelectItem value="USD">$ USD</SelectItem><SelectItem value="EUR">€ EUR</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="txn-category-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ödeme Yöntemi</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger data-testid="txn-payment-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.entries(PAYMENT).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tarih</Label><Input data-testid="txn-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Açıklama</Label><Textarea data-testid="txn-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button data-testid="save-txn-button" onClick={save} className="rounded-full">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
