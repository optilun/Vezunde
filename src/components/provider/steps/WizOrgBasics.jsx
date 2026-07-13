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

const ORG_TYPE_TO_PROFILE_TYPE = {
  optica_medicala: "independent_optical_store",
  cabinet_optometric: "independent_optometrist",
  cabinet_oftalmologic: "ophthalmology_office",
  clinica_oftalmologica: "ophthalmology_clinic",
};

export default function WizOrgBasics({ data, update, next }) {
  const org = data.organization;
  const loc = data.location;
  const setLoc = (key, value) => update({ location: { ...loc, [key]: value } });

  const selectLocality = (geo) => update({
    location: {
      ...loc,
      locality_siruta_code: geo?.siruta_code || "",
      city: geo?.name || "",
      county: geo?.county_name || "",
      county_code: geo?.county_code || "",
      uat_code: geo?.uat_code || "",
      uat_name: geo?.uat_name || "",
    },
  });

  const valid = Boolean(
    org.name.trim()
    && loc.name.trim()
    && loc.provider_type
    && loc.provider_profile_type
    && loc.locality_siruta_code
    && loc.address.trim()
    && (loc.phone_public.trim() || loc.public_email.trim())
  );

  return (
    <div className="space-y-4 text-left">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold">Organizatia</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Datele generale ale opticii, clinicii sau cabinetului.</p>
        </div>
        <input
          className={inputCls}
          placeholder="Numele organizatiei *"
          value={org.name}
          onChange={(event) => update({ organization: { ...org, name: event.target.value } })}
        />
        <select
          className={inputCls}
          value={loc.provider_type}
          onChange={(event) => {
            const providerType = event.target.value;
            update({ location: { ...loc, provider_type: providerType, provider_profile_type: ORG_TYPE_TO_PROFILE_TYPE[providerType] || "" } });
          }}
        >
          <option value="">Tipul organizatiei *</option>
          {Object.entries(ORG_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold">Prima locatie</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Locul fizic care va fi verificat si administrat in VIASEE.</p>
        </div>
        <input className={inputCls} placeholder="Numele locatiei *" value={loc.name} onChange={(event) => setLoc("name", event.target.value)} />
        <LocalityAutocomplete
          placeholder="Localitatea (cauta in lista oficiala) *"
          value={loc.locality_siruta_code ? { display_label: `${loc.city}${loc.county ? ", " + loc.county : ""}` } : null}
          onSelect={selectLocality}
        />
        <input className={inputCls} placeholder="Adresa *" value={loc.address} onChange={(event) => setLoc("address", event.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Telefon public" value={loc.phone_public} onChange={(event) => setLoc("phone_public", event.target.value)} />
          <input className={inputCls} type="email" placeholder="Email public" value={loc.public_email} onChange={(event) => setLoc("public_email", event.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">Este necesar cel putin un contact public: telefon sau email.</p>
      </section>

      <ContinueButton onClick={next} disabled={!valid}>Continua</ContinueButton>
    </div>
  );
}
