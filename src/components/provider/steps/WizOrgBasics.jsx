import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";
import { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

// Organization-only provider types (independent professional types are
// selected via the profession picker in WizProfessionalBasics instead).
const ORG_TYPES = {
  optica_medicala: "Optica medicala",
  cabinet_optometric: "Cabinet optometric",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  clinica_oftalmologica: "Clinica oftalmologica",
  laborator_optic: "Laborator optic",
};

// Deterministic enum-to-enum mapping — same approved profile-type catalog
// used elsewhere, restricted to organization-relevant entries only.
const ORG_TYPE_TO_PROFILE_TYPE = {
  optica_medicala: "independent_optical_store",
  cabinet_optometric: "independent_optometrist",
  cabinet_oftalmologic: "ophthalmology_office",
  clinica_oftalmologica: "ophthalmology_clinic",
  laborator_optic: "optical_laboratory_b2c",
};

// Module 3H.1B.3.UI: single screen with only the fields supported by the
// existing short backend contract — no description, website, social, services,
// team, schedule, photos, equipment or brands.
export default function WizOrgBasics({ data, update, next }) {
  const org = data.organization;
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
    org.name.trim() &&
    loc.name.trim() &&
    loc.provider_type &&
    loc.locality_siruta_code &&
    loc.address.trim() &&
    (loc.phone_public.trim() || loc.public_email.trim()) &&
    contact.contact_name.trim() &&
    contact.email.trim() &&
    contact.claimant_relationship &&
    contact.representation_confirmed;

  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Numele organizatiei *" value={org.name} onChange={(e) => update({ organization: { ...org, name: e.target.value } })} />
      <input className={inputCls} placeholder="Numele locatiei *" value={loc.name} onChange={(e) => setLoc("name", e.target.value)} />
      <select
        className={inputCls}
        value={loc.provider_type}
        onChange={(e) => {
          const t = e.target.value;
          update({ location: { ...loc, provider_type: t, provider_profile_type: ORG_TYPE_TO_PROFILE_TYPE[t] || "" } });
        }}
      >
        <option value="">Tipul locatiei *</option>
        {Object.entries(ORG_TYPES).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
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
      <select className={inputCls} value={contact.claimant_relationship} onChange={(e) => setContact("claimant_relationship", e.target.value)}>
        <option value="">Relatia ta cu locatia *</option>
        {Object.entries(CLAIMANT_RELATIONSHIPS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer pt-1">
        <input type="checkbox" className="mt-0.5 w-4 h-4" checked={contact.representation_confirmed} onChange={(e) => setContact("representation_confirmed", e.target.checked)} />
        <span>Confirm ca reprezint aceasta locatie si ca informatiile transmise sunt corecte.</span>
      </label>
      <ContinueButton onClick={next} disabled={!valid} />
    </div>
  );
}