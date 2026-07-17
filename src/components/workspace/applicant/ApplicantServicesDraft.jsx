import React, { useEffect, useMemo, useState } from "react";
import { Check, Save, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";
import { SERVICE_GROUPS, CLAIM_PREP_SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";

function countSelected(selected) {
  return Object.values(selected || {}).reduce((total, items) => total + (items?.length || 0), 0);
}

export default function ApplicantServicesDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const selectedCount = useMemo(() => countSelected(selected), [selected]);

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((item) => item.section === "services");
    setDraft(existing || null);
    try {
      const payload = existing ? JSON.parse(existing.payload_json || "{}") : {};
      setSelected(payload.selected_ids || {});
    } catch (_error) {
      setSelected({});
    }
  }, [workspace]);

  const toggle = (group, id) => {
    const current = new Set(selected[group] || []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      section: "services",
      claim_request_id: workspace.claim?.id,
      payload: { selected_ids: selected },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Draftul serviciilor a fost salvat.");
    await onRefresh?.();
  };

  return (
    <div className="space-y-5 pb-20">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Selectează numai serviciile pe care locația le oferă în mod real. După confirmarea accesului vei putea adăuga detalii, spații, dotări și specialiști.
          </p>
          <div className="mt-3"><DraftBadge /></div>
        </div>
        <span className="w-fit rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{selectedCount} selectate</span>
      </header>

      <div className="space-y-4">
        {CLAIM_PREP_SERVICE_GROUPS.map((group) => {
          const config = SERVICE_GROUPS[group];
          const selectedInGroup = selected[group] || [];
          return (
            <section key={group} className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Wrench className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold">{config.label}</h2>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{selectedInGroup.length} selectate</span>
                  </div>
                  {config.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{config.description}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(config.ids).map(([id, label]) => {
                  const active = selectedInGroup.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(group, id)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${active ? "border-foreground bg-secondary text-foreground" : "border-border bg-background text-foreground hover:bg-secondary/50"}`}
                    >
                      <span>{label}</span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}>
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-20 rounded-[20px] border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{selectedCount > 0 ? `${selectedCount} servicii pregătite în draft` : "Nu ai selectat încă servicii"}</span>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" /> {saving ? "Se salvează..." : "Salvează draftul"}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}
