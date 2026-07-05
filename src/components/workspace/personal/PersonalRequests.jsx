import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ClaimStatusRow from "@/components/account/ClaimStatusRow";

export default function PersonalRequests({ user }) {
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    base44.entities.ProviderClaimRequest.filter({ user_id: user.id }, "-created_date", 50).then(setClaims);
  }, [user.id]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Solicitarile mele</h1>
      <div className="mt-4 space-y-3">
        {claims === null && <p className="text-sm text-muted-foreground">Se incarca...</p>}
        {claims?.length === 0 && <p className="text-sm text-muted-foreground">Nu ai nicio solicitare trimisa.</p>}
        {claims?.map((c) => <ClaimStatusRow key={c.id} claim={c} />)}
      </div>
    </div>
  );
}