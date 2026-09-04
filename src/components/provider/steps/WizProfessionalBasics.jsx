import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

// 2026-09-03: etichetele vin din shared/professionalIdentity.js. Maparea de mai jos, catre
// enum-urile de locatie, ramane locala - este o decizie despre locatii, nu despre profesii.
const PROFESSION_OPTIONS = PROFESSIONAL_TYPE_LABELS;

// Deterministic enum-to-enum mapping onto the existing ProviderLocation
// enums — UI-only convenience, no schema change.
const PROFESSION_TO_LOCATION = {
  ophthalmologist: { provider_type: "medic_oftalmolog_independent", provider_profile_type: "independent_ophthalmologist" },
  optometrist: { provider_type: "optometrist_independent", provider_profile_type: "independent_optometrist" },
  optician: { provider_type: "cabinet_optometric", provider_profile_type: "independent_optician" },
};

// Module 3H.1B.3.UI: single screen for the independent-professional path —
// only fields supported by the existing short backend contract.
export default function WizProfessionalBasics({ data, update, next }) {
  const prof = data.professional;
  const loc = data.location;
  const contact = data.contact;
  const setLoc = (k, v) => update({ location: { ...loc, [k]: v } });
  const setContact = (k, v) => update({ contact: { ...contact, [k]: v } });

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

  const valid =
    prof.full_name.trim() &&
    prof.professional_type &&
    loc.locality_siruta_code &&
    loc.address.trim() &&
    (loc.phone_public.trim() || loc.public_email.trim()) &&
    contact.contact_name.trim() &&
    contact.email.trim() &&
    contact.representation_confirmed;

  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Numele complet *" value={prof.full_name} onChange={(e) => update({ professional: { ...prof, full_name: e.target.value } })} />
      <select
        className={inputCls}
        value={prof.professional_type}
        onChange={(e) => {
          const t = e.target.value;
          const mapped = PROFESSION_TO_LOCATION[t] || {};
          update({ professional: { ...prof, professional_type: t }, location: { ...loc, ...mapped } });
        }}
      >
        <option value="">Profesia ta *</option>
        {Object.entries(PROFESSION_OPTIONS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <input className={inputCls} placeholder="Numele locatiei/cabinetului (optional)" value={loc.name} onChange={(e) => setLoc("name", e.target.value)} />
      <LocalityAutocomplete
        placeholder="Localitatea (cauta in lista oficiala) *"
        value={loc.locality_siruta_code ? { display_label: `${loc.city}${loc.county ? ", " + loc.county : ""}` } : null}
        onSelect={selectLocality}
      />
      <input className={inputCls} placeholder="Adresa *" value={loc.address} onChange={(e) => setLoc("address", e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Telefon public" value={loc.phone_public} onChange={(e) => setLoc("phone_public", e.target.value)} />
        <input className={inputCls} type="email" placeholder="Email public" value={loc.public_email} onChange={(e) => setLoc("public_email", e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Necesar cel putin unul: telefon sau email public.</p>

      <div className="pt-3 mt-1 border-t border-border" />
      <input className={inputCls} placeholder="Numele persoanei care trimite cererea *" value={contact.contact_name} onChange={(e) => setContact("contact_name", e.target.value)} />
      <input className={inputCls} type="email" placeholder="Emailul persoanei care trimite cererea *" value={contact.email} onChange={(e) => setContact("email", e.target.value)} />
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer pt-1">
        <input type="checkbox" className="mt-0.5 w-4 h-4" checked={contact.representation_confirmed} onChange={(e) => setContact("representation_confirmed", e.target.checked)} />
        <span>Confirm ca informatiile transmise sunt corecte.</span>
      </label>
      <ContinueButton onClick={next} disabled={!valid} />
    </div>
  );
}