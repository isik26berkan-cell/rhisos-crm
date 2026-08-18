import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiErrorDetail } from "@/lib/api";
import { Armchair, Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Armchair className="h-5 w-5 text-warning" />
          </div>
          <span className="font-display font-bold text-xl">Rhisos Mobilya</span>
        </div>
        <h2 className="font-display text-3xl font-bold">Kayıt Ol</h2>
        <p className="text-muted-foreground mt-2 text-sm">Yeni bir hesap oluşturun.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input id="name" data-testid="register-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" data-testid="register-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@rhisos.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" type="password" data-testid="register-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p data-testid="register-error" className="text-sm text-destructive">{error}</p>}
          <Button data-testid="register-submit-button" type="submit" disabled={loading} className="w-full rounded-full h-11">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Kayıt Ol
          </Button>
        </form>
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Zaten hesabınız var mı?{" "}
          <Link to="/login" data-testid="go-login-link" className="text-primary font-semibold hover:underline">Giriş yapın</Link>
        </p>
      </div>
    </div>
  );
}
