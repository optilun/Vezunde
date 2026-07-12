import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

const PROFESSION_OPTIONS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

const PROFESSION_TO_LOCATION = {
  ophthalmologist: { provider_type: "medic_oftalmolog_independent", provider_profile_type: "independent_ophthalmologist" },
  optometrist: { provider_type: "optometrist_independent", provider_profile_type: "independent_optometrist" },
  optician: { provider_type: "cabinet_optometric", provider_profile_type: "independent_optician" },
};

export default function WizProfessionalBasics({ data, update, next }) {
  const prof = data.professional;
  const loc = data.location;
  const setLoc = (k, v) => update({ location: { ...loc, [k]: v } });

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

  const valid = prof.full_name.trim() && prof.professional_type && loc.locality_siruta_code && loc.address.trim() && (loc.phone_public.trim() || loc.public_email.trim());

  return (
    <div className="space-y-4 text-left">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Numele profesional *</label>
        <input className={inputCls} value={prof.full_name} onChange={(e) => update({ professional: { ...prof, full_name: e.target.value } })} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Profesia *</label>
        <select
          className={inputCls}
          value={prof.professional_type}
          onChange={(e) => {
            const type = e.target.value;
            const mapped = PROFESSION_TO_LOCATION[type] || {};
            update({ professional: { ...prof, professional_type: type }, location: { ...loc, ...mapped } });
          }}
        >
          <option value="">Selecteaza profesia</option>
          {Object.entries(PROFESSION_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Numele cabinetului sau locatiei</label>
        <input className={inputCls} placeholder="Optional; poate fi identic cu numele tau" value={loc.name} onChange={(e) => setLoc("name", e.target.value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Localitatea *</label>
        <LocalityAutocomplete placeholder="Cauta in lista oficiala" value={loc.locality_siruta_code ? { display_label: `${loc.city}${loc.county ? ", " + loc.county : ""}` } : null} onSelect={selectLocality} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Adresa profesionala *</label>
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
