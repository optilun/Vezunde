import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Save, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS, getServiceGroupLayout } from "@/lib/canonicalServiceCatalog";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

const BACKEND_SERVICE_GROUPS = {
  patient_services: new Set(["eyeglasses", "frames", "prescription_lenses", "contact_lenses", "optometry_consultation", "ophthalmology_consultation"]),
  investigations: new Set(["oct", "visual_field_analyzer", "fundus_camera", "pachymeter", "biometer", "corneal_topography"]),
  specialties: new Set(["retina_consultation", "glaucoma_consultation", "cataract_surgery", "refractive_surgery", "pediatric_ophthalmology", "myopia_management", "emergency_ophthalmology"]),
  technical_activities: new Set(["eyeglasses_adjustment", "eyeglasses_repair", "lens_fitting"]),
};

const BACKEND_GROUP_BY_UI_GROUP = {
  optical_retail: "patient_services",
  lenses_and_measurements: "patient_services",
  optometry: "patient_services",
  contact_lenses: "patient_services",
  ophthalmology_consults: "patient_services",
  investigations: "investigations",
  specialties: "specialties",
  procedures_surgery: "specialties",
  children_and_prevention: "specialties",
  technical_activities: "technical_activities",
};

function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function countSelected(selected) {
  return Object.values(selected || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function labelForService(group, id) {
  return SERVICE_GROUPS[group]?.ids?.[id] || id;
}

function normalizeSuggestions(payload = {}) {
  if (Array.isArray(payload.suggestions)) return payload.suggestions;
  if (Array.isArray(payload.custom_requests)) {
    return payload.custom_requests.map((item) => ({
      group: BACKEND_GROUP_BY_UI_GROUP[item.group] || "patient_services",
      label: item.label || "",
      note: item.note || "",
    })).filter((item) => item.label);
  }
  return [];
}

function makeSuggestion(group, label) {
  return { group: BACKEND_GROUP_BY_UI_GROUP[group] || "patient_services", label, note: "Propus din workspace furnizor" };
}

function buildBackendPayload(selected, customRequests) {
  const selectedIds = { patient_services: [], investigations: [], specialties: [], technical_activities: [] };
  const suggestions = [...customRequests];

  Object.entries(selected || {}).forEach(([uiGroup, ids]) => {
    const backendGroup = BACKEND_GROUP_BY_UI_GROUP[uiGroup] || "patient_services";
    const allowed = BACKEND_SERVICE_GROUPS[backendGroup] || new Set();
    (ids || []).forEach((id) => {
      if (allowed.has(id)) selectedIds[backendGroup].push(id);
      else suggestions.push({ group: backendGroup, label: labelForService(uiGroup, id), note: `Serviciu din catalog extins: ${id}` });
    });
  });

  const uniqueSelected = Object.fromEntries(Object.entries(selectedIds).map(([group, ids]) => [group, [...new Set(ids)]]));
  const uniqueSuggestions = [];
  const seen = new Set();
  for (const suggestion of suggestions) {
    const group = suggestion.group || "patient_services";
    const label = normalizeText(suggestion.label);
    if (!label) continue;
    const key = `${group}:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSuggestions.push({ group, label, note: suggestion.note || "" });
  }

  return { selected_ids: uniqueSelected, removal_ids: {}, suggestions: uniqueSuggestions };
}

function GroupCard({ groupKey, def, selectedIds, customItems, pendingReview, onToggle, onAddCustom, onRemoveCustom, compact = false }) {
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
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-3" : "p-4"} shadow-sm`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{def.label}</h3>
          {def.helper && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{def.helper}</p>}
        </div>
        <button type="button" disabled={pendingReview} onClick={() => setShowCustom((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Propune serviciu
        </button>
      </div>

      {showCustom && (
        <div className="mb-3 rounded-2xl border border-dashed border-border bg-secondary/35 p-3">
          <label className="text-xs font-semibold text-muted-foreground">Serviciu care lipseste din lista</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input className={inputCls} value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Ex: consult cornee, adaptare lentile sclerale, investigatie specifica..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitCustom(); } }} />
            <button type="button" onClick={submitCustom} className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background">Adauga in draft</button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Serviciile propuse manual sunt trimise la verificare inainte de publicare.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(def.ids).map(([id, label]) => {
          const active = selectedIds.includes(id);
          return (
            <button key={id} type="button" disabled={pendingReview} onClick={() => onToggle(groupKey, id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>
              {label}
            </button>
          );
        })}
      </div>

      {customItems.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Propuse manual</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {customItems.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900">
                {item.label}
                {!pendingReview && <button type="button" onClick={() => onRemoveCustom(groupKey, index)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="Sterge serviciul"><X className="h-3 w-3" /></button>}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function GroupList({ groups, selected, customByGroup, pendingReview, onToggle, onAddCustom, onRemoveCustom, compact }) {
  return <div className="space-y-3">{groups.map((group) => <GroupCard key={group} groupKey={group} def={SERVICE_GROUPS[group]} selectedIds={selected[group] || []} customItems={customByGroup[BACKEND_GROUP_BY_UI_GROUP[group] || group] || customByGroup[group] || []} pendingReview={pendingReview} onToggle={onToggle} onAddCustom={onAddCustom} onRemoveCustom={onRemoveCustom} compact={compact} />)}</div>;
}

export default function ProviderServices({ locationId, location, overview, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [customRequests, setCustomRequests] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const profileType = location?.provider_profile_type || overview?.location?.provider_profile_type || "";
  const providerType = location?.provider_type || overview?.location?.provider_type || "";
  const layout = useMemo(() => getServiceGroupLayout(profileType, providerType), [profileType, providerType]);
  const primaryGroups = layout.primary.filter((group) => SERVICE_GROUPS[group]);
  const secondaryGroups = layout.secondary.filter((group) => SERVICE_GROUPS[group]);

  const approvedCount = overview?.content_summary?.approved_service_count ?? 0;
  const pendingReview = draft?.status === "pending_review";
  const selectedCount = countSelected(selected) + customRequests.length;

  const customByGroup = useMemo(() => {
    const map = {};
    for (const item of customRequests) {
      const group = item.group || "patient_services";
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
    setSelected(payload.ui_selected_ids || payload.selected_ids || {});
    setCustomRequests(normalizeSuggestions(payload));
  };

  useEffect(() => { load(); setShowMore(false); }, [locationId]);

  const toggle = (group, id) => {
    if (pendingReview) return;
    const current = new Set(selected[group] || []);
    current.has(id) ? current.delete(id) : current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const addCustom = (group, label) => {
    if (pendingReview) return;
    const suggestion = makeSuggestion(group, label);
    const exists = customRequests.some((item) => item.group === suggestion.group && item.label.toLowerCase() === suggestion.label.toLowerCase());
    if (exists) return;
    setCustomRequests([...customRequests, suggestion]);
  };

  const removeCustom = (group, indexInGroup) => {
    if (pendingReview) return;
    const backendGroup = BACKEND_GROUP_BY_UI_GROUP[group] || group;
    let seen = -1;
    setCustomRequests(customRequests.filter((item) => {
      if (item.group !== backendGroup) return true;
      seen += 1;
      return seen !== indexInGroup;
    }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = { ...buildBackendPayload(selected, customRequests), ui_selected_ids: selected };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: locationId, section: "services", payload }).catch((e) => ({ data: { error: e.response?.data?.error || e.message, fields: e.response?.data?.fields || [] } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.fields?.length ? `${res.data.error}: ${res.data.fields.join(", ")}` : res.data.error); return; }
    setMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    load();
    onRefresh && onRefresh();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
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
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii disponibile in locatie</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Selecteaza serviciile pe care clientii sau pacientii le pot accesa in acest punct de lucru. Lista principala este adaptata tipului de profil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{approvedCount} publicate</span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{selectedCount} selectate</span>
        </div>
      </div>

      {pendingReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Exista o cerere trimisa spre review. Editarea este blocata pana la decizia adminului.</div>}

      <GroupList groups={primaryGroups} selected={selected} customByGroup={customByGroup} pendingReview={pendingReview} onToggle={toggle} onAddCustom={addCustom} onRemoveCustom={removeCustom} />

      {secondaryGroups.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <div>
              <div className="text-sm font-bold">Alte servicii disponibile</div>
              <p className="mt-1 text-xs text-muted-foreground">Categorii suplimentare. Deschide doar daca locatia ofera si aceste servicii.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold">{showMore ? "Ascunde" : "Afiseaza"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} /></span>
          </button>
          {showMore && <div className="space-y-3 border-t border-border p-4"><GroupList groups={secondaryGroups} selected={selected} customByGroup={customByGroup} pendingReview={pendingReview} onToggle={toggle} onAddCustom={addCustom} onRemoveCustom={removeCustom} compact /></div>}
        </section>
      )}

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={saving || pendingReview} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salveaza draft</button>
          {draft && draft.status !== "pending_review" && <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite spre review</button>}
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
