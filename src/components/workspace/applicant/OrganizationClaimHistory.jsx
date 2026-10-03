import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClaimStatusRow from "@/components/account/ClaimStatusRow";

// 2026-10-03 (structura conturilor, pasul 1). Istoricul solicitarilor de organizatie (revendicari,
// cereri de acces, locatii noi) s-a mutat din contul personal aici, in grupul Organizatii. Contul
// personal ramane contul de pacient.
export default function OrganizationClaimHistory({ user }) {
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    let active = true;
    base44.entities.ProviderClaimRequest.filter({ user_id: user.id }, "-created_date", 50)
      .then((rows) => { if (active) setClaims(rows || []); })
      .catch(() => { if (active) setClaims([]); });
    return () => { active = false; };
  }, [user.id]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Solicitări de organizație</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Revendicările, cererile de acces și locațiile noi trimise spre verificare.</p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {claims === null && <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Se încarcă solicitările...</div>}
        {claims?.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nu ai nicio solicitare de organizație.</p>
            <Link to="/adauga-sau-revendica" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
              Adaugă sau revendică <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {claims?.map((claim) => <ClaimStatusRow key={claim.id} claim={claim} />)}
      </div>
    </div>
  );
}
