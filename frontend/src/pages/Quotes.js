import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtMoney } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Eye, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  pending: { label: "Beklemede", cls: "bg-warning/15 text-warning border-warning/30" },
  approved: { label: "Onaylandı", cls: "bg-positive/10 text-positive border-positive/30" },
  rejected: { label: "Reddedildi", cls: "bg-negative/10 text-negative border-negative/30" },
};

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  const load = () => api.get("/quotes").then((res) => setQuotes(res.data));
  useEffect(() => { load(); }, []);

  const doDelete = async () => {
    await api.delete(`/quotes/${deleteId}`);
    toast.success("Teklif silindi");
    setDeleteId(null);
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Teklifler</h1>
          <p className="text-muted-foreground mt-1">{quotes.length} teklif oluşturuldu.</p>
        </div>
        <Button data-testid="add-quote-button" onClick={() => navigate("/quotes/new")} className="rounded-full">
          <Plus className="h-4 w-4 mr-2" /> Yeni Teklif
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Card className="p-16 text-center border shadow-none rounded-xl">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Henüz teklif yok. İlk teklifinizi oluşturun.</p>
        </Card>
      ) : (
        <Card className="border shadow-none rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b">
              <tr className="text-left text-sm text-muted-foreground">
                <th className="py-4 px-6 font-medium">Teklif No</th>
                <th className="py-4 px-6 font-medium">Müşteri</th>
                <th className="py-4 px-6 font-medium">Durum</th>
                <th className="py-4 px-6 font-medium text-right">Tutar</th>
                <th className="py-4 px-6 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} data-testid={`quote-row-${q.id}`} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="py-4 px-6 font-mono text-sm font-medium">{q.quote_number}</td>
                  <td className="py-4 px-6">
                    <div className="font-medium">{q.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{q.title}</div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge variant="outline" className={`${STATUS[q.status]?.cls} rounded-full`}>{STATUS[q.status]?.label}</Badge>
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-semibold">{fmtMoney(q.grand_total, q.currency)}</td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-1">
                      <Button data-testid={`view-quote-${q.id}`} variant="ghost" size="icon" onClick={() => navigate(`/quotes/${q.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button data-testid={`edit-quote-${q.id}`} variant="ghost" size="icon" onClick={() => navigate(`/quotes/${q.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
                      <Button data-testid={`delete-quote-${q.id}`} variant="ghost" size="icon" onClick={() => setDeleteId(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Teklifi sil?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem geri alınamaz. Bağlı otomatik gelir kaydı da silinir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-quote" onClick={doDelete} className="bg-destructive text-destructive-foreground">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
