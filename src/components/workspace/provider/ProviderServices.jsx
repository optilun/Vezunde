import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Save, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import {
  CLIENT_NEED_SECTIONS,
  getSectionSelectedCount,
} from "@/lib/servicePresentation";
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

function normalizeSuggestions(payload = {}) {
  if (Array.isArray(payload.suggestions)) return payload.suggestions;
  if (Array.isArray(payload.custom_requests)) return payload.custom_requests;
  return [];
}

function makeSuggestion(group, label) {
  return { group, label, note: "Propus din workspace furnizor" };
}

function normalizeSelectedPayload(selected = {}) {
  const result = {};
  Object.entries(selected).forEach(([group, ids]) => {
    if (!SERVICE_GROUPS[group]) return;
    const allowedIds = new Set(Object.keys(SERVICE_GROUPS[group].ids || {}));
    const cleanIds = [...new Set((ids || []).filter((id) => allowedIds.has(id)))];
    if (cleanIds.length > 0) result[group] = cleanIds;
  });
  return result;
}

function buildPayload(selected, customRequests) {
  const selectedIds = normalizeSelectedPayload(selected);
  const suggestions = [];
  const seen = new Set();
  for (const item of customRequests || []) {
    const group = SERVICE_GROUPS[item.group] ? item.group : "optical_retail";
    const label = normalizeText(item.label);
    if (!label) continue;
    const key = `${group}:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ group, label, note: item.note || "" });
  }
  return { selected_ids: selectedIds, removal_ids: {}, suggestions };
}

function sectionDefaultGroup(section) {
  return section?.items?.[0]?.group || "optical_retail";
}

function sectionGroups(section) {
  return [...new Set((section?.items || []).map((item) => item.group))];
}

function customItemsForSection(customByGroup, section) {
  return sectionGroups(section).flatMap((group) => (customByGroup[group] || []).map((item, index) => ({ ...item, group, indexInGroup: index })));
}

function NeedOverview({ selected, activeKey, onPick }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold tracking-tight">Ce se poate face in aceasta locatie?</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Alege pe rand zonele care se aplica. Detaliile ajuta recomandarea, iar clientul vede doar categorii simple.
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">recomandare mai buna</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CLIENT_NEED_SECTIONS.map((section) => {
          const count = getSectionSelectedCount(selected, section);
          const active = count > 0;
          const focused = activeKey === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onPick(section.key)}
              className={`rounded-2xl border p-3 text-left transition-colors ${focused ? "border-foreground bg-secondary" : active ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/35 hover:border-foreground/30"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{section.title}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${active && !focused ? "text-background/75" : "text-muted-foreground"}`}>Clientul vede: {section.publicLabel}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${active && !focused ? "bg-background text-foreground" : "bg-card text-muted-foreground"}`}>{count}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NeedSectionCard({ section, selected, customByGroup, pendingReview, onToggle, onAddCustom, onRemoveCustom, defaultOpen = false, forceOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const selectedCount = getSectionSelectedCount(selected, section);
  const isOpen = forceOpen || open || selectedCount > 0;
  const customItems = customItemsForSection(customByGroup, section);

  const submitCustom = () => {
    const label = normalizeText(customLabel);
    if (!label) return;
    onAddCustom(sectionDefaultGroup(section), label);
    setCustomLabel("");
    setShowCustom(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{section.title}</h3>
            {selectedCount > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{selectedCount}</span>}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{section.description}</p>
          <div className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Clientul vede: {section.publicLabel}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold">
          {isOpen ? "Ascunde" : "Detalii"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {section.note && <p className="mt-3 rounded-2xl bg-secondary/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{section.note}</p>}

      {isOpen && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Detalii care ajuta recomandarea</div>
          <div className="flex flex-wrap gap-2">
            {section.items.map((item) => {
              const label = SERVICE_GROUPS[item.group]?.ids?.[item.id] || item.id;
              const active = (selected[item.group] || []).includes(item.id);
              return (
                <button
                  key={`${item.group}:${item.id}`}
                  type="button"
                  disabled={pendingReview}
                  onClick={() => onToggle(item.group, item.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={pendingReview} onClick={() => setShowCustom((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" /> Adauga alt serviciu
            </button>
          </div>

          {showCustom && (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/35 p-3">
              <label className="text-xs font-semibold text-muted-foreground">Alt serviciu care lipseste din lista</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input className={inputCls} value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Ex: service rapid rame, lentile speciale, consult pentru copii..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitCustom(); } }} />
                <button type="button" onClick={submitCustom} className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background">Adauga in draft</button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Serviciile adaugate manual sunt verificate inainte de publicare sau folosire in recomandari.</p>
            </div>
          )}

          {customItems.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Propuse manual</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {customItems.map((item) => (
                  <span key={`${item.group}-${item.label}-${item.indexInGroup}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900">
                    {item.label}
                    {!pendingReview && <button type="button" onClick={() => onRemoveCustom(item.group, item.indexInGroup)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="Sterge serviciul"><X className="h-3 w-3" /></button>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function ProviderServices({ locationId, location, overview }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [customRequests, setCustomRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeNeedKey, setActiveNeedKey] = useState(CLIENT_NEED_SECTIONS[0]?.key || "glasses_lenses");

  const approvedCount = overview?.content_summary?.approved_service_count ?? 0;
  const pendingReview = draft?.status === "pending_review";
  const selectedCount = countSelected(selected) + customRequests.length;

  const customByGroup = useMemo(() => {
    const map = {};
    for (const item of customRequests) {
      const group = SERVICE_GROUPS[item.group] ? item.group : "optical_retail";
      map[group] = map[group] || [];
      map[group].push(item);
    }
    return map;
  }, [customRequests]);

  const activeSection = CLIENT_NEED_SECTIONS.find((section) => section.key === activeNeedKey) || CLIENT_NEED_SECTIONS[0];

  const load = async () => {
    if (!locationId) return;
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const serviceSubmissions = (res.data?.submissions || []).filter((s) => s.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    const pending = serviceSubmissions.find((s) => s.status === "pending_review");
    const own = pending || serviceSubmissions.find((s) => ["draft", "needs_more_info"].includes(s.status));
    const payload = safeParse(own?.payload_json);
    setDraft(own || null);
    setSelected(payload.selected_ids || {});
    setCustomRequests(normalizeSuggestions(payload));
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
    const suggestion = makeSuggestion(group, label);
    const exists = customRequests.some((item) => item.group === suggestion.group && item.label.toLowerCase() === suggestion.label.toLowerCase());
    if (exists) return;
    setCustomRequests([...customRequests, suggestion]);
  };

  const removeCustom = (group, indexInGroup) => {
    if (pendingReview) return;
    let seen = -1;
    setCustomRequests(customRequests.filter((item) => {
      const itemGroup = SERVICE_GROUPS[item.group] ? item.group : "optical_retail";
      if (itemGroup !== group) return true;
      seen += 1;
      return seen !== indexInGroup;
    }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = buildPayload(selected, customRequests);
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action, submission_id: draft?.id, location_id: locationId, section: "services", payload }).catch((e) => ({ data: { error: e.response?.data?.error || e.message, fields: e.response?.data?.fields || [] } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.fields?.length ? `${res.data.error}: ${res.data.fields.join(", ")}` : res.data.error); return; }
    setMsg("Draft salvat. Poti trimite acum spre review, fara sa inchizi fereastra.");
    await load();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Serviciile au fost trimise spre review. Fereastra poate ramane deschisa pentru verificare.");
    await load();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Ce se poate face in aceasta locatie?</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Selecteaza o zona, apoi bifeaza doar detaliile care se aplica. Pe profilul public afisam simplu; detaliile ajuta recomandarea.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{approvedCount} publicate</span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{selectedCount} detalii selectate</span>
        </div>
      </div>

      {pendingReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Exista o cerere trimisa spre review. Editarea este blocata pana la decizia adminului.</div>}

      <NeedOverview selected={selected} activeKey={activeNeedKey} onPick={setActiveNeedKey} />

      {activeSection && (
        <NeedSectionCard
          section={activeSection}
          selected={selected}
          customByGroup={customByGroup}
          pendingReview={pendingReview}
          onToggle={toggle}
          onAddCustom={addCustom}
          onRemoveCustom={removeCustom}
          forceOpen
        />
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
