import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isAdmin } from "@/lib/access";
import ClaimStatusRow from "@/components/account/ClaimStatusRow";
import MyLocationCard from "@/components/account/MyLocationCard";

export default function MyAccount() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [items, setItems] = useState([]); // { membership, location }
  const [loading, setLoading] = useState(true);

  const load = async (u) => {
    const [claimList, memberships] = await Promise.all([
      base44.entities.ProviderClaimRequest.filter({ user_id: u.id }, "-created_date", 50),
      base44.entities.ProviderMembership.filter({ user_id: u.id, status: "active" }, null, 50),
    ]);
    const withLoc = await Promise.all(
      memberships
        .filter((m) => m.location_id)
        .map(async (m) => ({
          membership: m,
          location: await base44.entities.ProviderLocation.get(m.location_id).catch(() => null),
        }))
    );
    setClaims(claimList);
    setItems(withLoc.filter((x) => x.location));
    setLoading(false);
  };

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => { setUser(u); load(u); })
      .catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  if (!user || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se incarca...</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-10 sm:py-14">
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Contul meu</h1>
      <p className="mt-2 text-muted-foreground text-sm">Cererile si locatiile tale in Vezunde.</p>
      <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
        {isAdmin(user)
          ? "Administrator"
          : items.length > 0
            ? "Furnizor activ"
            : claims.some((c) => c.status === "in_asteptare")
              ? "Cerere de furnizor in asteptare"
              : "Cont utilizator"}
      </p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-muted-foreground">Cererile mele</h2>
      <div className="mt-3 space-y-3">
        {claims.length === 0 && <p className="text-sm text-muted-foreground">Nu ai nicio cerere trimisa.</p>}
        {claims.map((c) => <ClaimStatusRow key={c.id} claim={c} />)}
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-muted-foreground">Locatiile mele</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nu ai inca locatii active. Dupa aprobarea unei cereri, locatia va aparea aici.
          </p>
        )}
        {items.map(({ membership, location }) => (
          <MyLocationCard key={membership.id} location={location} membership={membership} onSaved={() => load(user)} />
        ))}
      </div>

      <div className="mt-8">
        <Link
          to="/adauga-sau-revendica"
          className="inline-block px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Adauga sau revendica alta locatie
        </Link>
      </div>
    </div>
  );
}