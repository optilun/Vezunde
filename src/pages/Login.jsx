import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { clearPostLoginRedirect, getAuthRoute, getPostLoginRedirect } from "@/lib/postLoginRedirect";

const LOGIN_METHOD_HELP = "Nu am putut conecta acest email cu parola introdusa. Daca ai creat contul cu Google, foloseste Continua cu Google. Daca ai creat cont cu parola, verifica parola sau foloseste Am uitat parola.";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registerPath = getAuthRoute("/register");
  const forgotPasswordPath = getAuthRoute("/forgot-password");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const redirect = getPostLoginRedirect();
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      clearPostLoginRedirect();
      window.location.href = redirect;
    } catch (_err) {
      setError(LOGIN_METHOD_HELP);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    const redirect = getPostLoginRedirect();
    clearPostLoginRedirect();
    base44.auth.loginWithProvider("google", redirect);
  };

  return (
    <AuthLayout split
      icon={LogIn}
      title="Bine ai revenit"
      subtitle="Conecteaza-te la contul tau"
      footer={
        <>
          Nu ai cont?{" "}
          <Link to={registerPath} className="text-primary font-medium hover:underline">
            Creeaza unul
          </Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-3" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continua cu Google
      </Button>

      <p className="mb-6 text-xs text-muted-foreground text-center leading-relaxed">
        Foloseste aceeasi adresa de email pentru acelasi profil VIASEE. Daca ai intrat prima data cu Google, continua cu Google.
      </p>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">sau</span></div>
      </div>

      {error && <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm leading-relaxed">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" placeholder="email@exemplu.ro" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Parola</Label>
            <Link to={forgotPasswordPath} className="text-xs text-primary hover:underline">Ai uitat parola?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-12 h-12" required />
            <button type="button" aria-label={showPassword ? "Ascunde parola" : "Arata parola"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Se conecteaza...</> : "Conecteaza-te"}
        </Button>
      </form>
    </AuthLayout>
  );
}
