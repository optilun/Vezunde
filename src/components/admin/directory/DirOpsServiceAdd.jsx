import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import { SERVICE_CATALOG_3C } from "@/lib/directoryOpsCatalog";

const input = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";

export default function DirOpsServiceAdd({ location, onAdded }) {
  const [key, setKey] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [confirmedAt, setConfirmedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [publiclyListed, setPubliclyListed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isSpecialized = SERVICE_CATALOG_3C.specialized_medical.some((service) => service.key === key);
  const missing = [!key && "serviciul", !sourceUrl && "sursa", !confirmedAt && "data verificării"].filter(Boolean);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await base44.functions.invoke("directoryOps", {
        action: "add_service",
        location_id: location.id,
        service_key: key,
        service_source_url: sourceUrl,
        service_confirmed_at: confirmedAt ? new Date(confirmedAt).toISOString() : "",
        notes,
        set_publicly_listed: publiclyListed,
      });
      if (response?.data?.error) throw new Error(response.data.error);
      setKey("");
      setSourceUrl("");
      setConfirmedAt("");
      setNotes("");
      setPubliclyListed(false);
      setMessage({ ok: true, text: "Serviciu adăugat." });
      onAdded();
    } catch (error) {
      setMessage({ ok: false, text: error.response?.data?.error || error.message });
    }
    setSaving(false);
  };

  return (
    <div className="mt-4">
      <div>
        <label htmlFor="admin-service-key" className="text-xs font-semibold text-muted-foreground">
          Serviciu din catalog *
        </label>
        <select
          id="admin-service-key"
          className={`${input} mt-1.5`}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        >
          <option value="">Alege serviciul…</option>
          <optgroup label="General">
            {SERVICE_CATALOG_3C.general.map((service) => (
              <option key={service.key} value={service.key}>{service.label}</option>
            ))}
          </optgroup>
          <optgroup label="Tehnic">
            {SERVICE_CATALOG_3C.technical.map((service) => (
              <option key={service.key} value={service.key}>{service.label}</option>
            ))}
          </optgroup>
          <optgroup label="Medical specializat">
            {SERVICE_CATALOG_3C.specialized_medical.map((service) => (
              <option key={service.key} value={service.key}>{service.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-service-source" className="text-xs font-semibold text-muted-foreground">
            Sursa oficială a serviciului *
          </label>
          <input
            id="admin-service-source"
            type="url"
            inputMode="url"
            className={`${input} mt-1.5`}
            placeholder="https://…"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="admin-service-confirmed-at" className="text-xs font-semibold text-muted-foreground">
            Data verificării *
          </label>
          <input
            id="admin-service-confirmed-at"
            className={`${input} mt-1.5`}
            type="date"
            value={confirmedAt}
            onChange={(event) => setConfirmedAt(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="admin-service-notes" className="text-xs font-semibold text-muted-foreground">
          Note interne
        </label>
        <textarea
          id="admin-service-notes"
          className={`${input} mt-1.5 min-h-20 resize-y`}
          placeholder="Detalii despre sursă sau verificare…"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-3 text-sm">
        <input
          type="checkbox"
          checked={publiclyListed}
          onChange={(event) => setPubliclyListed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="leading-relaxed">
          Marchează ca listat public <span className="text-muted-foreground">(cere o sursă oficială verificabilă)</span>
        </span>
      </label>

      {isSpecialized && publiclyListed && (
        <AdminNotice tone="warning" className="mt-3">
          Serviciile medicale specializate rămân excluse din recomandări până la verificarea VIASEE, chiar dacă sunt listate public.
        </AdminNotice>
      )}

      {message && (
        <AdminNotice tone={message.ok ? "success" : "danger"} className="mt-3">{message.text}</AdminNotice>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving || missing.length > 0}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:w-auto sm:rounded-md"
        >
          {saving ? "Se salvează…" : "Adaugă serviciul"}
        </button>
        {missing.length > 0 && (
          <span className="text-xs text-muted-foreground">Completează: {missing.join(", ")}.</span>
        )}
      </div>
    </div>
  );
}
