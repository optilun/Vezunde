import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getServiceGroupLayout, SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import {
  PROVIDER_SERVICE_AREAS,
  PROVIDER_SERVICE_SECTIONS,
} from "@/lib/providerServiceWorkspaceSections";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5";

const PROFILE_TYPE_LABELS = {
  independent_optical_store: "optică medicală",
  optical_chain: "locație dintr-un lanț de optică",
  ophthalmology_clinic: "clinică de oftalmologie",
  ophthalmology_office: "cabinet de oftalmologie",
  independent_ophthalmologist: "medic oftalmolog",
  independent_optometrist: "cabinet de optometrie",
  independent_optician: "optician independent",
  optical_laboratory_b2c: "laborator optic",
  optical_laboratory_b2b: "laborator optic B2B",
  future_b2b_distributor: "furnizor B2B",
};

const PROVIDER_TYPE_LABELS = {
  optica_medicala: "optică medicală",
  clinica_oftalmologica: "clinică de oftalmologie",
  cabinet_oftalmologic: "cabinet de oftalmologie",
  cabinet_optometric: "cabinet de optometrie",
  laborator_optic: "laborator optic",
  optometrist_independent: "optometrist independent",
  medic_oftalmolog_independent: "medic oftalmolog",
};

const SERVICE_GROUP_BY_KEY = Object.fromEntries(
  Object.entries(SERVICE_GROUPS).flatMap(([group, config]) => (
    Object.keys(config.ids || {}).map((serviceKey) => [serviceKey, group])
  )),
);

function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function searchText(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  Object.keys(selected).sort().forEach((group) => {
    const ids = selected[group];
    if (!SERVICE_GROUPS[group]) return;
    const allowedIds = new Set(Object.keys(SERVICE_GROUPS[group].ids || {}));
    const cleanIds = [...new Set((ids || []).filter((id) => allowedIds.has(id)))].sort();
    if (cleanIds.length > 0) result[group] = cleanIds;
  });
  return result;
}

function groupServiceKeys(serviceKeys = []) {
  const grouped = {};
  for (const serviceKey of serviceKeys) {
    const group = SERVICE_GROUP_BY_KEY[serviceKey];
    if (!group) continue;
    grouped[group] = grouped[group] || [];
    if (!grouped[group].includes(serviceKey)) grouped[group].push(serviceKey);
  }
  return normalizeSelectedPayload(grouped);
}

function applyDraftToApproved(approvedSelected, payload = {}) {
  const next = {};
  const approved = normalizeSelectedPayload(approvedSelected);
  const additions = normalizeSelectedPayload(payload.selected_ids || {});
  const removals = normalizeSelectedPayload(payload.removal_ids || {});

  for (const [group, ids] of Object.entries(approved)) next[group] = [...ids];
  for (const [group, ids] of Object.entries(additions)) {
    next[group] = [...new Set([...(next[group] || []), ...ids])];
  }
  for (const [group, ids] of Object.entries(removals)) {
    const removed = new Set(ids);
    next[group] = (next[group] || []).filter((id) => !removed.has(id));
  }
  return normalizeSelectedPayload(next);
}

function buildRemovalPayload(approvedSelected, selected) {
  const approved = normalizeSelectedPayload(approvedSelected);
  const desired = normalizeSelectedPayload(selected);
  const removals = {};
  for (const [group, ids] of Object.entries(approved)) {
    const desiredIds = new Set(desired[group] || []);
    const removedIds = ids.filter((id) => !desiredIds.has(id));
    if (removedIds.length > 0) removals[group] = removedIds;
  }
  return removals;
}

function buildPayload(selected, approvedSelected, customRequests, rawRemovalKeys) {
  const selectedIds = normalizeSelectedPayload(selected);
  const removalIds = buildRemovalPayload(approvedSelected, selected);
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

  return {
    selected_ids: selectedIds,
    removal_ids: removalIds,
    raw_removal_keys: [...new Set((rawRemovalKeys || []).map(normalizeText).filter(Boolean))],
    suggestions,
  };
}

