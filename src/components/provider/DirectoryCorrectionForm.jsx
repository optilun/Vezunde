import React, { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const REQUEST_TYPES = [
  { value: "incorrect_information", label: "Informatii incorecte" },
  { value: "location_closed", label: "Locatia este inchisa" },
  { value: "location_moved", label: "Locatia s-a mutat" },
  { value: "duplicate_profile", label: "Profil duplicat" },
  { value: "wrong_organization", label: "Organizatie asociata gresit" },
  { value: "personal_data_removal", label: "Eliminarea unor date personale" },
  { value: "other", label: "Alta problema" },
];

const RELATIONSHIPS = [
  { value: "customer", label: "Client / vizitator" },
  { value: "owner", label: "Proprietar" },
  { value: "organization_representative", label: "Reprezentant al organizatiei" },
  { value: "employee", label: "Angajat" },
  { value: "professional", label: "Specialist asociat" },
  { value: "other", label: "Alta relatie" },
];

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

function evidenceLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export default function DirectoryCorrectionForm({ location, onClose }) {
  const [form, setForm] = useState({
    request_type: "incorrect_information",
    relationship: "customer",
    contact_name: "",
    contact_email: "",
    explanation: "",
    evidence_urls: "",
    privacy_confirmed: false,
    company_website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const response = await base44.functions.invoke("submitDirectoryCorrection", {
      location_id: location?.id,
      request_type: form.request_type,
      relationship: form.relationship,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      explanation: form.explanation,
      evidence_urls: evidenceLines(form.evidence_urls),
      privacy_confirmed: form.privacy_confirmed,
      company_website: form.company_website,
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message || "Sesizarea nu a putut fi trimisa" },
    }));
    setSubmitting(false);

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setResult({
      reference: response.data?.reference,
      duplicate: response.data?.duplicate === true,
      emailSent: response.data?.confirmation_email_sent === true,
    });
  };

  if (result) {
    return (
      <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-950">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">Sesizarea a fost inregistrata</h3>
            <p className="mt-1 text-xs leading-relaxed">
              {result.duplicate
                ? "Exista deja o sesizare activa similara. Am pastrat aceeasi referinta."
                : "VIASEE va verifica informatia si sursele transmise. Profilul nu este modificat automat."}
            </p>
            {result.reference && (
              <p className="mt-3 rounded-xl bg-white/75 px-3 py-2 font-mono text-xs font-semibold">Referinta: {result.reference}</p>
            )}
            {!result.emailSent && <p className="mt-2 text-[11px] leading-relaxed">Confirmarea prin email nu a putut fi trimisa, dar sesizarea a fost salvata.</p>}
            <button type="button" onClick={onClose} className="mt-3 text-xs font-semibold underline underline-offset-4">Inchide</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Semnaleaza o problema</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cererea este legata automat de acest profil. Nu include date medicale sau alte informatii sensibile care nu sunt necesare.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Inchide formularul" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted-foreground">
          Tipul problemei
          <select value={form.request_type} onChange={(event) => update("request_type", event.target.value)} className={`${inputClass} mt-1.5`}>
            {REQUEST_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Relatia cu locatia
          <select value={form.relationship} onChange={(event) => update("relationship", event.target.value)} className={`${inputClass} mt-1.5`}>
            {RELATIONSHIPS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Nume
          <input value={form.contact_name} onChange={(event) => update("contact_name", event.target.value)} maxLength={120} autoComplete="name" className={`${inputClass} mt-1.5`} required />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Email
          <input type="email" value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} maxLength={200} autoComplete="email" className={`${inputClass} mt-1.5`} required />
        </label>
      </div>

      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Ce trebuie verificat sau corectat?
        <textarea value={form.explanation} onChange={(event) => update("explanation", event.target.value)} minLength={20} maxLength={2000} rows={5} className={`${inputClass} mt-1.5 resize-y`} required />
      </label>

      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Linkuri catre surse sau dovezi publice, cate unul pe rand
        <textarea value={form.evidence_urls} onChange={(event) => update("evidence_urls", event.target.value)} rows={3} className={`${inputClass} mt-1.5 resize-y`} placeholder="https://site-oficial.ro/contact" />
        <span className="mt-1 inline-flex items-center gap-1 font-normal"><ExternalLink className="h-3 w-3" /> Maximum 5 linkuri HTTP/HTTPS.</span>
      </label>

      <input tabIndex={-1} aria-hidden="true" autoComplete="off" value={form.company_website} onChange={(event) => update("company_website", event.target.value)} className="hidden" />

      <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input type="checkbox" checked={form.privacy_confirmed} onChange={(event) => update("privacy_confirmed", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" required />
        <span>Confirm ca datele de contact sunt folosite pentru verificarea si solutionarea acestei sesizari. Inteleg ca trimiterea nu modifica automat profilul.</span>
      </label>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-50 sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? "Se trimite..." : "Trimite sesizarea"}
      </button>
    </form>
  );
}
