import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

// Module 3F.2.1: canonical locality selection (GeographicLocality) is REQUIRED.
// Free-text city/county inputs were removed — city/county are display mirrors only.
export default function WizContact({ data, update, next }) {
  const loc = data.location;
  const set = (k, v) => update({ location: { ...loc, [k]: v } });
  const selectLocality = (g) =>
    update({
      location: {
        ...loc,
        locality_siruta_code: g?.siruta_code || "",
        city: g?.name || "",
        county: g?.county_name || "",
        county_code: g?.county_code || "",
        uat_code: g?.uat_code || "",
        uat_name: g?.uat_name || "",
      },
    });
  return (
    <div className="space-y-3 text-left">
      <LocalityAutocomplete
        placeholder="Localitatea (cauta in lista oficiala) *"
        value={loc.locality_siruta_code ? { display_label: `${loc.city}${loc.county ? ", " + loc.county : ""}` } : null}
        onSelect={selectLocality}
      />
      {!loc.locality_siruta_code && loc.city ? (
        <p className="text-xs text-muted-foreground">
          Localitate sugerata: {loc.city}. Selecteaza localitatea din lista oficiala pentru a continua.
        </p>
      ) : null}
      <input className={inputCls} placeholder="Adresa" value={loc.address} onChange={(e) => set("address", e.target.value)} />
      <input className={inputCls} placeholder="Telefon public" value={loc.phone_public} onChange={(e) => set("phone_public", e.target.value)} />
      <input className={inputCls} placeholder="Email public (optional)" value={loc.public_email} onChange={(e) => set("public_email", e.target.value)} />
      <input className={inputCls} placeholder="Website (optional)" value={loc.website} onChange={(e) => set("website", e.target.value)} />
      <ContinueButton onClick={next} disabled={!loc.locality_siruta_code} />
    </div>
  );
}