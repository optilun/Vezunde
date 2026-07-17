import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES_3C } from "@/lib/directoryOpsCatalog";
import { PROVIDER_PROFILE_TYPES } from "@/lib/profileFoundationCatalog";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";
import DirOpsIdentityCandidates from "@/components/admin/directory/DirOpsIdentityCandidates";
import AdminCard from "@/components/admin/ui/AdminCard";

const input = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-foreground/40";
const label = "mb-1.5 mt-4 block text-xs font-semibold text-muted-foreground";

const EMPTY = {
  org_name: "",
  legal_name: "",
  org_website: "",
  name: "",
  provider_type: "",
  provider_profile_type: "",
  city: "",
  county: "",
  locality_siruta_code: "",
  address: "",
  phone_public: "",
  public_email: "",
  website: "",
  description: "",
  opening_hours: "",
  source_url: "",
  source_type: "site_oficial",
  source_name: "",
  source_checked_at: "",
  data_confidence: "medium",
  source_notes: "",
  mark_active: false,
};

function initialForm() {
  try {
    const raw = sessionStorage.getItem("dirops_prefill");
    if (raw) {
      sessionStorage.removeItem("dirops_prefill");
      return { ...EMPTY, ...JSON.parse(raw) };
    }
  } catch (_error) {
    // Prefill is optional.
  }
  return EMPTY;
}

