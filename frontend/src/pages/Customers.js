import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Building2, Phone, Mail, Search, History } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const empty = { name: "", company: "", email: "", phone: "", address: "", notes: "" };

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");

  const load = () => api.get("/customers").then((res) => setCustomers(res.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (c) => { setForm(c); setEditing(c.id); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Müşteri adı zorunlu"); return; }
    try {
      if (editing) await api.put(`/customers/${editing}`, form);
      else await api.post("/customers", form);
      toast.success("Müşteri kaydedildi");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const doDelete = async () => {
    await api.delete(`/customers/${deleteId}`);
    toast.success("Müşteri silindi");
    setDeleteId(null);
    load();
  };

  const filtered = customers.filter((c) =>
    `${c.name} ${c.company} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Müşteriler</h1>
          <p className="text-muted-foreground mt-1">{customers.length} müşteri kayıtlı.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="customer-search" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
          <Button data-testid="add-customer-button" onClick={openNew} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" /> Yeni Müşteri
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-16 text-center border shadow-none rounded-xl">
          <p className="text-muted-foreground">Henüz müşteri yok. İlk müşterinizi ekleyin.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <Card key={c.id} data-testid={`customer-card-${c.id}`} className="p-6 rounded-xl border shadow-none hover:-translate-y-1 hover:shadow-lg transition-transform">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg">{c.name}</h3>
                  {c.company && <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Building2 className="h-3.5 w-3.5" />{c.company}</p>}
                </div>
                <div className="flex gap-1">
                  <Button data-testid={`history-customer-${c.id}`} variant="ghost" size="icon" onClick={() => navigate(`/customers/${c.id}`)}><History className="h-4 w-4" /></Button>
                  <Button data-testid={`edit-customer-${c.id}`} variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button data-testid={`delete-customer-${c.id}`} variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Müşteriyi Düzenle" : "Yeni Müşteri"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Ad Soyad *</Label><Input data-testid="customer-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Firma</Label><Input data-testid="customer-company-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefon</Label><Input data-testid="customer-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>E-posta</Label><Input data-testid="customer-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Adres</Label><Input data-testid="customer-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notlar</Label><Textarea data-testid="customer-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button data-testid="save-customer-button" onClick={save} className="rounded-full">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Müşteriyi sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-customer" onClick={doDelete} className="bg-destructive text-destructive-foreground">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
