import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Eye,
  FlaskConical,
  Glasses,
  Hospital,
  Info,
  Microscope,
  PackageOpen,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Store,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getServiceGroupLayout, SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { PROVIDER_SERVICE_SECTIONS } from "@/lib/providerServiceWorkspaceSections";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
  getFunctionalUnitLayout,
} from "@/lib/providerLocationFunctionalUnits";
import {
  getServiceOperationalContext,
  getServiceSearchTerms,
} from "@/lib/serviceOperationalTaxonomy";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { evaluateServicePrerequisites } from "../../../../shared/servicePrerequisiteEngine.js";

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/35 focus:ring-2 focus:ring-foreground/5";

const PROFILE_LABELS = {
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

const LEGACY_PROFILE_LABELS = {
  optica_medicala: "optică medicală",
  clinica_oftalmologica: "clinică de oftalmologie",
  cabinet_oftalmologic: "cabinet de oftalmologie",
  cabinet_optometric: "cabinet de optometrie",
  laborator_optic: "laborator optic",
  optometrist_independent: "optometrist independent",
  medic_oftalmolog_independent: "medic oftalmolog",
};

const UNIT_ICONS = {
  optical_store: Store,
  optical_cabinet: Glasses,
  optometry_cabinet: Eye,
  ophthalmology_office: Stethoscope,
  optical_workshop: Wrench,
  optical_laboratory: FlaskConical,
  ophthalmology_diagnostics: Microscope,
  ophthalmology_procedure_room: CircleDot,
  ophthalmology_surgery_unit: Hospital,
  b2b_distribution_center: PackageOpen,
};

const CAPABILITY_ICONS = {
  contact_lens_sales: CircleDot,
  contact_lens_professional_services: Eye,
  pediatric_eye_care: Users,
  ophthalmology_specialties: ShieldCheck,
  emergency_ophthalmology: Hospital,
  low_vision_rehabilitation: Glasses,
  b2b_distribution: PackageOpen,
  b2b_logistics: Building2,
  b2b_technical_support: Settings2,
};

const SERVICE_GROUP_BY_KEY = Object.fromEntries(
  Object.entries(SERVICE_GROUPS).flatMap(([group, config]) => (
    Object.keys(config.ids || {}).map((serviceKey) => [serviceKey, group])
  )),
);

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizedSearch(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function safeParse(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}
function backendFunctionMissing(error) {
  const message = String(error?.message || error?.error || error || "").toLowerCase();
  const status = Number(error?.status || error?.response?.status || 0);
  return status === 404 || /not found|not deployed|backend function|404/.test(message);
}

function legacyServiceRows(serviceKeys = []) {
  return [...new Set(serviceKeys || [])]
    .filter((serviceKey) => !SERVICE_GROUP_BY_KEY[serviceKey])
    .map((serviceKey) => ({
      id: `legacy:${serviceKey}`,
      raw_key: serviceKey,
      label: serviceKey,
      catalog_status: "legacy_or_unknown",
      is_active: true,
    }));
}

function serviceLabel(item) {
  return SERVICE_GROUPS[item.group]?.ids?.[item.id] || item.id;
}

function groupServiceKeys(serviceKeys = []) {
  const grouped = {};
  for (const serviceKey of serviceKeys) {
    const group = SERVICE_GROUP_BY_KEY[serviceKey];
    if (!group) continue;
    grouped[group] = grouped[group] || [];
    if (!grouped[group].includes(serviceKey)) grouped[group].push(serviceKey);
  }
  return normalizeSelected(grouped);
}

function normalizeSelected(selected = {}) {
  const result = {};
  Object.keys(selected).sort().forEach((group) => {
    if (!SERVICE_GROUPS[group]) return;
    const allowed = new Set(Object.keys(SERVICE_GROUPS[group].ids || {}));
    const ids = [...new Set((selected[group] || []).filter((id) => allowed.has(id)))].sort();
    if (ids.length > 0) result[group] = ids;
  });
  return result;
}

function applyDraft(approved, payload = {}) {
  const result = Object.fromEntries(Object.entries(normalizeSelected(approved)).map(([group, ids]) => [group, [...ids]]));
  for (const [group, ids] of Object.entries(normalizeSelected(payload.selected_ids || {}))) {
    result[group] = [...new Set([...(result[group] || []), ...ids])];
  }
  for (const [group, ids] of Object.entries(normalizeSelected(payload.removal_ids || {}))) {
    const removed = new Set(ids);
    result[group] = (result[group] || []).filter((id) => !removed.has(id));
  }
  return normalizeSelected(result);
}

function removalPayload(approved, desired) {
  const removals = {};
  const normalizedApproved = normalizeSelected(approved);
  const normalizedDesired = normalizeSelected(desired);
  for (const [group, ids] of Object.entries(normalizedApproved)) {
    const desiredIds = new Set(normalizedDesired[group] || []);
    const removed = ids.filter((id) => !desiredIds.has(id));
    if (removed.length > 0) removals[group] = removed;
  }
  return removals;
}

function countSelected(selected) {
  return Object.values(selected || {}).reduce((sum, ids) => sum + (ids?.length || 0), 0);
}

function configurationSignature(payload = {}) {
  const sortRows = (rows, keys) => [...(rows || [])]
    .map((row) => ({ ...row }))
    .sort((a, b) => keys.map((key) => String(a?.[key] || "")).join(":").localeCompare(keys.map((key) => String(b?.[key] || "")).join(":")));
  const serviceMap = Object.fromEntries(Object.entries(payload.service_unit_map || {}).sort(([a], [b]) => a.localeCompare(b)));
  const links = payload.resource_links || {};
  return JSON.stringify({
    selected_ids: normalizeSelected(payload.selected_ids || {}),
    raw_removal_keys: [...new Set(payload.raw_removal_keys || [])].sort(),
    suggestions: sortRows(payload.suggestions || [], ["group", "label", "functional_unit_key", "capability_key"]),
    functional_units: sortRows(payload.functional_units || [], ["unit_key", "care_setting"]),
    removal_unit_keys: [...new Set(payload.removal_unit_keys || [])].sort(),
    capabilities: sortRows(payload.capabilities || [], ["capability_key", "parent_unit_key"]),
    removal_capabilities: sortRows(payload.removal_capabilities || [], ["capability_key", "parent_unit_key"]),
    service_unit_map: serviceMap,
    cas_service_keys: [...new Set(payload.cas_service_keys || [])].sort(),
    resource_links: {
      professionals: sortRows((links.professionals || []).map((item) => ({ ...item, unit_keys: [...(item.unit_keys || [])].sort() })), ["assignment_id"]),
      equipment: sortRows(links.equipment || [], ["equipment_id", "unit_key"]),
      facilities: sortRows(links.facilities || [], ["facility_id", "unit_key"]),
    },
    resource_removals: {
      professionals: sortRows(payload.resource_removals?.professionals || [], ["assignment_id"]),
      equipment: sortRows(payload.resource_removals?.equipment || [], ["equipment_id"]),
      facilities: sortRows(payload.resource_removals?.facilities || [], ["facility_id"]),
    },
    care_setting: payload.care_setting || "",
  });
}

function selectedServiceKeys(selected) {
  return [...new Set(Object.values(selected || {}).flat())];
}

function isSelected(selected, item) {
  return (selected[item.group] || []).includes(item.id);
}

function profileLabel(location) {
  return PROFILE_LABELS[location?.provider_profile_type]
    || LEGACY_PROFILE_LABELS[location?.provider_type]
    || "profilul acestei locații";
}

function isB2B(location) {
  return ["optical_laboratory_b2b", "future_b2b_distributor"].includes(location?.provider_profile_type);
}

function possibleUnits(section) {
  return [...new Set([section.unitKey, ...(section.fallbackUnitKeys || [])].filter(Boolean))];
}

function defaultUnitForSection(section, activeUnits) {
  return possibleUnits(section).find((unitKey) => activeUnits.includes(unitKey)) || section.unitKey;
}

function resolveSectionUnit(section, selected, serviceUnitMap, activeUnits) {
  const mapped = section.items
    .filter((item) => isSelected(selected, item))
    .map((item) => serviceUnitMap[item.id])
    .find((unitKey) => activeUnits.includes(unitKey) && possibleUnits(section).includes(unitKey));
  return mapped || defaultUnitForSection(section, activeUnits);
}

function sectionsForProfile(layout, selected, sourceSections = PROVIDER_SERVICE_SECTIONS) {
  const allowed = new Set([...(layout.primary || []), ...(layout.secondary || [])]);
  const hidden = new Set(layout.hidden || []);
  return sourceSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => allowed.has(item.group) || (hidden.has(item.group) && isSelected(selected, item))),
  })).filter((section) => section.items.length > 0);
}

function unitRow(unitKey, careSetting) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const medical = definition?.kind?.startsWith("medical");
  return {
    unit_key: unitKey,
    care_setting: medical ? careSetting : (definition?.defaultCareSetting || "not_applicable"),
    note: "",
  };
}

function inferCapabilities(selected, serviceUnitMap, activeUnits) {
  const map = new Map();
  for (const serviceKey of selectedServiceKeys(selected)) {
    const context = getServiceOperationalContext(serviceKey);
    if (!context?.capabilityKey) continue;
    const parent = serviceUnitMap[serviceKey]
      || [context.unitKey, ...(context.fallbackUnitKeys || [])].find((unitKey) => activeUnits.includes(unitKey));
    if (parent) map.set(`${context.capabilityKey}:${parent}`, { capability_key: context.capabilityKey, parent_unit_key: parent, note: "" });
  }
  return [...map.values()];
}

