import React, { useEffect, useMemo, useState } from "react";
import { Search, BadgeCheck, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { VERIFICATION_STATE_LABELS } from "@/lib/providerTaxonomy";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ProviderSearch({ onClaim, onNew }) {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [orgs, setOrgs] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.ProviderLocation.filter({ status: "publicata" }, "name", 500),
      base44.entities.ProviderOrganization.list(null, 200),
    ]).then(([locs, orgList]) => {
      setLocations(locs);
      setOrgs(Object.fromEntries(orgList.map((o) => [o.id, o.name])));
    });
  }, []);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return locations
      .filter((l) => {
        const orgName = l.organization_id ? orgs[l.organization_id] || "" : "";
        return [l.name, l.city, l.address, l.phone_public, orgName].some((f) => norm(f).includes(q));
      })
      .slice(0, 8);
  }, [query, locations, orgs]);

  return (
    <div className="text-left">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cauta dupa nume, organizatie, oras, adresa sau telefon"
          className="w-full rounded-xl border border-border bg-card pl-11 pr-4 py-3.5 text-sm outline-none focus:border-foreground/50 transition-colors"
        />
      </div>

      <div className="mt-4 space-y-3">
        {results.map((loc) => (
          <div key={loc.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[loc.provider_type] || loc.provider_type}</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {loc.name}
                  {loc.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
                </div>
                {loc.organization_id && orgs[loc.organization_id] && (
                  <div className="text-xs text-muted-foreground">{orgs[loc.organization_id]}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {loc.city}{loc.address ? `, ${loc.address}` : ""}
                </div>
                {loc.verification_state && loc.verification_state !== "unclaimed" && (
                  <div className="text-xs mt-1 text-muted-foreground">{VERIFICATION_STATE_LABELS[loc.verification_state]}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onClaim(loc)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: "#171717" }}
              >
                Aceasta este locatia mea
              </button>
            </div>
          </div>
        ))}
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground">Nicio locatie gasita.</p>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onNew}
          className="px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Nu gasesc locatia
        </button>
      </div>
    </div>
  );
}