export default function DirOpsAddLocation() {
  const [form, setForm] = useState(initialForm);
  const [identityCheck, setIdentityCheck] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const setField = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    }));
  };

  const submit = async (forceDistinct) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await base44.functions.invoke("directoryOps", {
        action: "create_location",
        force_distinct: forceDistinct === true,
        duplicate_override_reason: overrideReason,
        mark_active: form.mark_active,
        organization: {
          name: form.org_name,
          legal_name: form.legal_name,
          website: form.org_website,
        },
        location: {
          name: form.name,
          provider_type: form.provider_type,
          provider_profile_type: form.provider_profile_type,
          city: form.city,
          county: form.county,
          locality_siruta_code: form.locality_siruta_code,
          address: form.address,
          phone_public: form.phone_public,
          public_email: form.public_email,
          website: form.website,
          description: form.description,
          opening_hours: form.opening_hours,
        },
        provenance: {
          source_url: form.source_url,
          source_type: form.source_type,
          source_name: form.source_name,
          source_checked_at: form.source_checked_at
            ? new Date(form.source_checked_at).toISOString()
            : "",
          data_confidence: form.data_confidence,
          source_notes: form.source_notes,
        },
      });

      if (response.data.identity_check) {
        setIdentityCheck(response.data.identity_check);
        setSaving(false);
        return;
      }

      setIdentityCheck(null);
      setOverrideReason("");
      setForm(EMPTY);
      setMessage({
        ok: true,
        text: "Locatia a fost creata ca profil directory, fara servicii automate.",
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.error || error.message,
      });
    }
    setSaving(false);
  };

  const requiredMissing = !form.name
    || !form.provider_type
    || !form.provider_profile_type
    || !form.locality_siruta_code
    || !form.address
    || !form.source_url
    || !form.source_checked_at
    || !form.org_name;

  return (
    <div className="max-w-3xl space-y-5">
      <AdminCard className="p-4 sm:p-5">
        <h2 className="font-heading text-sm font-bold">Organizatie</h2>

        <label htmlFor="admin-org-name" className={label}>Nume organizatie *</label>
        <input
          id="admin-org-name"
          className={input}
          value={form.org_name}
          onChange={setField("org_name")}
          autoComplete="organization"
        />

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-org-legal-name" className={label}>Denumire legala</label>
            <input
              id="admin-org-legal-name"
              className={input}
              value={form.legal_name}
              onChange={setField("legal_name")}
            />
          </div>
          <div>
            <label htmlFor="admin-org-website" className={label}>Website organizatie</label>
            <input
              id="admin-org-website"
              type="url"
              inputMode="url"
              className={input}
              value={form.org_website}
              onChange={setField("org_website")}
              placeholder="https://..."
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard className="p-4 sm:p-5">
        <h2 className="font-heading text-sm font-bold">Locatie</h2>

        <label htmlFor="admin-location-name" className={label}>Nume locatie *</label>
        <input
          id="admin-location-name"
          className={input}
          value={form.name}
          onChange={setField("name")}
        />

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-provider-type" className={label}>Tip furnizor *</label>
            <select
              id="admin-provider-type"
              className={input}
              value={form.provider_type}
              onChange={setField("provider_type")}
            >
              <option value="">Alege...</option>
              {PROVIDER_TYPES_3C.map((type) => (
                <option key={type.key} value={type.key}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-profile-type" className={label}>Tip profil furnizor *</label>
            <select
              id="admin-profile-type"
              className={input}
              value={form.provider_profile_type}
              onChange={setField("provider_profile_type")}
            >
              <option value="">Alege...</option>
              {PROVIDER_PROFILE_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}{type.is_b2b ? " — B2B, invizibil pentru pacienti" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={label}>Localitate (geografie canonica) *</label>
        <LocalityAutocomplete
          value={form.locality_siruta_code
            ? { display_label: `${form.city}${form.county ? `, ${form.county}` : ""}` }
            : null}
          onSelect={(locality) => setForm((current) => ({
            ...current,
            locality_siruta_code: locality?.siruta_code || "",
            city: locality?.name || "",
            county: locality?.county_name || "",
          }))}
        />

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-location-city" className={label}>Oras (oglinda)</label>
            <input id="admin-location-city" className={input} value={form.city} readOnly />
          </div>
          <div>
            <label htmlFor="admin-location-county" className={label}>Judet (oglinda)</label>
            <input id="admin-location-county" className={input} value={form.county} readOnly />
          </div>
        </div>

        <label htmlFor="admin-location-address" className={label}>Adresa *</label>
        <input
          id="admin-location-address"
          className={input}
          value={form.address}
          onChange={setField("address")}
          autoComplete="street-address"
        />
      </AdminCard>

      <AdminCard className="p-4 sm:p-5">
        <h2 className="font-heading text-sm font-bold">Date publice si provenienta</h2>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-location-phone" className={label}>Telefon public</label>
            <input
              id="admin-location-phone"
              type="tel"
              inputMode="tel"
              className={input}
              value={form.phone_public}
              onChange={setField("phone_public")}
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="admin-location-email" className={label}>Email public</label>
            <input
              id="admin-location-email"
              type="email"
              inputMode="email"
              className={input}
              value={form.public_email}
              onChange={setField("public_email")}
              autoComplete="email"
            />
          </div>
        </div>

        <label htmlFor="admin-location-website" className={label}>Website locatie</label>
        <input
          id="admin-location-website"
          type="url"
          inputMode="url"
          className={input}
          value={form.website}
          onChange={setField("website")}
          placeholder="https://..."
        />

        <label htmlFor="admin-opening-hours" className={label}>Program (text)</label>
        <input
          id="admin-opening-hours"
          className={input}
          value={form.opening_hours}
          onChange={setField("opening_hours")}
          placeholder="Exemplu: L–V 09:00–18:00"
        />

        <label htmlFor="admin-location-description" className={label}>Descriere</label>
        <textarea
          id="admin-location-description"
          className={`${input} min-h-24 resize-y`}
          value={form.description}
          onChange={setField("description")}
        />

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Provenienta (obligatoriu)
          </h3>

          <label htmlFor="admin-source-url" className={label}>Sursa URL *</label>
          <input
            id="admin-source-url"
            type="url"
            inputMode="url"
            className={input}
            value={form.source_url}
            onChange={setField("source_url")}
            placeholder="https://..."
          />

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-source-type" className={label}>Tip sursa *</label>
              <select
                id="admin-source-type"
                className={input}
                value={form.source_type}
                onChange={setField("source_type")}
              >
                <option value="site_oficial">Site oficial</option>
                <option value="registru_public">Registru public</option>
                <option value="director_public">Director public</option>
                <option value="alta_sursa_publica">Alta sursa publica</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-source-date" className={label}>Verificat la data *</label>
              <input
                id="admin-source-date"
                type="date"
                className={input}
                value={form.source_checked_at}
                onChange={setField("source_checked_at")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-data-confidence" className={label}>Incredere date *</label>
              <select
                id="admin-data-confidence"
                className={input}
                value={form.data_confidence}
                onChange={setField("data_confidence")}
              >
                <option value="low">Scazuta</option>
                <option value="medium">Medie</option>
                <option value="high">Ridicata</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-source-name" className={label}>Nume sursa</label>
              <input
                id="admin-source-name"
                className={input}
                value={form.source_name}
                onChange={setField("source_name")}
              />
            </div>
          </div>

          <label htmlFor="admin-source-notes" className={label}>Note sursa</label>
          <textarea
            id="admin-source-notes"
            className={`${input} min-h-24 resize-y`}
            value={form.source_notes}
            onChange={setField("source_notes")}
          />
        </div>

        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={form.mark_active}
            onChange={setField("mark_active")}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="leading-relaxed">
            Marcheaza locatia ca activa. Daca nu este bifata, locatia ramane inactiva.
          </span>
        </label>
      </AdminCard>

      {identityCheck && (
        <AdminCard className="p-4 sm:p-5">
          <DirOpsIdentityCandidates
            check={identityCheck}
            reason={overrideReason}
            setReason={setOverrideReason}
            saving={saving}
            onContinue={(force) => submit(force)}
            onCancel={() => {
              setIdentityCheck(null);
              setOverrideReason("");
            }}
          />
        </AdminCard>
      )}

      <AdminCard className="p-4 sm:p-5">
        <h2 className="mb-3 font-heading text-sm font-bold">Revizuire si actiuni</h2>
        {message && (
          <p className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-destructive"}`}>
            {message.text}
          </p>
        )}
        {!identityCheck && (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={saving || requiredMissing}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:w-auto sm:rounded-md"
          >
            {saving ? "Se salveaza..." : "Creeaza profil directory"}
          </button>
        )}
        {requiredMissing && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Completeaza campurile obligatorii, inclusiv sursa URL si data verificarii sursei.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