function buildResourceLinks(config) {
  return {
    professionals: (config.assignments || [])
      .filter((item) => (item.functional_unit_keys || []).length > 0)
      .map((item) => ({ assignment_id: item.id, unit_keys: [...item.functional_unit_keys] })),
    equipment: (config.equipment || [])
      .filter((item) => item.functional_unit_key)
      .map((item) => ({ equipment_id: item.id, unit_key: item.functional_unit_key })),
    facilities: (config.facilities || [])
      .filter((item) => item.functional_unit_key)
      .map((item) => ({ facility_id: item.id, unit_key: item.functional_unit_key })),
  };
}

function capabilityIdentity(item) {
  return `${item?.capability_key || ""}:${item?.parent_unit_key || ""}`;
}

function resourceRemovalPayload(approved, desired) {
  const current = desired || { professionals: [], equipment: [], facilities: [] };
  const removals = { professionals: [], equipment: [], facilities: [] };

  const currentProfessionals = new Map((current.professionals || []).map((item) => [item.assignment_id, new Set(item.unit_keys || [])]));
  for (const item of approved.professionals || []) {
    const desiredUnits = currentProfessionals.get(item.assignment_id) || new Set();
    const removedUnits = (item.unit_keys || []).filter((unitKey) => !desiredUnits.has(unitKey));
    if (removedUnits.length > 0) removals.professionals.push({ assignment_id: item.assignment_id, unit_keys: removedUnits });
  }

  const currentEquipment = new Map((current.equipment || []).map((item) => [item.equipment_id, item.unit_key]));
  for (const item of approved.equipment || []) {
    if (currentEquipment.get(item.equipment_id) !== item.unit_key) removals.equipment.push({ equipment_id: item.equipment_id });
  }

  const currentFacilities = new Map((current.facilities || []).map((item) => [item.facility_id, item.unit_key]));
  for (const item of approved.facilities || []) {
    if (currentFacilities.get(item.facility_id) !== item.unit_key) removals.facilities.push({ facility_id: item.facility_id });
  }

  return removals;
}

function normalizeSuggestions(payload = {}) {
  return Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.custom_requests)
      ? payload.custom_requests
      : [];
}

function selectedCountForSection(selected, section) {
  return section.items.reduce((sum, item) => sum + (isSelected(selected, item) ? 1 : 0), 0);
}

