import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_OPTIONS, CATEGORY_LABELS, categoryBadgeClass, normalizeCategory } from "./outreachLabels";

// Un sablon descrie emailul complet (categorie, subiect, text, buton, fisa din director), ca o
// campanie noua sa porneasca direct din el. Sabloanele sunt grupate pe categorii: o campanie de
// anunturi vede doar sabloanele de anunturi.
const EMPTY_DRAFT = {
  id: "",
  name: "",
  category: "marketing",
  subject: "",
  body: "",
  cta_label: "",
  cta_url: "",
  show_listing_preview: true,
};

const MERGE_FIELDS = [
  { token: "[NUME]", desc: "Numele de contact (sau al firmei, daca nu exista)" },
  { token: "[FIRMA]", desc: "Numele firmei/locatiei" },
  { token: "[ORAS]", desc: "Localitatea" },
  { token: "[LOCATII]", desc: "Cate locatii folosesc adresa: \"o locatie\", \"5 locatii\", \"79 de locatii\"" },
  { token: "[ORASE]", desc: "Orasul, daca toate locatiile sunt in acelasi oras; altfel \"34 de orase\"" },
  { token: "[JUDET]", desc: "Judetul" },
  { token: "[UNSUBSCRIBE_LINK]", desc: "Loc unde apare linkul de dezabonare in corpul mesajului (optional - apare oricum in footer)" },
];

function draftFromTemplate(template) {
  return {
    id: template.id,
    name: template.name || "",
    category: normalizeCategory(template.category),
    subject: template.subject || "",
    body: template.body || "",
    cta_label: template.cta_label || "",
    cta_url: template.cta_url || "",
    show_listing_preview: template.show_listing_preview !== false,
  };
}

export default function OutreachTemplateEditor() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    const response = await base44.functions.invoke("outreachCampaignOps", { action: "list_templates" })
      .catch((err) => ({ data: { error: err.response?.data?.error || err.message } }));
    setLoading(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setTemplates(response.data?.templates || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      setError("Nume, subiect si continut sunt obligatorii.");
      return;
    }
    setSaving(true);
    setError("");
    const action = draft.id ? "update_template" : "create_template";
    const response = await base44.functions.invoke("outreachCampaignOps", { action, ...draft })
      .catch((err) => ({ data: { error: err.response?.data?.error || err.message } }));
    setSaving(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setDraft(EMPTY_DRAFT);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Stergi acest sablon? Campaniile pornite din el isi pastreaza textul.")) return;
    await base44.functions.invoke("outreachCampaignOps", { action: "delete_template", id }).catch(() => null);
    load();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <h3 className="text-sm font-bold text-foreground">Sabloane existente</h3>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se incarca...
          </div>
        )}
        {CATEGORY_OPTIONS.map((option) => {
          const group = templates.filter((template) => normalizeCategory(template.category) === option.value);
          return (
            <div key={option.value} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{option.label} ({group.length})</p>
              {!loading && group.length === 0 && (
                <p className="text-xs text-muted-foreground">Niciun sablon in aceasta categorie.</p>
              )}
              {group.map((template) => (
                <div key={template.id} className={`rounded-xl border p-3 ${draft.id === template.id ? "border-foreground" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{template.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                      {template.cta_label && <p className="text-[11px] text-muted-foreground">Buton: {template.cta_label}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setDraft(draftFromTemplate(template))}
                        className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                      >
                        Editeaza
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(template.id)}
                        className="rounded-full border border-border p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Sterge sablon"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl border border-border p-5 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{draft.id ? "Editeaza sablon" : "Sablon nou"}</h3>
          {draft.id && (
            <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className="text-xs font-semibold text-muted-foreground underline">
              Anuleaza editarea
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div>
          <span className="text-xs font-semibold text-foreground">Categorie</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, category: option.value, show_listing_preview: option.value === "marketing" ? d.show_listing_preview : false }))}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${draft.category === option.value ? categoryBadgeClass(option.value) : "border-border hover:bg-secondary"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {CATEGORY_OPTIONS.find((option) => option.value === draft.category)?.description}
          </span>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Nume intern</span>
          <input
            id="outreach-template-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Subiect email</span>
          <input
            id="outreach-template-subject"
            type="text"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Continut</span>
          <textarea
            id="outreach-template-body"
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={10}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Text buton (optional)</span>
            <input
              id="outreach-template-cta-label"
              type="text"
              value={draft.cta_label}
              placeholder="Revendica profilul"
              onChange={(e) => setDraft((d) => ({ ...d, cta_label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Link buton</span>
            <input
              id="outreach-template-cta-url"
              type="text"
              value={draft.cta_url}
              placeholder="https://viasee.ro/adauga-sau-revendica"
              onChange={(e) => setDraft((d) => ({ ...d, cta_url: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={draft.show_listing_preview}
            onChange={(e) => setDraft((d) => ({ ...d, show_listing_preview: e.target.checked }))}
            className="mt-0.5"
          />
          <span className="text-xs text-foreground">
            Arata fisa destinatarului din director
            <span className="block text-[11px] text-muted-foreground">Potrivit pentru invitatiile la revendicare; de obicei nu si pentru anunturi.</span>
          </span>
        </label>

        <div className="rounded-lg bg-secondary/60 p-3 text-[11px] text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Variabile disponibile:</p>
          <ul className="space-y-0.5">
            {MERGE_FIELDS.map((field) => (
              <li key={field.token}>
                <code className="rounded bg-background px-1 py-0.5">{field.token}</code> — {field.desc}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {draft.id ? "Salveaza modificarile" : `Creeaza sablonul (${CATEGORY_LABELS[draft.category]})`}
        </button>
      </div>
    </div>
  );
}