function getProfileLabel(location) {
  return PROFILE_TYPE_LABELS[location?.provider_profile_type]
    || PROVIDER_TYPE_LABELS[location?.provider_type]
    || "profilul acestei locații";
}

function serviceLabel(item) {
  return SERVICE_GROUPS[item.group]?.ids?.[item.id] || item.id;
}

function isSelected(selected, item) {
  return (selected[item.group] || []).includes(item.id);
}

function sectionSelectedCount(selected, section) {
  return (section?.items || []).reduce((sum, item) => sum + (isSelected(selected, item) ? 1 : 0), 0);
}

function buildSectionModels(layout, selected) {
  const primaryGroups = new Set(layout.primary || []);
  const secondaryGroups = new Set(layout.secondary || []);
  const hiddenGroups = new Set(layout.hidden || []);

  return PROVIDER_SERVICE_SECTIONS.map((section) => {
    const items = section.items.filter((item) => {
      if (primaryGroups.has(item.group) || secondaryGroups.has(item.group)) return true;
      if (hiddenGroups.has(item.group)) return isSelected(selected, item);
      return false;
    });
    const primaryItems = items.filter((item) => primaryGroups.has(item.group));
    const selectedCount = sectionSelectedCount(selected, { ...section, items });
    return {
      ...section,
      items,
      selectedCount,
      isPrimary: primaryItems.length > 0,
      recommended: primaryItems.length > 0 || selectedCount > 0,
    };
  }).filter((section) => section.items.length > 0);
}

function prerequisiteTone(prerequisite) {
  if (!prerequisite || prerequisite.status === "available") return "available";
  if (prerequisite.eligible) return "review";
  return "blocked";
}

function prerequisiteDescription(prerequisite) {
  if (!prerequisite || prerequisite.status === "available") return "Disponibil pentru această locație.";
  if (prerequisite.eligible) return "Cerințele sunt îndeplinite. Va fi verificat înainte de publicare.";
  return prerequisite.blockers?.[0]?.message || prerequisite.status_label || "Există cerințe neîndeplinite.";
}

function ServiceStatus({ prerequisite }) {
  const tone = prerequisiteTone(prerequisite);
  const labels = {
    available: "Disponibil",
    review: prerequisite?.status_label || "Necesită verificare",
    blocked: prerequisite?.status_label || "Cerințe lipsă",
  };
  const classes = {
    available: "border-border bg-secondary/55 text-muted-foreground",
    review: "border-blue-200 bg-blue-50 text-blue-800",
    blocked: "border-amber-200 bg-amber-50 text-amber-900",
  };
  const Icon = tone === "blocked" ? AlertTriangle : tone === "review" ? ShieldCheck : CheckCircle2;

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${classes[tone]}`}>
      <Icon className="h-3 w-3" /> {labels[tone]}
    </span>
  );
}

function ServiceRow({ item, selected, prerequisite, disabled, onToggle }) {
  const active = isSelected(selected, item);
  const incompatible = prerequisite?.status === "incompatible_profile";

  return (
    <button
      type="button"
      disabled={disabled || incompatible}
      onClick={() => onToggle(item.group, item.id)}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${active ? "border-foreground/25 bg-secondary/65 shadow-sm" : "border-border bg-card hover:border-foreground/20 hover:bg-secondary/25"}`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground"}`}>
        {active && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug text-foreground">{serviceLabel(item)}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{prerequisiteDescription(prerequisite)}</span>
      </span>
      <ServiceStatus prerequisite={prerequisite} />
    </button>
  );
}