function StatusBadge({ prerequisite }) {
  if (!prerequisite || prerequisite.status === "available") return null;
  const blocked = prerequisite.eligible === false;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${blocked ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
      {blocked ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {prerequisite.status_label || (blocked ? "Opțiune indisponibilă" : "Informație declarată")}
    </span>
  );
}

function ChangeBadge({ draftAddition, removalRequested, modified }) {
  if (removalRequested) return <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900">Eliminare propusă</span>;
  if (modified) return <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Modificat în draft</span>;
  if (draftAddition) return <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Nou în draft</span>;
  return null;
}

// Grupurile de servicii pentru care decontarea CAS are sens. Deliberat NU includem
// vanzarea de rame/ochelari sau reparatiile: acelea nu se deconteaza prin casa de
// asigurari, iar un marcaj acolo ar deruta furnizorul (2026-08-06).
const CAS_ELIGIBLE_GROUPS = new Set([
  "ophthalmology_consults",
  "optometry",
  "investigations",
  "procedures_surgery",
  "specialties",
  "children_and_prevention",
]);

function ServiceRow({ item, selected, approvedSelected, prerequisite, unitKey, disabled, helperText = "", onToggle, casActive = false, casEligible = false, onToggleCas }) {
  const active = isSelected(selected, item);
  const approved = isSelected(approvedSelected, item);
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  const blockerDetail = active && prerequisite?.eligible === false
    ? prerequisite.blockers?.[0]?.message
    : "";
  const detail = removalRequested
    ? "La trimiterea cererii, elementul este ascuns public până la soluționare."
    : blockerDetail || helperText;
  return (
    <>
    <button
      type="button"
      data-service-key={item.id}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(item, unitKey)}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/70 bg-card shadow-sm" : "border-border bg-card/60 hover:bg-card"}`}
    >
      <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
        {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-snug text-foreground">{serviceLabel(item)}</span>
        {detail && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span>}
      </span>
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        {!removalRequested && <StatusBadge prerequisite={prerequisite} />}
      </span>
    </button>
    {/* Marcajul CAS e un buton separat, langa card - nu poate fi imbricat in el, pentru
        ca randul de serviciu e el insusi un buton. Apare doar pe serviciile medicale
        deja bifate: pe rame sau reparatii n-are sens (2026-08-06). */}
    {active && !removalRequested && casEligible && (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={casActive}
        onClick={() => onToggleCas?.(item.id)}
        className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${casActive ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
      >
        {casActive && <Check className="h-3 w-3" />}
        Decontat CAS
      </button>
    )}
    </>
  );
}

function SelectionCard({ active, approved = false, title, description, helper, icon: Icon, disabled, onClick }) {
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/15 bg-secondary/45" : "border-border bg-card hover:bg-secondary/25"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-amber-100 text-amber-900" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm font-bold leading-snug text-foreground">{title}</span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
            {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {helper && <span className="text-[10px] font-semibold text-muted-foreground">{helper}</span>}
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        </span>
      </span>
    </button>
  );
}

function UnitSelection({ units, approvedUnits, activeUnits, selectedByUnit, primaryUnits, disabled, onToggle }) {
  const [showOptional, setShowOptional] = useState(false);
  const hiddenUnits = units.filter((unitKey) => !primaryUnits.includes(unitKey) && !activeUnits.includes(unitKey) && !approvedUnits.includes(unitKey));
  const visibleUnits = showOptional
    ? units
    : units.filter((unitKey) => primaryUnits.includes(unitKey) || activeUnits.includes(unitKey) || approvedUnits.includes(unitKey));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">1. Zonele existente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selectează tipurile de zone existente în locație. Nu este necesar să introduci separat fiecare cameră.</p>
      </div>
      <div className="mt-4 space-y-2">
        {visibleUnits.map((unitKey) => {
          const definition = getFunctionalUnitDefinition(unitKey);
          const Icon = UNIT_ICONS[unitKey] || Building2;
          const active = activeUnits.includes(unitKey);
          const count = selectedByUnit[unitKey] || 0;
          return (
            <SelectionCard
              key={unitKey}
              active={active}
              approved={approvedUnits.includes(unitKey)}
              title={definition?.title || unitKey}
              description={definition?.description || ""}
              helper={count > 0 ? `${count} opțiuni asociate` : primaryUnits.includes(unitKey) ? "Recomandat pentru acest profil" : "Opțional"}
              icon={Icon}
              disabled={disabled}
              onClick={() => onToggle(unitKey)}
            />
          );
        })}
      </div>
      {hiddenUnits.length > 0 && (
        <button type="button" onClick={() => setShowOptional((value) => !value)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Ascunde zonele opționale" : `Arată alte zone disponibile (${hiddenUnits.length})`}
        </button>
      )}
    </section>
  );
}

function CapabilitySelection({ capabilityKeys, approvedCapabilities, capabilities, activeUnits, primaryCapabilities, disabled, onToggle }) {
  const [showOptional, setShowOptional] = useState(false);
  if (capabilityKeys.length === 0) return null;
  const activeCapabilityKeys = new Set(capabilities.map((item) => item.capability_key));
  const approvedCapabilityKeys = new Set(approvedCapabilities.map((item) => item.capability_key));
  const hiddenCapabilities = capabilityKeys.filter((key) => !primaryCapabilities.includes(key) && !activeCapabilityKeys.has(key) && !approvedCapabilityKeys.has(key));
  const visibleCapabilities = showOptional
    ? capabilityKeys
    : capabilityKeys.filter((key) => primaryCapabilities.includes(key) || activeCapabilityKeys.has(key) || approvedCapabilityKeys.has(key));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">2. Activități asociate</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selectează activitățile oferite și asociază-le zonei în care se desfășoară. Acestea activează numai serviciile compatibile.</p>
      </div>
      <div className="mt-4 space-y-2">
        {visibleCapabilities.map((capabilityKey) => {
          const definition = getCapabilityDefinition(capabilityKey);
          const activeRow = capabilities.find((item) => item.capability_key === capabilityKey);
          const parentOptions = (definition?.allowedParentUnits || []).filter((unitKey) => activeUnits.includes(unitKey));
          const Icon = CAPABILITY_ICONS[capabilityKey] || CheckCircle2;
          return (
            <SelectionCard
              key={capabilityKey}
              active={Boolean(activeRow)}
              approved={approvedCapabilityKeys.has(capabilityKey)}
              title={definition?.title || capabilityKey}
              description={definition?.description || ""}
              helper={activeRow ? `Asociat: ${getFunctionalUnitDefinition(activeRow.parent_unit_key)?.shortTitle || activeRow.parent_unit_key}` : parentOptions.length === 0 ? "Selectează mai întâi o zonă compatibilă" : primaryCapabilities.includes(capabilityKey) ? "Recomandat pentru acest profil" : "Opțional"}
              icon={Icon}
              disabled={disabled || parentOptions.length === 0}
              onClick={() => onToggle(capabilityKey, parentOptions)}
            />
          );
        })}
      </div>
      {hiddenCapabilities.length > 0 && (
        <button type="button" onClick={() => setShowOptional((value) => !value)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Ascunde activitățile opționale" : `Arată alte activități (${hiddenCapabilities.length})`}
        </button>
      )}
    </section>
  );
}

function CareSettingSelector({ options, approvedValue, value, disabled, onChange }) {
  const visibleOptions = options.filter((key) => CARE_SETTINGS[key]);
  if (visibleOptions.length <= 1 || visibleOptions.every((key) => key === "not_applicable" || key === "retail_only")) return null;
  const hasVisibleSelection = visibleOptions.includes(value);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">3. Tipul activității</h2>
        {value !== approvedValue && <ChangeBadge modified />}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Alege varianta care descrie cel mai bine activitatea acestei locații. Aceasta nu modifică tipul organizației.</p>
      {!hasVisibleSelection && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">Alege o opțiune pentru a continua configurarea completă.</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleOptions.map((key) => (
          <button key={key} type="button" aria-pressed={value === key} disabled={disabled} onClick={() => onChange(key)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 ${value === key ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary"}`}>
            {CARE_SETTINGS[key].label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ResourceGroup({ title, emptyText, items, unitKey, type, disabled, links, approvedLinks, onToggle }) {
  if (items.length === 0) return <div className="rounded-xl border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground"><strong className="text-foreground">{title}</strong><div className="mt-1">{emptyText}</div></div>;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs font-bold">{title}</div>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => {
          const id = item.id;
          const assigned = type === "professionals"
            ? (links.professionals.find((link) => link.assignment_id === id)?.unit_keys || []).includes(unitKey)
            : links[type].some((link) => link[`${type === "equipment" ? "equipment" : "facility"}_id`] === id && link.unit_key === unitKey);
          const approvedAssigned = type === "professionals"
            ? (approvedLinks.professionals.find((link) => link.assignment_id === id)?.unit_keys || []).includes(unitKey)
            : approvedLinks[type].some((link) => link[`${type === "equipment" ? "equipment" : "facility"}_id`] === id && link.unit_key === unitKey);
          const removalRequested = approvedAssigned && !assigned;
          const draftAddition = assigned && !approvedAssigned;
          const label = type === "professionals" ? `${item.full_name} · ${item.professional_type || "specialist"}`
            : type === "equipment" ? item.equipment_label
              : item.facility_key;
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => onToggle(type, id, unitKey)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs disabled:opacity-60 ${removalRequested ? "bg-amber-50 hover:bg-amber-50" : "hover:bg-secondary/40"}`}>
              <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : assigned ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{removalRequested ? <X className="h-3 w-3" /> : assigned && <Check className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
              {item.verification_status && !removalRequested && !draftAddition && <span className="text-[10px] text-muted-foreground">{item.verification_status}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnitResources({ unitKey, config, disabled, links, approvedLinks, onToggle }) {
  const [open, setOpen] = useState(false);
  const professionalCount = (links.professionals || []).filter((item) => (item.unit_keys || []).includes(unitKey)).length;
  const equipmentCount = (links.equipment || []).filter((item) => item.unit_key === unitKey).length;
  const facilityCount = (links.facilities || []).filter((item) => item.unit_key === unitKey).length;
  const resourceCount = professionalCount + equipmentCount + facilityCount;
  return (
    <div className="border-t border-border/60 bg-secondary/10">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-xs font-bold">Resurse asociate zonei</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{resourceCount > 0 ? `${professionalCount} specialiști · ${equipmentCount} echipamente · ${facilityCount} facilități` : "Nicio resursă asociată încă"}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {resourceCount > 0 && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{resourceCount} asociate</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border/60 p-4 md:grid-cols-3 sm:p-5">
          <ResourceGroup title="Specialiști" emptyText="Nu există specialiști activi asociați locației." items={config.assignments || []} unitKey={unitKey} type="professionals" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
          <ResourceGroup title="Echipamente" emptyText="Nu există echipamente declarate." items={(config.equipment || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="equipment" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
          <ResourceGroup title="Facilități" emptyText="Nu există facilități declarate." items={(config.facilities || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="facilities" disabled={disabled} links={links} approvedLinks={approvedLinks} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

function CustomSuggestion({ unitKey, section, disabled, items, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const submit = () => {
    const clean = cleanText(label);
    if (!clean) return;
    onAdd({
      group: section.items[0]?.group || "optical_retail",
      label: clean,
      note: "Propus din workspace furnizor",
      functional_unit_key: unitKey,
      capability_key: section.capabilityKey || "",
    });
    setLabel("");
    setOpen(false);
  };
  return (
    <div className="border-t border-border/60 px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Redus la un singur rand (2026-08-06): blocul cu titlu si explicatie aparea
            dupa FIECARE grup de servicii si rupea lista de bife. Explicatia ramane
            vizibila cand deschizi formularul. */}
        <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Nu găsești opțiunea? Propune manual</button>
      </div>
      {open && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Propunerea primește status propriu și nu intră în profil sau matching până la clasificare.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Denumirea produsului sau serviciului" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} /><button type="button" onClick={submit} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Adaugă în draft</button></div>
        </>
      )}
      {items.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">{item.label}<button type="button" disabled={disabled} onClick={() => onRemove(item)} className="rounded-full p-0.5 hover:bg-amber-100"><X className="h-3 w-3" /></button></span>)}</div>}
    </div>
  );
}

function UnitAccordion({ unitKey, sections, selected, approvedSelected, serviceUnitMap, prerequisites, config, resourceLinks, approvedResourceLinks, customSuggestions, open, disabled, casServiceKeys = [], onToggleCas, onOpen, onToggleService, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion }) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const Icon = UNIT_ICONS[unitKey] || Building2;
  const selectedCount = sections.reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  // Sectiunile dintr-o zona sunt pliabile (2026-08-06). Inainte, deschiderea unei zone
  // randa toate sectiunile cu toate randurile lor simultan - pana la ~24 de randuri per
  // sectiune, plus titlu si paragraf de descriere pentru fiecare.
  // Pornesc DESCHISE doar sectiunile care au deja selectii. Doua motive:
  //  1. utilizatorul vede imediat ce si-a configurat, fara sa caute;
  //  2. filtrele din invelis ("Oferta selectata", "Observatii") scaneaza randurile din
  //     DOM - daca sectiunile cu selectii ar fi inchise, acele filtre ar afisa gol.
  const [openSections, setOpenSections] = useState(() => new Set(
    sections.filter((section) => selectedCountForSection(selected, section) > 0).map((section) => section.key),
  ));
  const toggleSection = (sectionKey) => setOpenSections((current) => {
    const next = new Set(current);
    if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
    return next;
  });
  return (
    <section className={`overflow-hidden rounded-[22px] border bg-card transition ${open ? "border-foreground/20 shadow-sm" : "border-border"}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 sm:px-5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {/* Descrierea zonei a fost eliminata (2026-08-06): pe telefon aparea imediat
              dupa titlul zonei, care era deja repetat de doua ori mai sus, si impingea
              prima bifa reala si mai jos. Aceeasi informatie exista in pasul de alegere
              a zonelor, unde chiar ajuta la decizie. */}
          {sections.map((section) => {
            const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
            const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
            const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
            return (
              <div key={section.key} className="border-t border-border/60 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-2.5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={openSections.has(section.key)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${openSections.has(section.key) ? "rotate-180" : ""}`} />
                    <h3 className="min-w-0 truncate text-xs font-bold">{section.title}</h3>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{selectedCountForSection(selected, section)} din {section.items.length}</span>
                  </button>
                  {openSections.has(section.key) && availableParents.length > 1 && (
                    <label className="text-[10px] font-semibold text-muted-foreground">Se realizează în
                      <select disabled={disabled} value={activeUnit} onChange={(event) => onChangeSectionUnit(section, event.target.value)} className="ml-2 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground">
                        {availableParents.map((key) => <option key={key} value={key}>{getFunctionalUnitDefinition(key)?.shortTitle || key}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {openSections.has(section.key) && (
                  <>
                    {section.description && <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">{section.description}</p>}
                    {section.note && <div className="mx-4 mb-3 flex gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:mx-5"><Info className="mt-0.5 h-4 w-4 shrink-0" /> {section.note}</div>}
                    <div className="space-y-2 border-t border-border/50 p-3 sm:p-4">
                      {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey={activeUnit} disabled={disabled} onToggle={onToggleService} casEligible={CAS_ELIGIBLE_GROUPS.has(item.group)} casActive={casServiceKeys.includes(item.id)} onToggleCas={onToggleCas} />)}
                    </div>
                    <CustomSuggestion unitKey={unitKey} section={section} disabled={disabled} items={suggestions} onAdd={onAddSuggestion} onRemove={onRemoveSuggestion} />
                  </>
                )}
              </div>
            );
          })}
          <UnitResources unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} approvedLinks={approvedResourceLinks} onToggle={onToggleResource} />
        </div>
      )}
    </section>
  );
}

function GlobalServiceSections({ sections, selected, approvedSelected, prerequisites, disabled, onToggleService }) {
  if (sections.length === 0) return null;
  const helperText = {
    home_visit_eye_care: "Te deplasezi la domiciliul pacientului, pentru persoane care nu pot ajunge la locație.",
    workplace_vision_screening: "Testezi vederea angajaților la sediul companiei, inclusiv pentru medicina muncii.",
    employer_glasses_reimbursement: "Emiți documentele de care are nevoie angajatorul ca să deconteze ochelarii (HG 1028/2006).",
    mobile_optical_unit: "Ai o unitate mobilă dotată, care se deplasează la client.",
    school_vision_screening: "Faci screening de vedere în școli și grădinițe.",
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-secondary/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold">4. La nivelul locației</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Aceste opțiuni se aplică întregii locații, nu unei singure zone.</p>
      </div>
      {sections.map((section) => (
        <div key={section.key} className="border-b border-border/60 last:border-b-0">
          <div className="bg-card px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold">{section.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{section.description}</p>
            {/* Principiul declarativ, la nivel de sectiune (2026-08-06): se aplica tuturor
                optiunilor de aici, nu doar uneia. Inainte era ascuns in textul de ajutor
                al bifei CAS, care a fost eliminata. */}
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Informații declarate de furnizor. Nu cerem documente; pacientul confirmă direct cu locația.
            </p>
          </div>
          <div className="border-t border-border/50">
            {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey="" disabled={disabled} helperText={helperText[item.id] || ""} onToggle={onToggleService} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function ServiceCatalogIntro({ activeUnits, selectedCount }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">5. Oferta fiecărei zone</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Deschide fiecare zonă și selectează oferta declarată ca disponibilă. Specialiștii, dotările și facilitățile pot fi completate opțional și nu blochează serviciile.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{selectedCount} opțiuni · {activeUnits.length} zone</span>
      </div>
    </section>
  );
}

function ServicesSidebar({ activeUnits, capabilities, selectedCount, selectedByUnit, sections, selected, b2b, careSetting, allowedCareSettings, resourceLinks, unitOrder }) {
  const publicRows = sections
    .map((section) => ({ ...section, count: selectedCountForSection(selected, section) }))
    .filter((section) => section.count > 0 && section.publicLabel);
  const globalOptionCount = sections
    .filter((section) => section.key === "business_attributes")
    .reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const serviceCount = Math.max(0, selectedCount - globalOptionCount);
  const orderedActiveUnits = [
    ...unitOrder.filter((unitKey) => activeUnits.includes(unitKey)),
    ...activeUnits.filter((unitKey) => !unitOrder.includes(unitKey)),
  ];
  const resourceUnitKeys = new Set([
    ...(resourceLinks.professionals || []).flatMap((item) => item.unit_keys || []),
    ...(resourceLinks.equipment || []).map((item) => item.unit_key),
    ...(resourceLinks.facilities || []).map((item) => item.unit_key),
  ].filter(Boolean));
  const careSettingComplete = allowedCareSettings.includes(careSetting);
  const steps = [
    { number: 1, label: "Zonele locației", detail: activeUnits.length > 0 ? `${activeUnits.length} configurate` : "Opțional", done: activeUnits.length > 0, optional: true },
    { number: 2, label: "Activități speciale", detail: capabilities.length > 0 ? `${capabilities.length} selectate` : "Opțional", done: capabilities.length > 0, optional: true },
    { number: 3, label: "Mod de funcționare", detail: careSettingComplete ? CARE_SETTINGS[careSetting]?.label : "Opțional", done: careSettingComplete, optional: true },
    { number: 4, label: "Opțiuni generale", detail: globalOptionCount > 0 ? `${globalOptionCount} selectate` : "Opțional", done: globalOptionCount > 0, optional: true },
    { number: 5, label: "Produse și servicii", detail: serviceCount > 0 ? `${serviceCount} selectate` : "Nicio selecție", done: serviceCount > 0, optional: true },
  ];

  return (
    <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <h2 className="text-sm font-bold">Progres configurare</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Opțiuni</div>
          <div className="mt-1 text-xl font-extrabold">{selectedCount}</div>
        </div>
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Spații</div>
          <div className="mt-1 text-xl font-extrabold">{activeUnits.length}</div>
        </div>
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Activități</div>
          <div className="mt-1 text-xl font-extrabold">{capabilities.length}</div>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-xs font-bold">Ordinea recomandată</h3>
        <ol className="mt-3 space-y-2">
          {steps.map((step) => (
            <li key={step.number} className="flex items-center gap-3 rounded-2xl bg-secondary/30 px-3 py-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground"}`}>
                {step.done ? <Check className="h-3.5 w-3.5" /> : step.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">{step.label}</span>
                <span className={`mt-0.5 block truncate text-[10px] ${!step.done && !step.optional ? "text-amber-700" : "text-muted-foreground"}`}>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-bold">Spații selectate</h3>
        {orderedActiveUnits.length > 0 ? (
          <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
            {orderedActiveUnits.map((unitKey) => {
              const definition = getFunctionalUnitDefinition(unitKey);
              const Icon = UNIT_ICONS[unitKey] || Building2;
              return (
                <li key={unitKey} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary"><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{definition?.shortTitle || definition?.title || unitKey}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{selectedByUnit[unitKey] || 0} opțiuni asociate</span>
                  </span>
                  {resourceUnitKeys.has(unitKey) && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-semibold text-muted-foreground">Resurse</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/25 px-3 py-4 text-center text-xs text-muted-foreground">Nu ai selectat încă nicio zonă.</p>
        )}
      </div>

      {capabilities.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-bold">Activități active</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {capabilities.map((item) => (
              <span key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-full bg-secondary px-2.5 py-1.5 text-[10px] font-semibold">
                {getCapabilityDefinition(item.capability_key)?.shortTitle || getCapabilityDefinition(item.capability_key)?.title || item.capability_key}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-bold">{b2b ? "Ofertă profesională B2B" : "Previzualizare după aprobare"}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {b2b ? "Oferta este prezentată separat și nu intră în filtrele pentru pacienți." : "Pacienții vor vedea filtre simple după nevoie, după aprobarea modificărilor."}
        </p>
        {!b2b && (
          publicRows.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {publicRows.map((row) => (
                <span key={row.key} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 text-[11px] font-semibold">
                  {row.publicLabel}<span className="text-muted-foreground">{row.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/25 px-3 py-4 text-center text-xs text-muted-foreground">Nu ai selectat încă servicii publice.</p>
          )
        )}
      </div>
    </aside>
  );
}

function DependencyRemovalDialog({ request, onCancel, onConfirm }) {
  if (!request) return null;
  const approved = request.approved === true;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dependency-removal-title" className="w-full max-w-lg rounded-[24px] border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-900"><AlertTriangle className="h-4 w-4" /></span>
          <div>
            <h2 id="dependency-removal-title" className="text-base font-bold">{approved ? "Propune eliminarea cu dependențe" : "Elimină opțiunea din draft"}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">„{request.label}” are elemente asociate. Confirmarea le va marca împreună, astfel încât configurația să rămână coerentă.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.serviceCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Servicii</div></div>
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.capabilityCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Activități</div></div>
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.resourceCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Resurse</div></div>
        </div>
        {approved && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">Configurația aprobată nu este ștearsă imediat. După trimiterea cererii, serviciile afectate sunt ascunse public până la soluționare.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Renunță</button>
          <button type="button" onClick={onConfirm} className="rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background">{approved ? "Propune eliminarea tuturor" : "Elimină din draft"}</button>
        </div>
      </div>
    </div>
  );
}

function LegacyServices({ services, rawRemovalKeys, disabled, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!services.length) return null;
  return (
    <section className="overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50/60">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"><AlertTriangle className="h-4 w-4 text-amber-800" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-amber-950">Date existente care necesită migrare</span><span className="text-[11px] text-amber-900/75">{services.length} chei vechi, ambigue sau necunoscute</span></span><ChevronDown className={`h-4 w-4 text-amber-900 transition ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="space-y-2 border-t border-amber-200 p-4 sm:p-5">{services.map((service) => { const marked = rawRemovalKeys.includes(service.raw_key); return <div key={`${service.id}:${service.raw_key}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5"><div><div className="text-xs font-bold">{service.label || service.raw_key}</div><div className="mt-1 text-[10px] text-muted-foreground">{service.raw_key}</div></div><button type="button" disabled={disabled} onClick={() => onToggle(service.raw_key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${marked ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-background"}`}>{marked ? "Eliminare propusă" : "Propune eliminarea"}</button></div>; })}</div>}
    </section>
  );
}

export default function ProviderServicesWorkspaceOperational({ locationId, location, onWorkspaceSnapshot, query: externalQuery, onQueryChange }) {
  // Actiunile (save/submit/withdraw) sunt expuse in sus prin snapshot, ca invelisul de
  // trei coloane sa le poata apela direct. Inainte (pana in 2026-08-06) invelisul gasea
  // butoanele cautand textul romanesc exact ("Salveaza draftul" etc.) si le da click prin
  // DOM - o legatura care se rupea silentios la orice redenumire de buton.
  // Ref-ul tine mereu ultimele handlere; functiile expuse raman stabile ca identitate,
  // altfel snapshot-ul s-ar schimba la fiecare randare si ar declansa o bucla.
  const actionsRef = useRef({});
  const stableActions = useMemo(() => ({
    onSave: () => actionsRef.current.save?.(),
    onSubmit: () => actionsRef.current.submit?.(),
    onWithdraw: () => actionsRef.current.withdraw?.(),
  }), []);
  const [config, setConfig] = useState(null);
  const [remoteCatalog, setRemoteCatalog] = useState(null);
  const [persistenceMode, setPersistenceMode] = useState("v2");
  const [draft, setDraft] = useState(null);
  const [approvedSelected, setApprovedSelected] = useState({});
  const [selected, setSelected] = useState({});
  const [approvedUnits, setApprovedUnits] = useState([]);
  const [activeUnits, setActiveUnits] = useState([]);
  const [approvedCapabilities, setApprovedCapabilities] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [approvedServiceUnitMap, setApprovedServiceUnitMap] = useState({});
  const [serviceUnitMap, setServiceUnitMap] = useState({});
  // Cheile serviciilor marcate ca decontate prin CAS (2026-08-06).
  const [casServiceKeys, setCasServiceKeys] = useState([]);
  const [approvedResourceLinks, setApprovedResourceLinks] = useState({ professionals: [], equipment: [], facilities: [] });
  const [resourceLinks, setResourceLinks] = useState({ professionals: [], equipment: [], facilities: [] });
  const [approvedCareSetting, setApprovedCareSetting] = useState("not_applicable");
  const [careSetting, setCareSetting] = useState("not_applicable");
  const [suggestions, setSuggestions] = useState([]);
  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);
  const [openUnit, setOpenUnit] = useState("");
  // Cautarea poate fi controlata din exterior (invelisul de trei coloane are propria
  // caseta de cautare in antet). Inainte, invelisul scria valoarea direct in input prin
  // setter-ul nativ al React-ului si un eveniment sintetic - un truc pe interiorul
  // bibliotecii, care s-ar rupe tacit la o schimbare de versiune React.
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = onQueryChange || setInternalQuery;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baselineSignature, setBaselineSignature] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const serviceLayout = useMemo(() => remoteCatalog?.group_layout || getServiceGroupLayout(location?.provider_profile_type, location?.provider_type), [location?.provider_profile_type, location?.provider_type, remoteCatalog]);
  const operationalLayout = useMemo(() => getFunctionalUnitLayout(location?.provider_profile_type, location?.provider_type), [location?.provider_profile_type, location?.provider_type]);
  const profileSections = useMemo(() => sectionsForProfile(serviceLayout, selected, remoteCatalog?.provider_sections?.length ? remoteCatalog.provider_sections : PROVIDER_SERVICE_SECTIONS), [serviceLayout, selected, remoteCatalog]);
  const globalSections = useMemo(() => profileSections.filter((section) => section.key === "business_attributes"), [profileSections]);
  const unitSections = useMemo(() => profileSections.filter((section) => section.key !== "business_attributes"), [profileSections]);
  const primaryUnits = operationalLayout.primaryUnits || operationalLayout.primary || [];
  const optionalUnits = operationalLayout.optionalUnits || operationalLayout.optional || [];
  const selectableUnits = [...new Set([...primaryUnits, ...optionalUnits])];
  const primaryCapabilities = operationalLayout.primaryCapabilities || [];
  const optionalCapabilities = operationalLayout.optionalCapabilities || [];
  const selectableCapabilities = [...new Set([...primaryCapabilities, ...optionalCapabilities])];

  const sectionsByUnit = useMemo(() => {
    const map = {};
    for (const section of unitSections) {
      const unitKey = resolveSectionUnit(section, selected, serviceUnitMap, activeUnits);
      if (!unitKey || !activeUnits.includes(unitKey)) continue;
      map[unitKey] = map[unitKey] || [];
      map[unitKey].push(section);
    }
    return map;
  }, [profileSections, selected, serviceUnitMap, activeUnits]);

  const selectedByUnit = useMemo(() => {
    const result = {};
    for (const serviceKey of selectedServiceKeys(selected)) {
      const context = getServiceOperationalContext(serviceKey);
      if (context?.sectionKey === "business_attributes") continue;
      const unitKey = serviceUnitMap[serviceKey] || context?.unitKey;
      if (unitKey) result[unitKey] = (result[unitKey] || 0) + 1;
    }
    return result;
  }, [selected, serviceUnitMap]);

  const searchResults = useMemo(() => {
    const needle = normalizedSearch(query);
    if (!needle) return [];
    return profileSections.flatMap((section) => section.items.map((item) => ({ section, item })))
      .filter(({ section, item }) => normalizedSearch([
        section.title,
        section.description,
        serviceLabel(item),
        ...getServiceSearchTerms(item.id),
      ].join(" ")).includes(needle));
  }, [query, profileSections]);

  const selectedCount = countSelected(selected) + suggestions.length;
  const pendingReview = draft?.status === "pending_review";
  const editable = config?.can_edit_services !== false && !pendingReview;
  const visibleUnits = useMemo(
    () => activeUnits.filter((unitKey) => sectionsByUnit[unitKey]?.length > 0),
    [activeUnits, sectionsByUnit],
  );
  const isB2BProfile = isB2B(location);

  const buildPayload = () => {
    const normalizedSelected = normalizeSelected(selected);
    const unitRows = activeUnits.map((unitKey) => unitRow(unitKey, careSetting));
    const selectedKeys = selectedServiceKeys(normalizedSelected);
    const completeServiceMap = Object.fromEntries(selectedKeys.map((serviceKey) => {
      const context = getServiceOperationalContext(serviceKey);
      if (context?.sectionKey === "business_attributes") return [serviceKey, ""];
      const current = serviceUnitMap[serviceKey];
      const fallback = [context?.unitKey, ...(context?.fallbackUnitKeys || [])].find((unitKey) => activeUnits.includes(unitKey));
      return [serviceKey, current && activeUnits.includes(current) ? current : fallback || ""];
    }).filter(([, unitKey]) => unitKey));
    return {
      selected_ids: normalizedSelected,
      removal_ids: removalPayload(approvedSelected, normalizedSelected),
      raw_removal_keys: [...new Set(rawRemovalKeys)],
      suggestions,
      functional_units: unitRows,
      removal_unit_keys: approvedUnits.filter((unitKey) => !activeUnits.includes(unitKey)),
      capabilities,
      removal_capabilities: approvedCapabilities.filter((item) => !capabilities.some((current) => capabilityIdentity(current) === capabilityIdentity(item))),
      service_unit_map: completeServiceMap,
      // Serviciile marcate ca decontate prin CAS (2026-08-06). Lista paralela, dupa
      // acelasi tipar ca service_unit_map: nu schimba structura serviciilor, doar
      // adauga o proprietate pe cele deja selectate. Absenta unei chei = nedecontat.
      cas_service_keys: selectedKeys.filter((serviceKey) => casServiceKeys.includes(serviceKey)),
      resource_links: resourceLinks,
      resource_removals: resourceRemovalPayload(approvedResourceLinks, resourceLinks),
      care_setting: careSetting,
    };
  };

  const currentSignature = useMemo(
    () => configurationSignature(buildPayload()),
    [selected, approvedSelected, approvedUnits, activeUnits, approvedCapabilities, capabilities, serviceUnitMap, casServiceKeys, approvedResourceLinks, resourceLinks, careSetting, suggestions, rawRemovalKeys],
  );
  const dirty = baselineSignature !== null && currentSignature !== baselineSignature;

  const draftPrerequisites = useMemo(() => {
    if (!config) return {};
    const professionalUnits = Object.fromEntries(
      (resourceLinks.professionals || []).map((item) => [item.assignment_id, item.unit_keys || []]),
    );
    const equipmentUnits = Object.fromEntries(
      (resourceLinks.equipment || []).map((item) => [item.equipment_id, item.unit_key || ""]),
    );
    const facilityUnits = Object.fromEntries(
      (resourceLinks.facilities || []).map((item) => [item.facility_id, item.unit_key || ""]),
    );
    const assignments = (config.assignments || []).map((item) => ({
      ...item,
      functional_unit_keys: professionalUnits[item.id] || [],
    }));
    const professionals = (config.assignments || []).map((item) => ({
      id: item.professional_id,
      verification_status: item.verification_status,
      professional_type: item.professional_type,
    }));
    const equipment = (config.equipment || []).map((item) => ({
      ...item,
      functional_unit_key: equipmentUnits[item.id] || "",
    }));
    const facilities = (config.facilities || []).map((item) => ({
      ...item,
      functional_unit_key: facilityUnits[item.id] || "",
    }));
    const context = {
      location,
      assignments,
      professionals,
      equipment,
      facilities,
      functionalUnits: activeUnits.map((unitKey) => ({ ...unitRow(unitKey, careSetting), is_active: true })),
      capabilities: capabilities.map((item) => ({ ...item, is_active: true })),
      service_unit_map: serviceUnitMap,
      enforceUnitScope: true,
    };
    return Object.fromEntries(selectedServiceKeys(selected).map((serviceKey) => {
      const operationalContext = getServiceOperationalContext(serviceKey);
      return [serviceKey, evaluateServicePrerequisites(serviceKey, {
        ...context,
        serviceUnitKey: serviceUnitMap[serviceKey] || operationalContext?.unitKey || "",
        capabilityKey: operationalContext?.capabilityKey || "",
      })];
    }));
  }, [activeUnits, capabilities, careSetting, config, location, resourceLinks, selected, serviceUnitMap]);

  const readiness = useMemo(() => {
    const selectedKeys = selectedServiceKeys(selected);
    const publicServiceKeys = selectedKeys.filter((serviceKey) => getServiceOperationalContext(serviceKey)?.sectionKey !== "business_attributes");
    const globalOptionCount = selectedKeys.length - publicServiceKeys.length;
    return {
      publicServiceKeys,
      globalOptionCount,
      issueServiceKeys: [],
      blockers: [],
      configurationComplete: true,
    };
  }, [selected]);

  const workspaceSnapshot = useMemo(() => {
    const itemByKey = Object.fromEntries(profileSections.flatMap((section) => section.items.map((item) => [item.id, item])));
    const units = visibleUnits.map((unitKey, index) => ({
      index,
      key: unitKey,
      title: getFunctionalUnitDefinition(unitKey)?.shortTitle || getFunctionalUnitDefinition(unitKey)?.title || unitKey,
      // Descrierea ajunge pe cardul din ecranul-lista, unde chiar ajuta la decizie
      // inainte sa intri. In interiorul zonei era doar o repetare (2026-08-06).
      description: getFunctionalUnitDefinition(unitKey)?.description || "",
      selected: selectedByUnit[unitKey] || 0,
      total: [...new Set((sectionsByUnit[unitKey] || []).flatMap((section) => section.items.map((item) => item.id)))].length,
    }));
    const adminNote = ["needs_more_info", "rejected"].includes(draft?.status) ? cleanText(draft?.admin_note) : "";
    const actionStatus = pendingReview
      ? "Modificări trimise spre aprobare"
      : dirty
        ? "Ai modificări nesalvate"
        : draft
          ? "Draft salvat"
          : "Nu există modificări nesalvate";
    const actionMessage = adminNote
      || (dirty ? "Salvează modificările înainte de trimitere." : "")
      || (readiness.configurationComplete ? "Configurația este pregătită pentru trimitere." : readiness.blockers[0]?.message || "");
    return {
      units,
      selectedCount: readiness.publicServiceKeys.length,
      globalOptionCount: readiness.globalOptionCount,
      suggestionCount: suggestions.length,
      unitCount: activeUnits.length,
      capabilityCount: capabilities.length,
      issueCount: readiness.blockers.length,
      issueServiceKeys: readiness.issueServiceKeys,
      blockers: readiness.blockers,
      selectedServices: readiness.publicServiceKeys.map((serviceKey) => serviceLabel(itemByKey[serviceKey] || { id: serviceKey, label: serviceKey })),
      careSetting: CARE_SETTINGS[careSetting]?.label || "",
      status: draft ? (SUBMISSION_STATUS_LABELS[draft.status] || draft.status) : "",
      dirty,
      configurationComplete: readiness.configurationComplete,
      readyToSubmit: Boolean(draft && editable && !dirty && readiness.configurationComplete),
      adminNote,
      conflictMessage: conflicts[0]?.message || "",
      actionStatus,
      actionMessage,
      canSave: Boolean(!saving && editable && dirty),
      canSubmit: Boolean(!saving && draft && editable && !dirty && readiness.configurationComplete),
      canWithdraw: Boolean(!saving && pendingReview && persistenceMode === "v2"),
      hasSave: true,
      hasSubmit: Boolean(draft && draft.status !== "pending_review"),
      hasWithdraw: Boolean(pendingReview && persistenceMode === "v2"),
      // Cate servicii sunt APROBATE, adica vizibile efectiv pacientilor - distinct de
      // cele doar bifate in draft. Pragul "profilul apare in cautari" e cel putin unul
      // aprobat: verificat in motorul de cautare, asta e linia intre rezultat confirmat
      // si profil aratat doar ca alternativa neconfirmata, cu avertisment.
      approvedCount: selectedServiceKeys(approvedSelected).filter(
        (serviceKey) => getServiceOperationalContext(serviceKey)?.sectionKey !== "business_attributes",
      ).length,
      pendingReview,
      ...stableActions,
    };
  }, [activeUnits, approvedSelected, capabilities.length, careSetting, conflicts, dirty, draft, editable, pendingReview, persistenceMode, profileSections, readiness, saving, sectionsByUnit, selectedByUnit, stableActions, suggestions.length, visibleUnits]);

  useEffect(() => {
    onWorkspaceSnapshot?.(workspaceSnapshot);
  }, [onWorkspaceSnapshot, workspaceSnapshot]);

  useEffect(() => {
    if (!loading && baselineSignature === null) setBaselineSignature(currentSignature);
  }, [loading, baselineSignature, currentSignature]);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setBaselineSignature(null);
    setError("");
    setMessage("");
    setConflicts([]);

    const invoke = (name, payload) => base44.functions.invoke(name, payload)
      .catch((requestError) => ({
        data: {
          error: requestError.response?.data?.error || requestError.message,
          status: requestError.response?.status || 0,
        },
      }));

    const [catalogResponse, configResponse, submissionResponse] = await Promise.all([
      invoke("getServiceSearchCatalog", {
        profile_type: location?.provider_profile_type || "",
        provider_type: location?.provider_type || "",
      }),
      invoke("getProviderServiceConfiguration", { location_id: locationId }),
      invoke("providerServiceConfigurationOps", { action: "list_mine", location_id: locationId }),
    ]);

    if (!catalogResponse.data?.error && catalogResponse.data?.catalog_version === 2) {
      setRemoteCatalog(catalogResponse.data);
    } else {
      setRemoteCatalog(null);
    }

    let nextConfig;
    let submissions;
    let compatibility = false;
    if (!configResponse.data?.error && !submissionResponse.data?.error) {
      nextConfig = configResponse.data || {};
      submissions = submissionResponse.data?.submissions || [];
      setConflicts(submissionResponse.data?.conflicts || []);
    } else if (backendFunctionMissing(configResponse.data) || backendFunctionMissing(submissionResponse.data)) {
      const [legacyServices, legacySubmissions] = await Promise.all([
        invoke("getProviderLocationServices", { location_id: locationId }),
        invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }),
      ]);
      if (legacyServices.data?.error || legacySubmissions.data?.error) {
        setError(legacyServices.data?.error || legacySubmissions.data?.error || "Nu am putut încărca configurația.");
        setLoading(false);
        return;
      }
      const serviceKeys = legacyServices.data?.service_keys || [];
      nextConfig = {
        service_keys: serviceKeys,
        legacy_or_unknown_services: legacyServiceRows(serviceKeys),
        functional_units: [],
        capabilities: [],
        service_unit_map: {},
        prerequisites_by_key: {},
        can_edit_services: true,
      };
      submissions = legacySubmissions.data?.submissions || [];
      setConflicts([]);
      compatibility = true;
      setMessage("Catalogul semantic V2 este disponibil local. Asocierea avansată a spațiilor și resurselor se salvează după publicarea endpointurilor V2.");
    } else {
      setError(configResponse.data?.error || submissionResponse.data?.error || "Nu am putut încărca configurația.");
      setLoading(false);
      return;
    }

    setPersistenceMode(compatibility ? "legacy" : "v2");
    const approved = groupServiceKeys(nextConfig.service_keys || []);
    const activeSubmissions = submissions.filter((submission) => submission.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(submission.status));
    const ownDraft = activeSubmissions.find((submission) => submission.status === "pending_review") || activeSubmissions.find((submission) => ["draft", "needs_more_info"].includes(submission.status)) || null;
    const payload = safeParse(ownDraft?.payload_json);
    const desired = ownDraft ? applyDraft(approved, payload) : approved;
    const persistedUnits = (nextConfig.functional_units || []).filter((item) => item.is_active !== false).map((item) => item.unit_key);
    const initialUnits = [...new Set(payload.functional_units?.map((item) => item.unit_key)
      || (persistedUnits.length > 0 ? persistedUnits : nextConfig.inferred_functional_unit_keys || primaryUnits))]
      .filter((unitKey) => selectableUnits.includes(unitKey));
    const initialMap = { ...(nextConfig.service_unit_map || {}), ...(payload.service_unit_map || {}) };
    const persistedCapabilities = (nextConfig.capabilities || []).filter((item) => item.is_active !== false).map((item) => ({ capability_key: item.capability_key, parent_unit_key: item.parent_unit_key, note: item.note || "" }));
    const inferred = inferCapabilities(desired, initialMap, initialUnits);
    const initialCapabilities = payload.capabilities || (persistedCapabilities.length > 0 ? persistedCapabilities : inferred)
      .filter((item) => selectableCapabilities.includes(item.capability_key) && initialUnits.includes(item.parent_unit_key));
    setConfig(nextConfig);
    setDraft(ownDraft);
    const approvedLinks = buildResourceLinks(nextConfig);
    const initialResourceLinks = payload.resource_links || approvedLinks;
    setApprovedSelected(approved);
    setSelected(desired);
    setApprovedUnits(persistedUnits);
    setActiveUnits(initialUnits);
    setApprovedCapabilities(persistedCapabilities);
    setCapabilities(initialCapabilities);
    setApprovedServiceUnitMap(nextConfig.service_unit_map || {});
    setServiceUnitMap(initialMap);
    // CAS: draftul are prioritate; daca nu exista draft, luam ce e deja publicat.
    const persistedCas = Array.isArray(nextConfig.cas_service_keys) ? nextConfig.cas_service_keys : [];
    setCasServiceKeys(Array.isArray(payload.cas_service_keys) ? payload.cas_service_keys : persistedCas);
    setApprovedResourceLinks(approvedLinks);
    setResourceLinks(initialResourceLinks);
    const allowedCareSettings = operationalLayout.careSettings || [];
    const persistedCareSetting = payload.care_setting || nextConfig.care_setting || "";
    const hasCommercialSpace = initialUnits.includes("optical_store");
    const hasClinicalSpace = initialUnits.some((unitKey) => ["optical_cabinet", "optometry_cabinet", "ophthalmology_office", "ophthalmology_diagnostics", "ophthalmology_procedure_room", "ophthalmology_surgery_unit"].includes(unitKey));
    const recommendedCareSetting = hasCommercialSpace && hasClinicalSpace && allowedCareSettings.includes("mixed")
      ? "mixed"
      : allowedCareSettings[0] || "not_applicable";
    const approvedCare = nextConfig.care_setting || recommendedCareSetting;
    setApprovedCareSetting(approvedCare);
    setCareSetting(allowedCareSettings.includes(persistedCareSetting) ? persistedCareSetting : recommendedCareSetting);
    setSuggestions(normalizeSuggestions(payload));
    setRawRemovalKeys(payload.raw_removal_keys || []);
    setOpenUnit(initialUnits[0] || "");
    setLoading(false);
  };

  useEffect(() => {
    setQuery("");
    load();
  }, [locationId]);

  const servicesForUnit = (unitKey) => selectedServiceKeys(selected).filter((serviceKey) => {
    const context = getServiceOperationalContext(serviceKey);
    if (context?.sectionKey === "business_attributes") return false;
    return (serviceUnitMap[serviceKey] || context?.unitKey || "") === unitKey;
  });

  const restoreApprovedServices = (predicate) => {
    const keys = selectedServiceKeys(approvedSelected).filter(predicate);
    if (keys.length === 0) return;
    setSelected((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([group, ids]) => [group, [...(ids || [])]]));
      for (const serviceKey of keys) {
        const group = SERVICE_GROUP_BY_KEY[serviceKey];
        if (!group) continue;
        next[group] = [...new Set([...(next[group] || []), serviceKey])];
      }
      return next;
    });
    setServiceUnitMap((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((serviceKey) => [serviceKey, approvedServiceUnitMap[serviceKey]]).filter(([, unitKey]) => unitKey)),
    }));
  };

  const restoreApprovedResourcesForUnit = (unitKey) => {
    setResourceLinks((current) => {
      const next = {
        professionals: current.professionals.map((item) => ({ ...item, unit_keys: [...(item.unit_keys || [])] })),
        equipment: [...current.equipment],
        facilities: [...current.facilities],
      };
      for (const approved of approvedResourceLinks.professionals || []) {
        if (!(approved.unit_keys || []).includes(unitKey)) continue;
        const index = next.professionals.findIndex((item) => item.assignment_id === approved.assignment_id);
        if (index >= 0) next.professionals[index] = { ...next.professionals[index], unit_keys: [...new Set([...(next.professionals[index].unit_keys || []), unitKey])] };
        else next.professionals.push({ assignment_id: approved.assignment_id, unit_keys: [unitKey] });
      }
      for (const type of ["equipment", "facilities"]) {
        const idField = type === "equipment" ? "equipment_id" : "facility_id";
        for (const approved of approvedResourceLinks[type] || []) {
          if (approved.unit_key !== unitKey) continue;
          const index = next[type].findIndex((item) => item[idField] === approved[idField]);
          if (index >= 0) next[type][index] = { ...approved };
          else next[type].push({ ...approved });
        }
      }
      return next;
    });
  };

  const restoreApprovedUnit = (unitKey) => {
    setActiveUnits((current) => [...new Set([...current, unitKey])]);
    setCapabilities((current) => {
      const restored = approvedCapabilities.filter((item) => item.parent_unit_key === unitKey);
      const existing = new Set(current.map(capabilityIdentity));
      return [...current, ...restored.filter((item) => !existing.has(capabilityIdentity(item)))];
    });
    restoreApprovedServices((serviceKey) => approvedServiceUnitMap[serviceKey] === unitKey);
    restoreApprovedResourcesForUnit(unitKey);
    setOpenUnit(unitKey);
    setMessage("Solicitarea de eliminare a spațiului și a dependențelor aprobate a fost anulată.");
  };

  const restoreApprovedCapability = (capabilityKey, approvedRow) => {
    setCapabilities((current) => [...current, { ...approvedRow }]);
    restoreApprovedServices((serviceKey) => getServiceOperationalContext(serviceKey)?.capabilityKey === capabilityKey);
    setMessage("Solicitarea de eliminare a activității și a serviciilor aprobate a fost anulată.");
  };

  const applyUnitRemoval = (unitKey) => {
    const serviceKeys = new Set(servicesForUnit(unitKey));
    setSelected((current) => Object.fromEntries(Object.entries(current).map(([group, ids]) => [group, (ids || []).filter((id) => !serviceKeys.has(id))])));
    setServiceUnitMap((current) => Object.fromEntries(Object.entries(current).filter(([serviceKey, mappedUnit]) => mappedUnit !== unitKey && !serviceKeys.has(serviceKey))));
    setCapabilities((current) => current.filter((item) => item.parent_unit_key !== unitKey));
    setResourceLinks((current) => ({
      professionals: current.professionals.map((item) => ({ ...item, unit_keys: (item.unit_keys || []).filter((key) => key !== unitKey) })).filter((item) => item.unit_keys.length > 0),
      equipment: current.equipment.filter((item) => item.unit_key !== unitKey),
      facilities: current.facilities.filter((item) => item.unit_key !== unitKey),
    }));
    setActiveUnits((current) => current.filter((key) => key !== unitKey));
    if (openUnit === unitKey) setOpenUnit("");
    setPendingRemoval(null);
    setMessage(approvedUnits.includes(unitKey) ? "Spațiul și dependențele sale au fost marcate pentru eliminare." : "Spațiul și dependențele sale au fost eliminate din draft.");
  };

  const toggleUnit = (unitKey) => {
    if (!editable) return;
    if (activeUnits.includes(unitKey)) {
      const serviceKeys = servicesForUnit(unitKey);
      const capabilityCount = capabilities.filter((item) => item.parent_unit_key === unitKey).length;
      const resourceCount = resourceLinks.professionals.filter((item) => (item.unit_keys || []).includes(unitKey)).length
        + resourceLinks.equipment.filter((item) => item.unit_key === unitKey).length
        + resourceLinks.facilities.filter((item) => item.unit_key === unitKey).length;
      if (serviceKeys.length > 0 || capabilityCount > 0 || resourceCount > 0) {
        setPendingRemoval({
          type: "unit",
          key: unitKey,
          label: getFunctionalUnitDefinition(unitKey)?.title || unitKey,
          approved: approvedUnits.includes(unitKey),
          serviceCount: serviceKeys.length,
          capabilityCount,
          resourceCount,
        });
        return;
      }
      applyUnitRemoval(unitKey);
      return;
    }
    if (approvedUnits.includes(unitKey)) restoreApprovedUnit(unitKey);
    else {
      setActiveUnits((current) => [...current, unitKey]);
      setOpenUnit(unitKey);
    }
  };

  const applyCapabilityRemoval = (capabilityKey) => {
    const serviceKeys = new Set(selectedServiceKeys(selected).filter((serviceKey) => getServiceOperationalContext(serviceKey)?.capabilityKey === capabilityKey));
    setSelected((current) => Object.fromEntries(Object.entries(current).map(([group, ids]) => [group, (ids || []).filter((id) => !serviceKeys.has(id))])));
    setServiceUnitMap((current) => Object.fromEntries(Object.entries(current).filter(([serviceKey]) => !serviceKeys.has(serviceKey))));
    setCapabilities((current) => current.filter((item) => item.capability_key !== capabilityKey));
    setPendingRemoval(null);
    setMessage(approvedCapabilities.some((item) => item.capability_key === capabilityKey) ? "Activitatea și serviciile dependente au fost marcate pentru eliminare." : "Activitatea și serviciile dependente au fost eliminate din draft.");
  };

  const toggleCapability = (capabilityKey, parentOptions) => {
    if (!editable) return;
    const existing = capabilities.find((item) => item.capability_key === capabilityKey);
    if (existing) {
      const dependentServices = selectedServiceKeys(selected).filter((serviceKey) => getServiceOperationalContext(serviceKey)?.capabilityKey === capabilityKey);
      if (dependentServices.length > 0) {
        setPendingRemoval({
          type: "capability",
          key: capabilityKey,
          label: getCapabilityDefinition(capabilityKey)?.title || capabilityKey,
          approved: approvedCapabilities.some((item) => item.capability_key === capabilityKey),
          serviceCount: dependentServices.length,
          capabilityCount: 1,
          resourceCount: 0,
        });
        return;
      }
      applyCapabilityRemoval(capabilityKey);
      return;
    }
    const approvedRow = approvedCapabilities.find((item) => item.capability_key === capabilityKey && activeUnits.includes(item.parent_unit_key));
    if (approvedRow) restoreApprovedCapability(capabilityKey, approvedRow);
    else {
      const parent = parentOptions[0];
      setCapabilities((current) => [...current, { capability_key: capabilityKey, parent_unit_key: parent, note: "" }]);
    }
  };

  const confirmDependencyRemoval = () => {
    if (pendingRemoval?.type === "unit") applyUnitRemoval(pendingRemoval.key);
    else if (pendingRemoval?.type === "capability") applyCapabilityRemoval(pendingRemoval.key);
  };

  const toggleService = (item, unitKey) => {
    if (!editable) return;
    const current = new Set(selected[item.group] || []);
    if (current.has(item.id)) {
      current.delete(item.id);
      setServiceUnitMap((map) => { const next = { ...map }; delete next[item.id]; return next; });
    } else {
      current.add(item.id);
      const context = getServiceOperationalContext(item.id);
      setServiceUnitMap((map) => {
        const next = { ...map };
        if (context?.sectionKey === "business_attributes") delete next[item.id];
        else next[item.id] = unitKey;
        return next;
      });
    }
    setSelected((value) => ({ ...value, [item.group]: [...current] }));
  };

  const changeSectionUnit = (section, unitKey) => {
    if (!editable) return;
    setServiceUnitMap((current) => {
      const next = { ...current };
      section.items.filter((item) => isSelected(selected, item)).forEach((item) => { next[item.id] = unitKey; });
      return next;
    });
    if (section.capabilityKey) {
      setCapabilities((current) => current.map((item) => item.capability_key === section.capabilityKey ? { ...item, parent_unit_key: unitKey } : item));
    }
  };

  const toggleResource = (type, id, unitKey) => {
    if (!editable) return;
    setResourceLinks((current) => {
      const next = { professionals: [...current.professionals], equipment: [...current.equipment], facilities: [...current.facilities] };
      if (type === "professionals") {
        const index = next.professionals.findIndex((item) => item.assignment_id === id);
        const existing = index >= 0 ? next.professionals[index] : { assignment_id: id, unit_keys: [] };
        const units = existing.unit_keys.includes(unitKey) ? existing.unit_keys.filter((key) => key !== unitKey) : [...existing.unit_keys, unitKey];
        if (units.length === 0 && index >= 0) next.professionals.splice(index, 1);
        else if (index >= 0) next.professionals[index] = { ...existing, unit_keys: units };
        else next.professionals.push({ ...existing, unit_keys: units });
      } else {
        const idField = type === "equipment" ? "equipment_id" : "facility_id";
        const index = next[type].findIndex((item) => item[idField] === id);
        if (index >= 0 && next[type][index].unit_key === unitKey) next[type].splice(index, 1);
        else if (index >= 0) next[type][index] = { [idField]: id, unit_key: unitKey };
        else next[type].push({ [idField]: id, unit_key: unitKey });
      }
      return next;
    });
  };

  const addSuggestion = (suggestion) => {
    if (!editable) return;
    const duplicate = suggestions.some((item) => item.group === suggestion.group && item.label.toLowerCase() === suggestion.label.toLowerCase());
    if (!duplicate) setSuggestions((current) => [...current, suggestion]);
  };

  const removeSuggestion = (suggestion) => setSuggestions((current) => current.filter((item) => item !== suggestion));

  const toggleCasService = (serviceKey) => {
    if (!editable) return;
    setCasServiceKeys((current) => (
      current.includes(serviceKey)
        ? current.filter((key) => key !== serviceKey)
        : [...current, serviceKey]
    ));
  };
  const toggleRawRemoval = (rawKey) => setRawRemovalKeys((current) => current.includes(rawKey) ? current.filter((key) => key !== rawKey) : [...current, rawKey]);

  const save = async () => {
    if (!editable || !dirty) return;
    setSaving(true);
    setMessage("");
    setError("");
    const payload = buildPayload();
    const response = persistenceMode === "v2"
      ? await base44.functions.invoke("providerServiceConfigurationOps", {
        action: draft && draft.status !== "pending_review" ? "update_draft" : "create_draft",
        submission_id: draft?.id,
        location_id: locationId,
        section: "services",
        payload,
      }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, fields: requestError.response?.data?.fields || [] } }))
      : await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: draft && draft.status !== "pending_review" ? "update_draft" : "create_draft",
        submission_id: draft?.id,
        location_id: locationId,
        section: "services",
        payload: {
          selected_ids: payload.selected_ids,
          removal_ids: payload.removal_ids,
          raw_removal_keys: payload.raw_removal_keys,
          suggestions: payload.suggestions,
        },
      }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, fields: requestError.response?.data?.fields || [] } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.fields?.length ? `${response.data.error}: ${response.data.fields.join(", ")}` : response.data.error);
      return;
    }
    setMessage(persistenceMode === "v2" ? "Draftul complet a fost salvat." : "Draftul a fost salvat prin fluxul compatibil." );
    await load();
  };

  const submit = async () => {
    if (!draft || !editable) return;
    if (dirty) {
      setError("Salvează modificările înainte de trimitere.");
      return;
    }
    if (!readiness.configurationComplete) {
      setError(readiness.blockers[0]?.message || "Configurația nu este pregătită pentru trimitere.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    const response = persistenceMode === "v2"
      ? await base44.functions.invoke("providerServiceConfigurationOps", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }))
      : await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSaving(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setMessage("Modificările au fost trimise spre aprobare.");
    await load();
  };

  const withdraw = async () => {
    if (!draft || !pendingReview || persistenceMode !== "v2") return;
    const confirmed = window.confirm("Retragi modificările din procesul de aprobare? Configurația aprobată rămâne neschimbată.");
    if (!confirmed) return;
    setSaving(true);
    setMessage("");
    setError("");
    const response = await base44.functions.invoke("providerServiceConfigurationOps", {
      action: "withdraw",
      submission_id: draft.id,
      location_id: locationId,
      section: "services",
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSaving(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setMessage("Cererea a fost retrasă.");
    await load();
  };

  // Conectam handlerii reali la ref, dupa ce toti trei sunt definiti. Functiile expuse in
  // snapshot (stableActions) citesc de aici la momentul apelului, deci raman mereu
  // actuale fara sa schimbe identitatea snapshot-ului.
  actionsRef.current = { save, submit, withdraw };

  if (loading) return <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă structura profesională a locației...</div>;
  if (error && !config) return <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-950"><p>{error}</p><button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold">Încearcă din nou</button></div>;

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Configurează oferta pentru {profileLabel(location)}.</p>{draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}</div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Selectează produsele și serviciile declarate ca disponibile. Zonele, activitățile, specialiștii și dotările sunt informații opționale și nu blochează trimiterea.</p></div>
        </div>
        <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută un serviciu..." />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}</div>
      </section>

      {persistenceMode === "legacy" && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Catalogul V2 este disponibil local. Draftul de servicii folosește fluxul compatibil până când endpointurile de configurare sunt publicate.</div>}
      {pendingReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Modificările sunt în curs de aprobare. Editarea este blocată până la decizia administratorului.</div>}
      {draft?.admin_note && ["needs_more_info", "rejected"].includes(draft.status) && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950"><strong className="block">Completări solicitate</strong><span className="mt-1 block">{draft.admin_note}</span></div>}
      {conflicts.length > 0 && !draft && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">{conflicts[0].message}</div>}
      {config?.can_edit_services === false && !pendingReview && <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">Ai acces de vizualizare. Modificarea serviciilor publice este disponibilă ownerului și managerului locației.</div>}
      {error && config && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <div className="space-y-4">
          {!query && <UnitSelection units={selectableUnits} approvedUnits={approvedUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={!editable} onToggle={toggleUnit} />}
          {!query && <CapabilitySelection capabilityKeys={selectableCapabilities} approvedCapabilities={approvedCapabilities} capabilities={capabilities} activeUnits={activeUnits} primaryCapabilities={primaryCapabilities} disabled={!editable} onToggle={toggleCapability} />}
          {!query && <CareSettingSelector options={operationalLayout.careSettings || []} approvedValue={approvedCareSetting} value={careSetting} disabled={!editable} onChange={setCareSetting} />}
          {!query && <GlobalServiceSections sections={globalSections} selected={selected} approvedSelected={approvedSelected} prerequisites={draftPrerequisites} disabled={!editable} onToggleService={toggleService} />}

          {!query && <ServiceCatalogIntro activeUnits={activeUnits} selectedCount={selectedCount} />}

          {query ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-sm font-bold">Rezultate pentru „{query}”</h2><p className="mt-1 text-[11px] text-muted-foreground">Căutarea recunoaște și formulări uzuale folosite de pacienții din România.</p></div>
              {searchResults.length > 0 ? searchResults.map(({ section, item }) => { const isLocationWide = section.key === "business_attributes"; const unitKey = isLocationWide ? "" : resolveSectionUnit(section, selected, serviceUnitMap, activeUnits); return <div key={`${section.key}:${item.id}`}><div className="border-b border-border/60 bg-secondary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{isLocationWide ? "Valabil la nivelul locației" : getFunctionalUnitDefinition(unitKey)?.shortTitle || "Zonă neconfigurată"} · {section.title}</div><ServiceRow item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={draftPrerequisites[item.id]} unitKey={unitKey} disabled={!editable} onToggle={toggleService} /></div>; }) : <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nu am găsit opțiuni pentru această căutare.</div>}
            </section>
          ) : (
            <div className="space-y-3">
              {visibleUnits.map((unitKey) => <UnitAccordion key={unitKey} unitKey={unitKey} sections={sectionsByUnit[unitKey] || []} selected={selected} approvedSelected={approvedSelected} serviceUnitMap={serviceUnitMap} prerequisites={draftPrerequisites} config={{ ...config, activeUnits }} resourceLinks={resourceLinks} approvedResourceLinks={approvedResourceLinks} customSuggestions={suggestions} open={openUnit === unitKey} disabled={!editable} onOpen={() => setOpenUnit((current) => current === unitKey ? "" : unitKey)} onToggleService={toggleService} casServiceKeys={casServiceKeys} onToggleCas={toggleCasService} onChangeSectionUnit={changeSectionUnit} onToggleResource={toggleResource} onAddSuggestion={addSuggestion} onRemoveSuggestion={removeSuggestion} />)}
              {visibleUnits.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Selectează cel puțin o zonă care există în locație.</div>}
            </div>
          )}

          <LegacyServices services={config?.legacy_or_unknown_services || []} rawRemovalKeys={rawRemovalKeys} disabled={!editable} onToggle={toggleRawRemoval} />
        </div>

        <ServicesSidebar
          activeUnits={activeUnits}
          capabilities={capabilities}
          selectedCount={selectedCount}
          selectedByUnit={selectedByUnit}
          sections={profileSections}
          selected={selected}
          b2b={isB2BProfile}
          careSetting={careSetting}
          allowedCareSettings={operationalLayout.careSettings || []}
          resourceLinks={resourceLinks}
          unitOrder={selectableUnits}
        />
      </div>

      <DependencyRemovalDialog request={pendingRemoval} onCancel={() => setPendingRemoval(null)} onConfirm={confirmDependencyRemoval} />

      <div className="sticky bottom-0 z-20 -mx-1 rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className={`text-xs ${dirty ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{pendingReview ? "Modificări trimise spre aprobare" : dirty ? "Ai modificări nesalvate" : draft ? "Draft salvat" : "Nu există modificări nesalvate"}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={saving || !editable || !dirty} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salvează draftul</button>{draft && draft.status !== "pending_review" && <button type="button" disabled={saving || !editable || dirty || !readiness.configurationComplete} onClick={submit} title={dirty ? "Salvează modificările înainte de trimitere" : readiness.blockers[0]?.message || ""} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite modificările spre aprobare</button>}{pendingReview && persistenceMode === "v2" && <button type="button" disabled={saving} onClick={withdraw} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><X className="h-4 w-4" /> Retrage cererea</button>}</div></div>
        {!pendingReview && !dirty && !readiness.configurationComplete && <p className="mt-2 text-xs text-muted-foreground">{readiness.blockers[0]?.message}</p>}
        {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
