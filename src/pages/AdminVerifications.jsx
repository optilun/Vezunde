import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminClaimCard from "@/components/admin/AdminClaimCard";
import AdminLocationRow from "@/components/admin/AdminLocationRow";
import AdminPendingChanges from "@/components/admin/AdminPendingChanges";

export default function AdminVerifications() {
  const [user, setUser] = useState(null);
  const [denied, setDenied] = useState(false);
  const [claims, setClaims] = useState([]);
  const [locations, setLocations] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [claimList, locList] = await Promise.all([
      base44.entities.ProviderClaimRequest.filter({ status: "in_asteptare" }, "-created_date", 100),
      base44.entities.ProviderLocation.list("name", 500),
    ]);
    setClaims(claimList);
    setLocations(locList);
  };

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => {
        if (u.role !== "admin") { setDenied(true); return; }
        setUser(u);
        load();
      })
      .catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const call = async (fn, payload) => {
    setBusy(true);
    await base44.functions.invoke(fn, payload).catch(() => {});
    await load();
    setBusy(false);
  };

  if (denied) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Acces permis doar administratorilor.</div>;
  }
  if (!user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se incarca...</div>;
  }

  const pendingChanges = locations.filter((l) => l.pending_changes);

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Verificari</h1>
      <p className="mt-2 text-muted-foreground text-sm">Cereri de revendicare, locatii si modificari de profil.</p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-muted-foreground">Cereri in asteptare ({claims.length})</h2>
      <div className="mt-3 space-y-3">
        {claims.length === 0 && <p className="text-sm text-muted-foreground">Nicio cerere in asteptare.</p>}
        {claims.map((c) => (
          <AdminClaimCard
            key={c.id}
            claim={c}
            busy={busy}
            onDecision={(claim, decision, notes) =>
              call(decision === "approve" ? "approveClaim" : "rejectClaim", { claim_request_id: claim.id, notes })
            }
          />
        ))}
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-muted-foreground">Modificari de profil in asteptare ({pendingChanges.length})</h2>
      <div className="mt-3 space-y-3">
        {pendingChanges.length === 0 && <p className="text-sm text-muted-foreground">Nicio modificare in asteptare.</p>}
        {pendingChanges.map((l) => (
          <AdminPendingChanges
            key={l.id}
            location={l}
            busy={busy}
            onDecision={(loc, decision, notes) => call("reviewProfileChanges", { location_id: loc.id, decision, notes })}
          />
        ))}
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-muted-foreground">Locatii ({locations.length})</h2>
      <div className="mt-3 space-y-3">
        {locations.map((l) => (
          <AdminLocationRow
            key={l.id}
            location={l}
            busy={busy}
            onVerify={(loc) => call("verifyLocation", { location_id: loc.id })}
            onSuspend={(loc) => call("suspendLocation", { location_id: loc.id })}
          />
        ))}
      </div>
    </div>
  );
}