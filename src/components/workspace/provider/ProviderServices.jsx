import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, Save, Send, ShieldCheck, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getServiceGroupLayout, SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { CLIENT_NEED_SECTIONS, getSectionSelectedCount } from "@/lib/servicePresentation";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

const SERVICE_GROUP_BY_KEY = Object.fromEntries(
  Object.entries(SERVICE_GROUPS).flatMap(([group, config]) => (
    Object.keys(config.ids || {}).map((serviceKey) => [serviceKey, group])
  )),
);

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

function sectionDefaultGroup(section) {
  return section?.items?.[0]?.group || "optical_retail";
}

function sectionGroups(section) {
  return [...new Set((section?.items || []).map((item) => item.group))];
}

function customItemsForSection(customByGroup, section) {
  return sectionGroups(section).flatMap((group) => (
    (customByGroup[group] || []).map((item, index) => ({ ...item, group, indexInGroup: index }))
  ));
}

function itemKey(item) {
  return `${item.group}:${item.id}`;
}

function groupItems(items = []) {
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.group)) grouped.set(item.group, []);
    grouped.get(item.group).push(item);
  }
  return [...grouped.entries()].map(([group, groupItemsList]) => ({ group, items: groupItemsList }));
}

function getProfileLabel(location) {
  return PROFILE_TYPE_LABELS[location?.provider_profile_type]
    || PROVIDER_TYPE_LABELS[location?.provider_type]
    || "profilul acestei locații";
}

function buildSectionModels(layout, selected) {
  const primaryGroups = new Set(layout.primary || []);
  const secondaryGroups = new Set(layout.secondary || []);
  const hiddenGroups = new Set(layout.hidden || []);

  return CLIENT_NEED_SECTIONS.map((section) => {
    const items = section.items.filter((item) => {
      if (!hiddenGroups.has(item.group)) return primaryGroups.has(item.group) || secondaryGroups.has(item.group);
      return (selected[item.group] || []).includes(item.id);
    });
    const primaryItems = items.filter((item) => primaryGroups.has(item.group));
    const optionalItems = items.filter((item) => !primaryGroups.has(item.group));
    const selectedCount = getSectionSelectedCount(selected, { ...section, items });
    return {
      ...section,
      items,
      primaryItems,
      optionalItems,
      selectedCount,
      recommended: primaryItems.length > 0 || selectedCount > 0,
    };
  }).filter((section) => section.items.length > 0);
}

