import React, { useEffect, useState } from "react";
import { Globe2, Save, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40";

const CONTACT_FIELDS = [
  { key: "public_phone", label: "Telefon public", type: "tel", placeholder: "+40 7xx xxx xxx" },
  { key: "public_email", label: "Email public", type: "email", placeholder: "contact@exemplu.ro" },
];

const ONLINE_FIELDS = [
  { key: "website_url", label: "Website", placeholder: "https://exemplu.ro" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/..." },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ApplicantProfileDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((item) => item.section === "public_profile");
    setDraft(existing || null);
    try {
      setValues(existing ? JSON.parse(existing.payload_json || "{}") : {});
    } catch (_error) {
      setValues({});
    }
  }, [workspace]);

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      section: "public_profile",
      payload: values,
      claim_request_id: workspace.claim?.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Draftul profilului a fost salvat.");
    await onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Pregătește informațiile care vor descrie organizația. Nimic nu devine public înainte de confirmarea accesului și verificarea VIASEE.
        </p>
        <div className="mt-3"><DraftBadge /></div>
      </header>

      <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><UserRound className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">Descrierea organizației</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Scrie clar ce tip de locație este, cui se adresează și ce poate găsi un client sau pacient aici.</p>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Descriere publică" hint={`${String(values.public_description || "").length}/1200 caractere`}>
            <textarea
              className={inputCls}
              rows={6}
              maxLength={1200}
              value={values.public_description || ""}
              onChange={(event) => setField("public_description", event.target.value)}
              placeholder="Exemplu: Optică medicală cu servicii de evaluare optometrică, ochelari și reglaje..."
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Globe2 className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">Contact și prezență online</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Adaugă doar datele pe care vrei să le afișezi public după aprobare.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CONTACT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              <input
                type={field.type}
                className={inputCls}
                value={values[field.key] || ""}
                onChange={(event) => setField(field.key, event.target.value)}
                placeholder={field.placeholder}
              />
            </Field>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Linkuri publice</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {ONLINE_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  type="url"
                  className={inputCls}
                  value={values[field.key] || ""}
                  onChange={(event) => setField(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-20 rounded-[20px] border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto"
        >
          <Save className="h-4 w-4" /> {saving ? "Se salvează..." : "Salvează draftul"}
        </button>
        {msg && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}
