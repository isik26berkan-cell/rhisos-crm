import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, FileText, Wallet, LogOut, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/quotes", label: "Teklifler", icon: FileText, testid: "nav-quotes" },
  { to: "/customers", label: "Müşteriler", icon: Users, testid: "nav-customers" },
  { to: "/cashflow", label: "Kasa / Para Akışı", icon: Wallet, testid: "nav-cashflow" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-primary text-primary-foreground flex flex-col fixed h-full no-print z-20">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="h-10 w-10 rounded-xl bg-warning/90 flex items-center justify-center">
            <Armchair className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Rhisos</div>
            <div className="text-xs text-white/60 mt-1">Mobilya CRM</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="px-2 mb-3">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-white/50 truncate">{user?.email}</div>
          </div>
          <Button
            data-testid="logout-button"
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
