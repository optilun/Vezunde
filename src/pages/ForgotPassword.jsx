import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { buildAuthRoute, rememberPostAuthDestination } from "@/lib/postLoginRedirect";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    rememberPostAuthDestination();
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Raspuns neutru indiferent de existenta contului.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reseteaza parola"
      subtitle="Iti trimitem un link de resetare pe email"
      footer={
        <Link to={buildAuthRoute("/login")} className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Inapoi la autentificare
        </Link>
      }
    >
      {sent ? (
        <div className="text-center">
          <p className="text-sm text-foreground leading-relaxed">Daca exista un cont asociat acestei adrese, vei primi in scurt timp un link pentru resetarea parolei.</p>
          <p className="mt-2 text-xs text-muted-foreground">Dupa resetare vei reveni la fluxul inceput pe acest dispozitiv.</p>
        </div>
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
