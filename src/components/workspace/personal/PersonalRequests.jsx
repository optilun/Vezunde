import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClaimStatusRow from "@/components/account/ClaimStatusRow";

export default function PersonalRequests({ user }) {
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    base44.entities.ProviderClaimRequest.filter({ user_id: user.id }, "-created_date", 50).then(setClaims);
  }, [user.id]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Solicitarile mele</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Urmareste revendicarile, solicitarile de acces si locatiile noi trimise spre verificare.</p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {claims === null && <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Se incarca solicitarile...</div>}
        {claims?.length === 0 && <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Nu ai nicio solicitare trimisa.</div>}
        {claims?.map((claim) => <ClaimStatusRow key={claim.id} claim={claim} />)}
      </div>
    </div>
  );
}
