import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiErrorDetail, LOGO_HORIZONTAL } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden bg-primary">
        <img
          src="https://images.unsplash.com/photo-1532588213355-52317771cce6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          alt="Rhisos Mobilya"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="relative z-10 p-12 flex flex-col justify-between h-full text-white">
          <div className="bg-white rounded-2xl px-5 py-4 inline-flex items-center self-start">
            <img src={LOGO_HORIZONTAL} alt="Rhisos Mobilya" className="h-11 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight">Mobilya işinizi<br />tek panelden yönetin.</h1>
            <p className="mt-4 text-white/70 max-w-md">Teklif oluşturun, müşterilerinizi takip edin, gelen ve giden paranızı kontrol altında tutun.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center mb-8">
            <img src={LOGO_HORIZONTAL} alt="Rhisos Mobilya" className="h-11 object-contain" />
          </div>
          <h2 className="font-display text-3xl font-bold">Giriş Yap</h2>
          <p className="text-muted-foreground mt-2 text-sm">Hesabınıza erişmek için bilgilerinizi girin.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" data-testid="login-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@rhisos.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" data-testid="login-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <p data-testid="login-error" className="text-sm text-destructive">{error}</p>}
            <Button data-testid="login-submit-button" type="submit" disabled={loading} className="w-full rounded-full h-11">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Giriş Yap
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Hesabınız yok mu?{" "}
            <Link to="/register" data-testid="go-register-link" className="text-primary font-semibold hover:underline">Kayıt olun</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
