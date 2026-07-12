import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

const ORG_TYPES = {
  optica_medicala: "Optica medicala",
  cabinet_optometric: "Cabinet optometric",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  clinica_oftalmologica: "Clinica oftalmologica",
};
const B2B_PROFILE_TYPES = {
  future_b2b_distributor: "Furnizor / distribuitor B2B",
  optical_laboratory_b2b: "Laborator optic B2B",
};
const ORG_TYPE_TO_PROFILE_TYPE = {
  optica_medicala: "independent_optical_store",
  cabinet_optometric: "independent_optometrist",
  cabinet_oftalmologic: "ophthalmology_office",
  clinica_oftalmologica: "ophthalmology_clinic",
};

export default function WizOrgBasics({ data, update, next }) {
  const org = data.organization;
  const loc = data.location;
  const isB2B = data.claimSubjectType === "b2b_supplier";
  const setLoc = (key, value) => update({ location: { ...loc, [key]: value } });

  const selectLocality = (g) => update({
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

  const valid = org.name.trim() && loc.name.trim() && loc.provider_type && loc.provider_profile_type && loc.locality_siruta_code && loc.address.trim() && (loc.phone_public.trim() || loc.public_email.trim());

  return (
    <div className="space-y-4 text-left">
      {isB2B && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Profilul de partener B2B nu apare in cautarea pacientilor. Este folosit numai in zona profesionala.
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{isB2B ? "Numele firmei" : "Numele organizatiei"} *</label>
        <input className={inputCls} value={org.name} onChange={(e) => update({ organization: { ...org, name: e.target.value } })} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{isB2B ? "Numele profilului sau brandului" : "Numele locatiei"} *</label>
        <input className={inputCls} value={loc.name} onChange={(e) => setLoc("name", e.target.value)} />
      </div>
      {isB2B ? (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tip partener B2B *</label>
          <select
            className={inputCls}
            value={loc.provider_profile_type}
            onChange={(e) => update({ location: { ...loc, provider_type: "laborator_optic", provider_profile_type: e.target.value } })}
          >
            <option value="">Selecteaza tipul</option>
            {Object.entries(B2B_PROFILE_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tip locatie *</label>
          <select
            className={inputCls}
            value={loc.provider_type}
            onChange={(e) => {
              const type = e.target.value;
              update({ location: { ...loc, provider_type: type, provider_profile_type: ORG_TYPE_TO_PROFILE_TYPE[type] || "" } });
            }}
          >
            <option value="">Selecteaza tipul</option>
            {Object.entries(ORG_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{isB2B ? "Localitatea sediului" : "Localitatea"} *</label>
        <LocalityAutocomplete placeholder="Cauta in lista oficiala" value={loc.locality_siruta_code ? { display_label: `${loc.city}${loc.county ? ", " + loc.county : ""}` } : null} onSelect={selectLocality} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{isB2B ? "Adresa sediului" : "Adresa"} *</label>
        <input className={inputCls} value={loc.address} onChange={(e) => setLoc("address", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefon public</label>
          <input className={inputCls} value={loc.phone_public} onChange={(e) => setLoc("phone_public", e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email public</label>
          <input className={inputCls} type="email" value={loc.public_email} onChange={(e) => setLoc("public_email", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Este necesar cel putin un contact public.</p>
      <ContinueButton onClick={next} disabled={!valid}>Continua cu autentificarea</ContinueButton>
    </div>
  );
}
