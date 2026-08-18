import { useEffect, useState } from "react";
import api, { formatApiErrorDetail, LOGO_EMBLEM } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Save, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { company_name: "", tagline: "", address: "", phone: "", email: "", website: "", tax_office: "", tax_number: "", logo: "" };

export default function Settings() {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/settings").then(({ data }) => {
      setForm({ ...empty, ...data });
      setLoaded(true);
    });
  }, []);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error("Logo 1MB'dan küçük olmalı"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", form);
      toast.success("Firma bilgileri kaydedildi");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Firma Ayarları</h1>
        <p className="text-muted-foreground mt-1">Logo ve iletişim bilgileriniz teklif belgelerinde görünür.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!loaded && <div data-testid="settings-loading" className="lg:col-span-3 text-muted-foreground">Yükleniyor...</div>}
        {loaded && (<>
        <Card className="p-6 rounded-xl border shadow-none lg:col-span-1">
          <Label className="mb-3 block">Logo</Label>
          <div className="aspect-square rounded-xl border bg-secondary/30 flex items-center justify-center overflow-hidden mb-4">
            {form.logo ? (
              <img src={form.logo} alt="Logo" data-testid="settings-logo-preview" className="w-full h-full object-contain p-4" />
            ) : (
              <img src={LOGO_EMBLEM} alt="Rhisos" className="w-full h-full object-contain p-6 opacity-90" />
            )}
          </div>
          <div className="flex gap-2">
            <label className="flex-1">
              <input type="file" accept="image/*" className="hidden" data-testid="settings-logo-input" onChange={onLogo} />
              <span className="flex items-center justify-center gap-2 h-10 rounded-full border cursor-pointer text-sm font-medium hover:bg-secondary transition-colors">
                <Upload className="h-4 w-4" /> Logo Yükle
              </span>
            </label>
            {form.logo && (
              <Button variant="ghost" size="icon" data-testid="settings-logo-remove" onClick={() => setForm({ ...form, logo: "" })}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">PNG/JPG, max 1MB.</p>
        </Card>

        <Card className="p-6 rounded-xl border shadow-none lg:col-span-2">
          <div className="flex items-center gap-2 mb-4 text-primary"><Building2 className="h-4 w-4" /><span className="font-display font-semibold">İletişim & Antet Bilgileri</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Firma Adı</Label><Input data-testid="settings-company-name" value={form.company_name} onChange={set("company_name")} /></div>
            <div className="space-y-2"><Label>Slogan / Alt Başlık</Label><Input data-testid="settings-tagline" value={form.tagline} onChange={set("tagline")} placeholder="Örn. Özel Tasarım Mobilya" /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input data-testid="settings-phone" value={form.phone} onChange={set("phone")} /></div>
            <div className="space-y-2"><Label>E-posta</Label><Input data-testid="settings-email" value={form.email} onChange={set("email")} /></div>
            <div className="space-y-2"><Label>Web Sitesi</Label><Input data-testid="settings-website" value={form.website} onChange={set("website")} /></div>
            <div className="space-y-2"><Label>Vergi Dairesi</Label><Input data-testid="settings-tax-office" value={form.tax_office} onChange={set("tax_office")} /></div>
            <div className="space-y-2"><Label>Vergi No</Label><Input data-testid="settings-tax-number" value={form.tax_number} onChange={set("tax_number")} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Adres</Label><Textarea data-testid="settings-address" value={form.address} onChange={set("address")} rows={2} /></div>
          </div>
          <div className="flex justify-end mt-6">
            <Button data-testid="settings-save-button" onClick={save} disabled={saving} className="rounded-full"><Save className="h-4 w-4 mr-2" /> Kaydet</Button>
          </div>
        </Card>
        </>)}
      </div>
    </div>
  );
}
