import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { getAuthRoute } from "@/lib/postLoginRedirect";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const loginPath = getAuthRoute("/login");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch (_error) {
      // Raspunsul ramane neutru pentru a nu expune existenta unui cont.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reseteaza parola"
      subtitle="Iti trimitem un link pentru alegerea unei parole noi"
      footer={
        <Link to={loginPath} className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Inapoi la autentificare
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center leading-relaxed">
          Daca exista un cont pentru aceasta adresa, vei primi in scurt timp linkul de resetare. Dupa schimbarea parolei vei putea continua fluxul inceput.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresa de email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="email" type="email" autoComplete="email" autoFocus placeholder="email@exemplu.ro" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Se trimite...</> : "Trimite linkul de resetare"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