function CategorySelector({ sections, selected, activeKey, onPick }) {
  const byArea = Object.fromEntries(PROVIDER_SERVICE_AREAS.map((area) => [area.key, []]));
  sections.forEach((section) => {
    byArea[section.area] = byArea[section.area] || [];
    byArea[section.area].push(section);
  });

  return (
    <aside className="rounded-[24px] border border-border bg-card p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
      <div className="mb-4">
        <h2 className="text-sm font-bold">Categorii</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Alege o categorie pentru a configura serviciile locației.</p>
      </div>
      <div className="space-y-4">
        {PROVIDER_SERVICE_AREAS.map((area) => {
          const areaSections = byArea[area.key] || [];
          if (areaSections.length === 0) return null;
          return (
            <div key={area.key}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{area.label}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
                {areaSections.map((section) => {
                  const count = sectionSelectedCount(selected, section);
                  const active = activeKey === section.key;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => onPick(section.key)}
                      className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${active ? "border-foreground/25 bg-secondary/75 shadow-sm" : "border-border/70 bg-background hover:border-foreground/20 hover:bg-secondary/30"}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-foreground" : "bg-border"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold leading-snug">{section.title}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{section.isPrimary ? "Recomandat pentru locație" : "Categorie suplimentară"}</span>
                      </span>
                      {count > 0 && <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-foreground">{count}</span>}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function CustomServiceBox({ section, pendingReview, customItems, onAddCustom, onRemoveCustom }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const defaultGroup = section?.items?.[0]?.group || "optical_retail";

  const submit = () => {
    const clean = normalizeText(label);
    if (!clean) return;
    onAddCustom(defaultGroup, clean);
    setLabel("");
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold">Nu găsești serviciul?</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Îl poți propune manual. Va fi verificat înainte de publicare.</p>
        </div>
        <button type="button" disabled={pendingReview} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Adaugă manual
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={inputCls}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Denumirea serviciului"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" onClick={submit} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Adaugă în draft</button>
        </div>
      )}

      {customItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {customItems.map((item) => (
            <span key={`${item.group}-${item.indexInGroup}-${item.label}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
              {item.label}
              {!pendingReview && (
                <button type="button" onClick={() => onRemoveCustom(item.group, item.indexInGroup)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="Șterge serviciul propus">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionDetail({ section, selected, prerequisitesByKey, customItems, pendingReview, onToggle, onAddCustom, onRemoveCustom }) {
  if (!section) return null;
  return (
    <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-bold tracking-tight">{section.title}</h2>
            {!section.isPrimary && <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Suplimentar</span>}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{section.description}</p>
        </div>
        <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold">{section.selectedCount} selectate</span>
      </div>

      {section.note && (
        <div className="mt-4 flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {section.note}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {section.items.map((item) => (
          <ServiceRow
            key={`${item.group}:${item.id}`}
            item={item}
            selected={selected}
            prerequisite={prerequisitesByKey[item.id]}
            disabled={pendingReview}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="mt-4">
        <CustomServiceBox
          section={section}
          pendingReview={pendingReview}
          customItems={customItems}
          onAddCustom={onAddCustom}
          onRemoveCustom={onRemoveCustom}
        />
      </div>
    </section>
  );
}

function SearchResults({ query, rows, selected, prerequisitesByKey, pendingReview, onToggle }) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Rezultate pentru „{query}”</h2>
          <p className="mt-1 text-xs text-muted-foreground">Căutarea include toate categoriile compatibile cu locația.</p>
        </div>
        <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold">{rows.length} rezultate</span>
      </div>
      {rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {rows.map(({ section, item }) => (
            <div key={`${section.key}:${item.group}:${item.id}`}>
              <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{section.title}</div>
              <ServiceRow
                item={item}
                selected={selected}
                prerequisite={prerequisitesByKey[item.id]}
                disabled={pendingReview}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">Nu am găsit servicii pentru această căutare.</div>
      )}
    </section>
  );
}

function SummaryPanel({
  approvedCount,
  selectedCount,
  removalCount,
  blockedSelectedCount,
  readyForReviewCount,
  selectedSections,
  evidenceSummary,
  profileLabel,
  showResources,
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Rezumat</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Configurare pentru {profileLabel}.</p>
        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5"><span className="text-muted-foreground">Servicii selectate</span><strong>{selectedCount}</strong></div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5"><span className="text-muted-foreground">Active acum</span><strong>{approvedCount}</strong></div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5"><span className="text-muted-foreground">Categorii publice</span><strong>{selectedSections.length}</strong></div>
        </div>
      </section>

      {(blockedSelectedCount > 0 || readyForReviewCount > 0 || removalCount > 0) && (
        <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-bold">Necesită atenție</h2>
          <div className="mt-3 space-y-2 text-xs">
            {blockedSelectedCount > 0 && <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900"><span>Cerințe lipsă</span><strong>{blockedSelectedCount}</strong></div>}
            {readyForReviewCount > 0 && <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-900"><span>Necesită verificare</span><strong>{readyForReviewCount}</strong></div>}
            {removalCount > 0 && <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/35 px-3 py-2.5"><span>De eliminat</span><strong>{removalCount}</strong></div>}
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Cum va apărea public</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Pacienții vor vedea categorii simple, nu lista tehnică completă.</p>
        <div className="mt-3 space-y-2">
          {selectedSections.length > 0 ? selectedSections.map((section) => (
            <div key={section.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/35 px-3 py-2.5">
              <span className="text-xs font-semibold">{section.publicLabel}</span>
              <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold">{section.selectedCount}</span>
            </div>
          )) : <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nu ai selectat încă servicii.</div>}
        </div>
      </section>

      {showResources && (
        <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-bold">Resurse asociate</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Sunt folosite doar pentru validarea serviciilor care au cerințe.</p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Specialiști activi</span><strong>{evidenceSummary.active_assignment_count || 0}</strong></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Echipamente active</span><strong>{evidenceSummary.equipment_count || 0}</strong></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Facilități declarate</span><strong>{evidenceSummary.facility_count || 0}</strong></div>
          </div>
        </section>
      )}
    </aside>
  );
}

function LegacyServicesCard({ services, rawRemovalKeys, pendingReview, onToggleRemoval }) {
  if (!services.length) return null;
  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-amber-950">Servicii existente care necesită migrare</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-900/80">Cheile vechi sau ambigue rămân vizibile pentru a nu pierde date, dar nu intră automat în profil ori matching.</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{services.length} de verificat</span>
      </div>
      <div className="mt-4 space-y-2">
        {services.map((service) => {
          const marked = rawRemovalKeys.includes(service.raw_key);
          const statusLabel = service.catalog_status === "legacy_mapped"
            ? "Cheie veche mapabilă"
            : service.catalog_status === "legacy_ambiguous"
              ? "Cheie ambiguă"
              : "Cheie necunoscută";
          return (
            <div key={`${service.id || service.raw_key}:${service.raw_key}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-bold">{service.label || service.raw_key}</div>
                <div className="mt-1 break-all text-[10px] text-muted-foreground">{service.raw_key}</div>
                <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{statusLabel}</span>
              </div>
              <button type="button" disabled={pendingReview} onClick={() => onToggleRemoval(service.raw_key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${marked ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-background hover:bg-secondary"}`}>
                {marked ? "Eliminare solicitată" : "Solicită eliminarea"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProviderServicesWorkspace({ locationId, location, overview }) {
  const [draft, setDraft] = useState(null);
  const [approvedSelected, setApprovedSelected] = useState({});
  const [selected, setSelected] = useState({});
  const [customRequests, setCustomRequests] = useState([]);
  const [legacyServices, setLegacyServices] = useState([]);
  const [prerequisitesByKey, setPrerequisitesByKey] = useState({});
  const [evidenceSummary, setEvidenceSummary] = useState({});
  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState("");
  const [query, setQuery] = useState("");

  const profileLabel = getProfileLabel(location);
  const layout = useMemo(
    () => getServiceGroupLayout(location?.provider_profile_type, location?.provider_type),
    [location?.provider_profile_type, location?.provider_type],
  );
  const sectionModels = useMemo(() => buildSectionModels(layout, selected), [layout, selected]);
  const recommendedSections = sectionModels.filter((section) => section.recommended);
  const additionalSections = sectionModels.filter((section) => !section.recommended);
  const navigableSections = showAdditional ? sectionModels : recommendedSections;
  const activeSection = navigableSections.find((section) => section.key === activeSectionKey) || navigableSections[0] || null;

  const customByGroup = useMemo(() => {
    const map = {};
    for (const item of customRequests) {
      const group = SERVICE_GROUPS[item.group] ? item.group : "optical_retail";
      map[group] = map[group] || [];
      map[group].push(item);
    }
    return map;
  }, [customRequests]);

  const customItemsForActiveSection = useMemo(() => {
    if (!activeSection) return [];
    const groups = [...new Set(activeSection.items.map((item) => item.group))];
    return groups.flatMap((group) => (customByGroup[group] || []).map((item, indexInGroup) => ({ ...item, group, indexInGroup })));
  }, [activeSection, customByGroup]);

  const searchRows = useMemo(() => {
    const needle = searchText(query);
    if (!needle) return [];
    return sectionModels.flatMap((section) => section.items
      .filter((item) => searchText(`${section.title} ${section.description} ${serviceLabel(item)} ${SERVICE_GROUPS[item.group]?.label || ""}`).includes(needle))
      .map((item) => ({ section, item })));
  }, [query, sectionModels]);

  const approvedLoadedCount = countSelected(approvedSelected);
  const approvedCount = servicesLoaded ? approvedLoadedCount : (overview?.content_summary?.approved_service_count ?? 0);
  const pendingReview = draft?.status === "pending_review";
  const selectedCount = countSelected(selected) + customRequests.length;
  const removalCount = countSelected(buildRemovalPayload(approvedSelected, selected)) + rawRemovalKeys.length;
  const hasSelectionChanges = JSON.stringify(normalizeSelectedPayload(selected)) !== JSON.stringify(normalizeSelectedPayload(approvedSelected));
  const draftPayload = safeParse(draft?.payload_json);
  const draftRawRemovalKeys = Array.isArray(draftPayload.raw_removal_keys) ? draftPayload.raw_removal_keys : [];
  const hasRawRemovalChanges = JSON.stringify([...rawRemovalKeys].sort()) !== JSON.stringify([...draftRawRemovalKeys].sort());
  const hasChanges = hasSelectionChanges || customRequests.length > 0 || hasRawRemovalChanges || rawRemovalKeys.length > 0;
  const selectedPrerequisiteRows = Object.values(selected || {}).flat().map((key) => prerequisitesByKey[key]).filter(Boolean);
  const blockedSelectedCount = selectedPrerequisiteRows.filter((item) => item.eligible === false).length;
  const readyForReviewCount = selectedPrerequisiteRows.filter((item) => item.eligible === true && item.status === "ready_for_review").length;
  const selectedSections = sectionModels
    .map((section) => ({ ...section, selectedCount: sectionSelectedCount(selected, section) }))
    .filter((section) => section.selectedCount > 0);
  const showResources = selectedPrerequisiteRows.some((item) => item.status !== "available")
    || Object.values(evidenceSummary || {}).some((value) => Number(value) > 0);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setServicesLoaded(false);
    setLoadError("");

    const invoke = async (name, payload) => {
      try {
        const response = await base44.functions.invoke(name, payload);
        if (response.data?.error) return { ok: false, error: response.data.error };
        return { ok: true, data: response.data || {} };
      } catch (error) {
        return { ok: false, error: error.response?.data?.error || error.message };
      }
    };

    const [submissionResult, serviceResult] = await Promise.all([
      invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }),
      invoke("getProviderLocationServices", { location_id: locationId }),
    ]);

    if (!submissionResult.ok || !serviceResult.ok || !Array.isArray(serviceResult.data?.service_keys)) {
      setDraft(null);
      setApprovedSelected({});
      setSelected({});
      setCustomRequests([]);
      setLegacyServices([]);
      setPrerequisitesByKey({});
      setEvidenceSummary({});
      setRawRemovalKeys([]);
      setLoadError("Nu am putut încărca serviciile actuale. Editarea rămâne blocată pentru a evita pierderea selecțiilor existente.");
      setLoading(false);
      return;
    }

    const approved = groupServiceKeys(serviceResult.data.service_keys);
    const serviceSubmissions = (submissionResult.data?.submissions || []).filter((submission) => (
      submission.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(submission.status)
    ));
    const pending = serviceSubmissions.find((submission) => submission.status === "pending_review");
    const own = pending || serviceSubmissions.find((submission) => ["draft", "needs_more_info"].includes(submission.status));
    const payload = safeParse(own?.payload_json);

    setDraft(own || null);
    setApprovedSelected(approved);
    setSelected(own ? applyDraftToApproved(approved, payload) : approved);
    setCustomRequests(normalizeSuggestions(payload));
    setLegacyServices(Array.isArray(serviceResult.data.legacy_or_unknown_services) ? serviceResult.data.legacy_or_unknown_services : []);
    setPrerequisitesByKey(serviceResult.data.prerequisites_by_key || {});
    setEvidenceSummary(serviceResult.data.prerequisite_evidence_summary || {});
    setRawRemovalKeys(Array.isArray(payload.raw_removal_keys) ? payload.raw_removal_keys : []);
    setServicesLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    setMsg("");
    setShowAdditional(false);
    setActiveSectionKey("");
    setQuery("");
    load();
  }, [locationId]);

  const sectionSignature = navigableSections.map((section) => section.key).join("|");
  useEffect(() => {
    if (!navigableSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(navigableSections[0]?.key || "");
    }
  }, [sectionSignature, activeSectionKey]);

  const toggleAdditional = () => {
    const next = !showAdditional;
    setShowAdditional(next);
    if (!next && additionalSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(recommendedSections[0]?.key || "");
    }
  };

  const toggle = (group, id) => {
    if (pendingReview || !servicesLoaded) return;
    const current = new Set(selected[group] || []);
    current.has(id) ? current.delete(id) : current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const addCustom = (group, label) => {
    if (pendingReview || !servicesLoaded) return;
    const suggestion = makeSuggestion(group, label);
    const exists = customRequests.some((item) => item.group === suggestion.group && item.label.toLowerCase() === suggestion.label.toLowerCase());
    if (exists) return;
    setCustomRequests([...customRequests, suggestion]);
  };

  const removeCustom = (group, indexInGroup) => {
    if (pendingReview || !servicesLoaded) return;
    let seen = -1;
    setCustomRequests(customRequests.filter((item) => {
      const itemGroup = SERVICE_GROUPS[item.group] ? item.group : "optical_retail";
      if (itemGroup !== group) return true;
      seen += 1;
      return seen !== indexInGroup;
    }));
  };

  const toggleRawRemoval = (rawKey) => {
    if (pendingReview || !servicesLoaded) return;
    setRawRemovalKeys((current) => current.includes(rawKey)
      ? current.filter((key) => key !== rawKey)
      : [...current, rawKey]);
  };

  const save = async () => {
    if (!servicesLoaded || pendingReview || (!hasChanges && !draft)) return;
    setSaving(true);
    setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = buildPayload(selected, approvedSelected, customRequests, rawRemovalKeys);
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      location_id: locationId,
      section: "services",
      payload,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message, fields: error.response?.data?.fields || [] } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.fields?.length ? `${response.data.error}: ${response.data.fields.join(", ")}` : response.data.error);
      return;
    }
    setMsg("Draftul a fost salvat. Îl poți trimite spre verificare după completarea cerințelor.");
    await load();
  };

  const submit = async () => {
    if (!draft || !servicesLoaded || blockedSelectedCount > 0) return;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action: "submit",
      submission_id: draft.id,
      location_id: locationId,
      section: "services",
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Serviciile au fost trimise spre verificare.");
    await load();
  };

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight">Serviciile locației</h1>
              {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Selectează ce oferă această locație. Serviciile medicale sunt verificate separat înainte de publicare.
            </p>
          </div>
          <span className="rounded-full border border-border bg-secondary/35 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{location?.public_display_name || location?.name || "Locația selectată"}</span>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută un serviciu, o investigație sau o specializare" />
          {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}
        </div>
      </section>

      {pendingReview && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Serviciile sunt în verificare. Editarea este blocată până la decizia administratorului.
        </div>
      )}

      {!pendingReview && blockedSelectedCount > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>{blockedSelectedCount} servicii selectate au cerințe neîndeplinite.</strong> Draftul poate fi salvat, dar trimiterea spre verificare este blocată până când există specialistul, echipamentul sau infrastructura necesară.</div>
        </div>
      )}

      {loading && <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă serviciile locației...</div>}

      {!loading && loadError && (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-950">
          <p>{loadError}</p>
          <button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold hover:bg-amber-100">Încearcă din nou</button>
        </div>
      )}

      {!loading && servicesLoaded && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-4">
              {!query && (
                <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                  <CategorySelector sections={navigableSections} selected={selected} activeKey={activeSection?.key || ""} onPick={setActiveSectionKey} />
                  <SectionDetail
                    section={activeSection}
                    selected={selected}
                    prerequisitesByKey={prerequisitesByKey}
                    customItems={customItemsForActiveSection}
                    pendingReview={pendingReview}
                    onToggle={toggle}
                    onAddCustom={addCustom}
                    onRemoveCustom={removeCustom}
                  />
                </div>
              )}

              {query && <SearchResults query={query} rows={searchRows} selected={selected} prerequisitesByKey={prerequisitesByKey} pendingReview={pendingReview} onToggle={toggle} />}

              {additionalSections.length > 0 && !query && (
                <button type="button" onClick={toggleAdditional} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-sm hover:bg-secondary">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdditional ? "rotate-180" : ""}`} />
                  {showAdditional ? "Ascunde categoriile suplimentare" : `Vezi și ${additionalSections.length} categorii suplimentare`}
                </button>
              )}
            </div>

            <SummaryPanel
              approvedCount={approvedCount}
              selectedCount={selectedCount}
              removalCount={removalCount}
              blockedSelectedCount={blockedSelectedCount}
              readyForReviewCount={readyForReviewCount}
              selectedSections={selectedSections}
              evidenceSummary={evidenceSummary}
              profileLabel={profileLabel}
              showResources={showResources}
            />
          </div>

          <LegacyServicesCard services={legacyServices} rawRemovalKeys={rawRemovalKeys} pendingReview={pendingReview} onToggleRemoval={toggleRawRemoval} />
        </>
      )}

      <div className="sticky bottom-0 z-20 -mx-1 rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{selectedCount}</strong> servicii selectate
            {blockedSelectedCount > 0 && <span className="ml-2 text-amber-800">· {blockedSelectedCount} cu cerințe lipsă</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={saving || pendingReview || !servicesLoaded || (!hasChanges && !draft)} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
              <Save className="h-4 w-4" /> Salvează draftul
            </button>
            {draft && draft.status !== "pending_review" && (
              <button disabled={saving || !servicesLoaded || blockedSelectedCount > 0} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
                <Send className="h-4 w-4" /> Trimite spre verificare
              </button>
            )}
          </div>
        </div>
        {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}
