import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { buildAuthRouteForCurrentPage } from "@/lib/postLoginRedirect";

export default function OnboardingAuthGate({ onAuthenticated, title = "Continua cu un cont VIASEE" }) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([base44.auth.isAuthenticated(), base44.auth.me().catch(() => null)])
      .then(([authenticated, user]) => {
        if (cancelled) return;
        if (authenticated && user) onAuthenticated?.(user);
        else setChecking(false);
      })
      .catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [onAuthenticated]);

  if (checking) {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Verificam sesiunea...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><LockKeyhole className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Contul pastreaza solicitarea, statusul verificarii si accesul primit ulterior. Nu publicam datele contului pe profilul locatiei.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> Revii automat la acest pas dupa autentificare.</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> Cererea nu este trimisa automat.</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to={buildAuthRouteForCurrentPage("/login")} className="inline-flex h-12 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
          Conecteaza-te
        </Link>
        <Link to={buildAuthRouteForCurrentPage("/register")} className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:border-foreground/40">
          Creeaza cont
        </Link>
      </div>
    </div>
  );
}
