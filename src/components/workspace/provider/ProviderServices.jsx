import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function countSelected(selected) {
  return Object.values(selected || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function GroupCard({ groupKey, def, selectedIds, customItems, pendingReview, onToggle, onAddCustom, onRemoveCustom }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const submitCustom = () => {
    const label = normalizeText(customLabel);
    if (!label) return;
    onAddCustom(groupKey, label);
    setCustomLabel("");
    setShowCustom(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{def.label}</h3>
          {def.helper && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{def.helper}</p>}
        </div>
        <button
          type="button"
          disabled={pendingReview}
          onClick={() => setShowCustom((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Adauga serviciu
        </button>
      </div>

      {showCustom && (
        <div className="mb-3 rounded-2xl border border-dashed border-border bg-secondary/35 p-3">
          <label className="text-xs font-semibold text-muted-foreground">Serviciu lipsa din lista</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Ex: adaptare lentile sclerale, consult cornee, service aparat..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitCustom(); } }}
            />
            <button type="button" onClick={submitCustom} className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background">Adauga</button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Serviciile adaugate manual vor fi trimise la review. Dupa validare pot deveni optiuni standard in catalog.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(def.ids).map(([id, label]) => {
          const active = selectedIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={pendingReview}
              onClick={() => onToggle(groupKey, id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {customItems.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Adaugate manual</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {customItems.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900">
                {item.label}
                {!pendingReview && (
                  <button type="button" onClick={() => onRemoveCustom(groupKey, index)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="Sterge serviciul">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ProviderServices({ locationId, overview, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [customRequests, setCustomRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const approvedCount = overview?.content_summary?.approved_service_count ?? 0;
  const pendingReview = draft?.status === "pending_review";
  const selectedCount = countSelected(selected) + customRequests.length;

  const customByGroup = useMemo(() => {
    const map = {};
    for (const item of customRequests) {
      const group = item.group || "other";
      map[group] = map[group] || [];
      map[group].push(item);
    }
    return map;
  }, [customRequests]);

  const load = async () => {
    if (!locationId) return;
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    const payload = safeParse(own?.payload_json);
    setDraft(own || null);
    setSelected(payload.selected_ids || {});
    setCustomRequests(Array.isArray(payload.custom_requests) ? payload.custom_requests : []);
  };

  useEffect(() => { load(); }, [locationId]);

  const toggle = (group, id) => {
    if (pendingReview) return;
    const current = new Set(selected[group] || []);
    current.has(id) ? current.delete(id) : current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const addCustom = (group, label) => {
    if (pendingReview) return;
    const exists = customRequests.some((item) => item.group === group && item.label.toLowerCase() === label.toLowerCase());
    if (exists) return;
    setCustomRequests([...customRequests, { group, label, status: "requested" }]);
  };

  const removeCustom = (group, indexInGroup) => {
    if (pendingReview) return;
    let seen = -1;
    setCustomRequests(customRequests.filter((item) => {
      if (item.group !== group) return true;
      seen += 1;
      return seen !== indexInGroup;
    }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = { selected_ids: selected, custom_requests: customRequests };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      location_id: locationId,
      section: "services",
      payload,
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    load();
    onRefresh && onRefresh();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action: "submit",
      submission_id: draft.id,
      location_id: locationId,
      section: "services",
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Serviciile au fost trimise spre review.");
    load();
    onRefresh && onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii si activitati</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Alege serviciile disponibile in aceasta locatie. Serviciile medicale sau adaugate manual raman supuse verificarii inainte de publicare.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{approvedCount} publicate</span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{selectedCount} selectate</span>
        </div>
      </div>

      {pendingReview && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Exista o cerere trimisa spre review. Editarea este blocata pana la decizia adminului.
        </div>
      )}

      {Object.entries(SERVICE_GROUPS).map(([group, def]) => (
        <GroupCard
          key={group}
          groupKey={group}
          def={def}
          selectedIds={selected[group] || []}
          customItems={customByGroup[group] || []}
          pendingReview={pendingReview}
          onToggle={toggle}
          onAddCustom={addCustom}
          onRemoveCustom={removeCustom}
        />
      ))}

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={saving || pendingReview} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
            <Save className="h-4 w-4" /> Salveaza draft
          </button>
          {draft && draft.status !== "pending_review" && (
            <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
              <Send className="h-4 w-4" /> Trimite spre review
            </button>
          )}
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
