import { useEffect, useState } from "react";
import api, { fmtMoney } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, FileText, Users, ArrowUpRight, ArrowDownRight, AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

const COLORS = ["#3A5A40", "#9C3D38", "#D4A373", "#4A3B32", "#6B7A8F"];

function StatCard({ label, value, icon: Icon, tone, testid, delay }) {
  const toneMap = {
    positive: "text-positive bg-positive/10",
    negative: "text-negative bg-negative/10",
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/15",
  };
  return (
    <Card
      data-testid={testid}
      className="p-6 rounded-xl border bg-card shadow-none hover:-translate-y-1 hover:shadow-lg transition-transform stagger-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-mono text-2xl font-bold mt-2 text-foreground">{value}</p>
        </div>
        <div className={`h-11 w-11 rounded-md flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data));
  }, []);

  if (!stats) return <div className="p-8">Yükleniyor...</div>;

  const monthLabel = (m) => {
    const [y, mo] = m.split("-");
    const names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return `${names[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
  };
  const monthly = stats.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Genel Bakış</h1>
        <p className="text-muted-foreground mt-1">Rhisos Mobilya finansal ve satış özeti.</p>
      </div>

      {stats.expiring_quotes?.length > 0 && (
        <Card data-testid="expiring-alert" className="p-5 rounded-xl border border-warning/40 bg-warning/10 shadow-none mb-6">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-warning/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold">Vadesi Yaklaşan Teklifler</h3>
              <p className="text-sm text-muted-foreground mb-3">Aşağıdaki bekleyen tekliflerin geçerlilik süresi doluyor.</p>
              <div className="space-y-2">
                {stats.expiring_quotes.map((q) => (
                  <Link
                    key={q.id}
                    to={`/quotes/${q.id}`}
                    data-testid={`expiring-quote-${q.id}`}
                    className="flex items-center justify-between bg-card rounded-md border px-4 py-2.5 text-sm hover:border-warning transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono font-medium">{q.quote_number}</span>
                      <span className="text-muted-foreground">{q.customer_name}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="font-mono">{fmtMoney(q.grand_total, q.currency)}</span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${q.days_left < 0 ? "text-negative" : "text-warning"}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {q.days_left < 0 ? `${Math.abs(q.days_left)} gün geçti` : q.days_left === 0 ? "Bugün doluyor" : `${q.days_left} gün kaldı`}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <StatCard testid="stat-income" label="Toplam Gelir" value={fmtMoney(stats.total_income)} icon={TrendingUp} tone="positive" delay={0} />
        <StatCard testid="stat-expense" label="Toplam Gider" value={fmtMoney(stats.total_expense)} icon={TrendingDown} tone="negative" delay={60} />
        <StatCard testid="stat-balance" label="Net Bakiye" value={fmtMoney(stats.balance)} icon={Wallet} tone="primary" delay={120} />
        <StatCard testid="stat-quotes" label="Toplam Teklif" value={stats.total_quotes} icon={FileText} tone="warning" delay={180} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 rounded-xl border bg-card shadow-none" data-testid="chart-monthly">
          <h3 className="font-display font-semibold text-lg mb-1">Aylık Gelir & Gider</h3>
          <p className="text-sm text-muted-foreground mb-6">Son 6 ayın trendi</p>
          {monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">Henüz veri yok. Kasa bölümünden kayıt ekleyin.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E5E1" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12 }} width={70} tickFormatter={(v) => fmtMoney(v).replace(",00", "")} />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E8E5E1" }} />
                <Bar dataKey="income" name="Gelir" fill="#3A5A40" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Gider" fill="#9C3D38" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 rounded-xl border bg-card shadow-none" data-testid="chart-categories">
          <h3 className="font-display font-semibold text-lg mb-1">Gider Kategorileri</h3>
          <p className="text-sm text-muted-foreground mb-6">Dağılım</p>
          {stats.expense_by_category.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">Gider kaydı yok.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.expense_by_category} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {stats.expense_by_category.map((e, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E8E5E1" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {stats.expense_by_category.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      {e.name}
                    </span>
                    <span className="font-mono">{fmtMoney(e.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="p-6 rounded-xl border bg-card shadow-none">
          <div className="flex items-center gap-2 text-positive mb-3"><ArrowUpRight className="h-4 w-4" /><span className="text-sm font-medium">Onaylanan Teklifler</span></div>
          <p className="font-mono text-2xl font-bold">{stats.quote_counts.approved || 0}</p>
        </Card>
        <Card className="p-6 rounded-xl border bg-card shadow-none">
          <div className="flex items-center gap-2 text-warning mb-3"><FileText className="h-4 w-4" /><span className="text-sm font-medium">Bekleyen Teklifler</span></div>
          <p className="font-mono text-2xl font-bold">{stats.quote_counts.pending || 0}</p>
        </Card>
        <Card className="p-6 rounded-xl border bg-card shadow-none">
          <div className="flex items-center gap-2 text-primary mb-3"><Users className="h-4 w-4" /><span className="text-sm font-medium">Toplam Müşteri</span></div>
          <p className="font-mono text-2xl font-bold">{stats.customer_count}</p>
        </Card>
      </div>
    </div>
  );
}
