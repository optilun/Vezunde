import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Save, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

const ESSENTIAL_GROUPS = [
  {
    key: "optical_retail",
    title: "Produse optice",
    subtitle: "Ce poate cumpara clientul din locatie.",
  },
  {
    key: "lenses_and_measurements",
    title: "Lentile si personalizare",
    subtitle: "Lentile, masuratori si personalizare pentru ochelari.",
  },
  {
    key: "optometry",
    title: "Servicii optice si optometrice",
    subtitle: "Servicii uzuale pentru evaluarea si corectia vederii.",
  },
  {
    key: "technical_activities",
    title: "Atelier / laborator optic",
    subtitle: "Montaj, reglaje, reparatii si suport tehnic.",
  },
];

const ADVANCED_GROUPS = [
  {
    key: "contact_lenses",
    title: "Lentile de contact",
    subtitle: "Recomandare, adaptare si monitorizare lentile de contact.",
  },
  {
    key: "ophthalmology_consults",
    title: "Cabinet oftalmologic",
    subtitle: "Consultatii si verificari medicale realizate in locatie.",
  },
  {
    key: "investigations",
    title: "Investigatii si echipamente",
    subtitle: "Aparatura si investigatii disponibile in cabinet/clinica.",
  },
  {
    key: "specialties",
    title: "Specializari medicale",
    subtitle: "Arii medicale tratate sau urmarite de specialisti.",
  },
  {
    key: "children_and_prevention",
    title: "Copii si preventie",
    subtitle: "Servicii dedicate copiilor, screening si preventie vizuala.",
  },
  {
    key: "procedures_surgery",
    title: "Proceduri si chirurgie",
    subtitle: "Proceduri medicale, laser sau interventii disponibile.",
  },
];

const CAPABILITY_CARDS = [
  {
    label: "Optica retail",
    desc: "Produse, rame, lentile si accesorii.",
    groups: ["optical_retail", "lenses_and_measurements"],
  },
  {
    label: "Cabinet optometric",
    desc: "Determinare dioptrii si servicii optometrice.",
    groups: ["optometry"],
  },
  {
    label: "Atelier optic",
    desc: "Montaj, reglaje si reparatii.",
    groups: ["technical_activities"],
  },
  {
    label: "Lentile de contact",
    desc: "Adaptare si control lentile de contact.",
    groups: ["contact_lenses"],
  },
  {
    label: "Cabinet oftalmologic",
    desc: "Consultatii si investigatii medicale.",
    groups: ["ophthalmology_consults", "investigations", "specialties"],
  },
  {
    label: "Clinica / proceduri",
    desc: "Specializari, copii, laser sau chirurgie.",
    groups: ["children_and_prevention", "procedures_surgery"],
  },
];

function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function countSelected(selected) {
  return Object.values(selected || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function countGroups(selected, groups) {
  return groups.reduce((sum, group) => sum + ((selected[group] || []).length), 0);
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

function SectionHeader({ title, description, badge }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-base font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {badge && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{badge}</span>}
    </div>
  );
}

function CapabilityOverview({ selected }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <SectionHeader
        title="Configurare rapida locatie"
        description="Alege serviciile dupa tipul real al punctului de lucru. Cardurile de mai jos te ajuta sa vezi rapid ce zone sunt completate."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAPABILITY_CARDS.map((card) => {
          const count = countGroups(selected, card.groups);
          const active = count > 0;
          return (
            <div key={card.label} className={`rounded-2xl border p-3 transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/35"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{card.label}</div>
                  <p className={`mt-1 text-xs leading-relaxed ${active ? "text-background/75" : "text-muted-foreground"}`}>{card.desc}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-background text-foreground" : "bg-card text-muted-foreground"}`}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GroupCard({ groupKey, title, subtitle, selectedIds, customItems, pendingReview, onToggle, onAddCustom, onRemoveCustom, compact = false }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const def = SERVICE_GROUPS[groupKey];
  if (!def) return null;

  const submitCustom = () => {
    const label = normalizeText(customLabel);
    if (!label) return;
    onAddCustom(groupKey, label);
    setCustomLabel("");
    setShowCustom(false);
  };

  return (
    <section className={`rounded-2xl border border-border bg-card shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{title || def.label}</h3>
            {selectedIds.length > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{selectedIds.length}</span>}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{subtitle || def.helper}</p>
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

function GroupStack({ title, description, groups, selected, customByGroup, pendingReview, onToggle, onAddCustom, onRemoveCustom, initiallyOpen = true }) {
  const [open, setOpen] = useState(initiallyOpen);
  const selectedCount = countGroups(selected, groups.map((g) => g.key));

  return (
    <section className="rounded-3xl border border-border bg-background/70 p-3 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 rounded-2xl px-2 py-2 text-left hover:bg-secondary/40">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold tracking-tight">{title}</h2>
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{selectedCount} selectate</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          {open ? "Ascunde" : "Afiseaza"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              groupKey={group.key}
              title={group.title}
              subtitle={group.subtitle}
              selectedIds={selected[group.key] || []}
              customItems={customByGroup[group.key] || []}
              pendingReview={pendingReview}
              onToggle={onToggle}
              onAddCustom={onAddCustom}
              onRemoveCustom={onRemoveCustom}
              compact
            />
          ))}
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

  const load = async () => {
    if (!locationId) return;
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
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
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii disponibile in locatie</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Configureaza ce exista efectiv in aceasta locatie: produse, servicii pentru clienti, atelier, cabinet, investigatii si echipamente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{approvedCount} publicate</span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{selectedCount} selectate</span>
        </div>
      </div>

      {pendingReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Exista o cerere trimisa spre review. Editarea este blocata pana la decizia adminului.</div>}

      <CapabilityOverview selected={selected} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <GroupStack
          title="Esential pentru optica"
          description="Produse si servicii pe care majoritatea opticilor le completeaza primele. Acestea vor fi cele mai vizibile in profil si in cautari."
          groups={ESSENTIAL_GROUPS}
          selected={selected}
          customByGroup={customByGroup}
          pendingReview={pendingReview}
          onToggle={toggle}
          onAddCustom={addCustom}
          onRemoveCustom={removeCustom}
          initiallyOpen
        />

        <GroupStack
          title="Avansat: cabinet, echipamente si specializari"
          description="Completeaza doar ce exista real in locatie: cabinet, aparatura, lentile de contact, servicii medicale sau proceduri."
          groups={ADVANCED_GROUPS}
          selected={selected}
          customByGroup={customByGroup}
          pendingReview={pendingReview}
          onToggle={toggle}
          onAddCustom={addCustom}
          onRemoveCustom={removeCustom}
          initiallyOpen={false}
        />
      </div>

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