function NeedOverview({ recommendedSections, additionalSections, selected, activeKey, showAdditional, onToggleAdditional, onPick, profileLabel }) {
  const sections = showAdditional ? [...recommendedSections, ...additionalSections] : recommendedSections;
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold tracking-tight">Alege categoriile disponibile</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Am afișat mai întâi serviciile potrivite pentru acest tip de locație. Poți adăuga și alte categorii când este necesar.
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Configurare pentru {profileLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const count = getSectionSelectedCount(selected, section);
          const active = count > 0;
          const focused = activeKey === section.key;
          const additional = !section.recommended;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onPick(section.key)}
              className={`rounded-2xl border p-3 text-left transition-colors ${focused ? "border-foreground bg-secondary" : active ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/35 hover:border-foreground/30"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-bold">{section.title}</div>
                    {additional && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active && !focused ? "bg-background/15 text-background" : "bg-card text-muted-foreground"}`}>Opțional</span>}
                  </div>
                  <p className={`mt-1 text-xs leading-relaxed ${active && !focused ? "text-background/75" : "text-muted-foreground"}`}>Pe profil: {section.publicLabel}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${active && !focused ? "bg-background text-foreground" : "bg-card text-muted-foreground"}`}>{count}</span>
              </div>
            </button>
          );
        })}
      </div>

      {additionalSections.length > 0 && (
        <button type="button" onClick={onToggleAdditional} className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-secondary">
          {showAdditional ? "Ascunde serviciile suplimentare" : "Vezi și alte servicii"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdditional ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

function PrerequisiteBadge({ prerequisite }) {
  if (!prerequisite || prerequisite.status === "available") return null;
  const ready = prerequisite.eligible === true;
  const Icon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ready ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
      <Icon className="h-3 w-3" /> {prerequisite.status_label || prerequisite.status}
    </span>
  );
}

function ServiceGroupBlock({ group, items, selected, prerequisitesByKey, pendingReview, onToggle }) {
  const config = SERVICE_GROUPS[group];
  if (!config || items.length === 0) return null;
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="text-xs font-bold text-foreground">{config.label}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{config.helper}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => {
          const label = config.ids?.[item.id] || item.id;
          const active = (selected[item.group] || []).includes(item.id);
          const prerequisite = prerequisitesByKey[item.id] || null;
          const incompatible = prerequisite?.status === "incompatible_profile";
          return (
            <button
              key={itemKey(item)}
              type="button"
              disabled={pendingReview || incompatible}
              onClick={() => onToggle(item.group, item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
            >
              <span className="flex flex-col items-start">
                <span>{label}</span>
                <PrerequisiteBadge prerequisite={prerequisite} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NeedSectionCard({ section, selected, customByGroup, prerequisitesByKey, pendingReview, onToggle, onAddCustom, onRemoveCustom }) {
  const optionalSelected = section.optionalItems.some((item) => (selected[item.group] || []).includes(item.id));
  const [showOptional, setShowOptional] = useState(section.primaryItems.length === 0 || optionalSelected);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const selectedCount = getSectionSelectedCount(selected, section);
  const customItems = customItemsForSection(customByGroup, section);
  const primaryGroups = groupItems(section.primaryItems);
  const optionalGroups = groupItems(section.optionalItems);

  const submitCustom = () => {
    const label = normalizeText(customLabel);
    if (!label) return;
    onAddCustom(sectionDefaultGroup(section), label);
    setCustomLabel("");
    setShowCustom(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{section.title}</h3>
            {selectedCount > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{selectedCount}</span>}
            {!section.recommended && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Categorie suplimentară</span>}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{section.description}</p>
          <div className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Pe profil: {section.publicLabel}</div>
        </div>
      </div>

      {section.note && <p className="mt-3 rounded-2xl bg-secondary/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{section.note}</p>}

      <div className="mt-4 space-y-4">
        {primaryGroups.map(({ group, items }) => (
          <ServiceGroupBlock key={group} group={group} items={items} selected={selected} prerequisitesByKey={prerequisitesByKey} pendingReview={pendingReview} onToggle={onToggle} />
        ))}

        {optionalGroups.length > 0 && section.primaryItems.length > 0 && (
          <button type="button" onClick={() => setShowOptional((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
            {showOptional ? "Ascunde opțiunile suplimentare" : "Vezi opțiunile suplimentare"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOptional ? "rotate-180" : ""}`} />
          </button>
        )}

        {showOptional && optionalGroups.map(({ group, items }) => (
          <ServiceGroupBlock key={group} group={group} items={items} selected={selected} prerequisitesByKey={prerequisitesByKey} pendingReview={pendingReview} onToggle={onToggle} />
        ))}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button type="button" disabled={pendingReview} onClick={() => setShowCustom((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Nu găsești serviciul?
          </button>
        </div>

        {showCustom && (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/35 p-3">
            <label className="text-xs font-semibold text-muted-foreground">Adaugă denumirea serviciului</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className={inputCls}
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Exemplu: serviciu special disponibil în această locație"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitCustom();
                  }
                }}
              />
              <button type="button" onClick={submitCustom} className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background">Adaugă în draft</button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Serviciile adăugate manual sunt verificate înainte de publicare sau folosire în recomandări.</p>
          </div>
        )}

        {customItems.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Propuse manual</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {customItems.map((item) => (
                <span key={`${item.group}-${item.label}-${item.indexInGroup}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900">
                  {item.label}
                  {!pendingReview && (
                    <button type="button" onClick={() => onRemoveCustom(item.group, item.indexInGroup)} className="rounded-full p-0.5 hover:bg-amber-100" aria-label="Șterge serviciul">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LegacyServicesCard({ services, rawRemovalKeys, pendingReview, onToggleRemoval }) {
  if (!services.length) return null;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-amber-950">Servicii existente de migrat</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-900/80">
            Aceste servicii folosesc chei vechi, ambigue sau necunoscute. Rămân vizibile pentru a nu pierde date, dar nu sunt activate automat în profil sau matching.
          </p>
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
                <div className="text-xs font-bold text-foreground">{service.label || service.raw_key}</div>
                <div className="mt-0.5 break-all text-[11px] text-muted-foreground">Cheie: {service.raw_key}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{statusLabel}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{service.confirmation_level || "not_confirmed"}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={pendingReview}
                onClick={() => onToggleRemoval(service.raw_key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${marked ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-background hover:bg-secondary"}`}
              >
                {marked ? "Eliminare solicitată" : "Solicită eliminarea"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProviderServices({ locationId, location, overview }) {
  const [draft, setDraft] = useState(null);
  const [approvedSelected, setApprovedSelected] = useState({});
  const [selected, setSelected] = useState({});
  const [customRequests, setCustomRequests] = useState([]);
  const [legacyServices, setLegacyServices] = useState([]);
  const [prerequisitesByKey, setPrerequisitesByKey] = useState({});
  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [activeNeedKey, setActiveNeedKey] = useState("");

  const profileLabel = getProfileLabel(location);
  const layout = useMemo(
    () => getServiceGroupLayout(location?.provider_profile_type, location?.provider_type),
    [location?.provider_profile_type, location?.provider_type],
  );
  const sectionModels = useMemo(() => buildSectionModels(layout, selected), [layout, selected]);
  const recommendedSections = sectionModels.filter((section) => section.recommended);
  const additionalSections = sectionModels.filter((section) => !section.recommended);
  const visibleSections = showAdditional ? [...recommendedSections, ...additionalSections] : recommendedSections;
  const activeSection = visibleSections.find((section) => section.key === activeNeedKey) || visibleSections[0] || null;

  const approvedLoadedCount = countSelected(approvedSelected);
  const approvedCount = servicesLoaded ? approvedLoadedCount : (overview?.content_summary?.approved_service_count ?? 0);
  const pendingReview = draft?.status === "pending_review";
  const selectedCount = countSelected(selected) + customRequests.length;
  const removalCount = countSelected(buildRemovalPayload(approvedSelected, selected)) + rawRemovalKeys.length;
  const hasSelectionChanges = JSON.stringify(normalizeSelectedPayload(selected)) !== JSON.stringify(normalizeSelectedPayload(approvedSelected));
  const draftRawRemovalKeys = Array.isArray(safeParse(draft?.payload_json).raw_removal_keys) ? safeParse(draft?.payload_json).raw_removal_keys : [];
  const hasRawRemovalChanges = JSON.stringify([...rawRemovalKeys].sort()) !== JSON.stringify([...draftRawRemovalKeys].sort());
  const hasChanges = hasSelectionChanges || customRequests.length > 0 || hasRawRemovalChanges || rawRemovalKeys.length > 0;
  const selectedPrerequisiteRows = Object.values(selected || {}).flat()
    .map((key) => prerequisitesByKey[key])
    .filter(Boolean);
  const blockedSelectedCount = selectedPrerequisiteRows.filter((item) => item.eligible === false).length;
  const readyForReviewCount = selectedPrerequisiteRows.filter((item) => item.eligible === true && item.status === "ready_for_review").length;

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
    setRawRemovalKeys(Array.isArray(payload.raw_removal_keys) ? payload.raw_removal_keys : []);
    setServicesLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    setMsg("");
    setShowAdditional(false);
    setActiveNeedKey("");
    load();
  }, [locationId]);

  const recommendedKeySignature = recommendedSections.map((section) => section.key).join("|");
  const additionalKeySignature = additionalSections.map((section) => section.key).join("|");

  useEffect(() => {
    const currentlyVisible = showAdditional ? [...recommendedSections, ...additionalSections] : recommendedSections;
    if (!currentlyVisible.some((section) => section.key === activeNeedKey)) {
      setActiveNeedKey(currentlyVisible[0]?.key || "");
    }
  }, [recommendedKeySignature, additionalKeySignature, showAdditional, activeNeedKey]);

  const toggleAdditional = () => {
    const next = !showAdditional;
    setShowAdditional(next);
    if (!next && additionalSections.some((section) => section.key === activeNeedKey)) {
      setActiveNeedKey(recommendedSections[0]?.key || "");
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
    setMsg("Draftul a fost salvat. Îl poți trimite spre verificare.");
    await load();
  };

  const submit = async () => {
    if (!draft || !servicesLoaded) return;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Serviciile locației</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Selectează ce pot solicita clienții la această locație. Serviciile medicale și cheile vechi rămân blocate până la verificarea corespunzătoare.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{approvedCount} active salvate</span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground">{selectedCount} selectate</span>
          {removalCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">{removalCount} de eliminat</span>}
          {readyForReviewCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-800"><ShieldCheck className="h-3 w-3" />{readyForReviewCount} pregătite pentru verificare</span>}
          {blockedSelectedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" />{blockedSelectedCount} cu cerințe lipsă</span>}
        </div>
      </div>

      {pendingReview && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Serviciile sunt în verificare. Editarea este blocată până la decizia administratorului.
        </div>
      )}

      {!pendingReview && blockedSelectedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Unele servicii selectate necesită încă specialist, echipament sau infrastructură verificată. Le poți păstra în draft, dar nu vor putea fi aprobate ori publicate până la completarea cerințelor.
        </div>
      )}

      {loading && <div className="rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Se încarcă serviciile locației...</div>}

      {!loading && loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p>{loadError}</p>
          <button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold hover:bg-amber-100">Încearcă din nou</button>
        </div>
      )}

      {!loading && servicesLoaded && (
        <>
          <NeedOverview
            recommendedSections={recommendedSections}
            additionalSections={additionalSections}
            selected={selected}
            activeKey={activeSection?.key || ""}
            showAdditional={showAdditional}
            onToggleAdditional={toggleAdditional}
            onPick={setActiveNeedKey}
            profileLabel={profileLabel}
          />

          <LegacyServicesCard
            services={legacyServices}
            rawRemovalKeys={rawRemovalKeys}
            pendingReview={pendingReview}
            onToggleRemoval={toggleRawRemoval}
          />

          {activeSection && (
            <NeedSectionCard
              key={`${locationId}:${activeSection.key}`}
              section={activeSection}
              selected={selected}
              customByGroup={customByGroup}
              prerequisitesByKey={prerequisitesByKey}
              pendingReview={pendingReview}
              onToggle={toggle}
              onAddCustom={addCustom}
              onRemoveCustom={removeCustom}
            />
          )}
        </>
      )}

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={saving || pendingReview || !servicesLoaded || (!hasChanges && !draft)} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
            <Save className="h-4 w-4" /> Salvează draftul
          </button>
          {draft && draft.status !== "pending_review" && (
            <button disabled={saving || !servicesLoaded} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
              <Send className="h-4 w-4" /> Trimite spre verificare
            </button>
          )}
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
