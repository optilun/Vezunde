import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EMPTY_DRAFT = { id: "", name: "", subject: "", body: "", campaign_type: "marketing" };

const MERGE_FIELDS = [
  { token: "[NUME]", desc: "Numele de contact (sau al firmei, daca nu exista)" },
  { token: "[FIRMA]", desc: "Numele firmei/locatiei" },
  { token: "[ORAS]", desc: "Localitatea" },
  { token: "[JUDET]", desc: "Judetul" },
  { token: "[UNSUBSCRIBE_LINK]", desc: "Loc unde apare linkul de dezabonare in corpul mesajului (optional - apare oricum in footer)" },
];

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
    if (!window.confirm("Stergi acest sablon?")) return;
    await base44.functions.invoke("outreachCampaignOps", { action: "delete_template", id }).catch(() => null);
    load();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Sabloane existente</h3>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se incarca...
          </div>
        )}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun sablon inca.</p>
        )}
        <div className="space-y-2">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.subject}</p>
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {template.campaign_type === "claim_notice" ? "Notificare revendicare" : "Marketing"}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, body: template.body, campaign_type: template.campaign_type || "marketing" })}
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
      </div>

      <div className="lg:col-span-3 space-y-3 rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{draft.id ? "Editeaza sablon" : "Sablon nou"}</h3>
          {draft.id && (
            <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className="text-xs font-semibold text-muted-foreground underline">
              Anuleaza editarea
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Nume intern</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Tip campanie</span>
          <select
            value={draft.campaign_type}
            onChange={(e) => setDraft((d) => ({ ...d, campaign_type: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="marketing">Marketing</option>
            <option value="claim_notice">Notificare revendicare</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Subiect email</span>
          <input
            type="text"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground">Continut</span>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={10}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono"
          />
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
          {draft.id ? "Salveaza modificarile" : "Creeaza sablonul"}
        </button>
      </div>
    </div>
  );
}
