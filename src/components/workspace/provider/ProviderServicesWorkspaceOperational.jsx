import React, { useEffect, useMemo, useState } from "react";
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

function StatusBadge({ prerequisite, locallyBlocked }) {
  if (locallyBlocked) {
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" /> Configurare incompletă</span>;
  }
  if (!prerequisite || prerequisite.status === "available") return null;
  const blocked = prerequisite.eligible === false;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${blocked ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
      {blocked ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {prerequisite.status_label || (blocked ? "Cerințe lipsă" : "Necesită verificare")}
    </span>
  );
}

function ServiceRow({ item, selected, prerequisite, unitKey, capabilityActive, disabled, helperText = "", onToggle }) {
  const active = isSelected(selected, item);
  const context = getServiceOperationalContext(item.id);
  const requiresUnit = context?.sectionKey !== "business_attributes";
  const locallyBlocked = active && requiresUnit && (!unitKey || (context?.capabilityKey && !capabilityActive));
  const blockerDetail = active && prerequisite?.eligible === false
    ? prerequisite.blockers?.[0]?.message
    : "";
  const detail = blockerDetail || helperText;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled || prerequisite?.status === "incompatible_profile"}
      onClick={() => onToggle(item, unitKey)}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${active ? "bg-secondary/35" : "bg-card hover:bg-secondary/20"}`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
        {active && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-snug text-foreground">{serviceLabel(item)}</span>
        {detail && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span>}
      </span>
      <StatusBadge prerequisite={prerequisite} locallyBlocked={locallyBlocked} />
    </button>
  );
}

function SelectionCard({ active, title, description, helper, icon: Icon, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-foreground/15 bg-secondary/45" : "border-border bg-card hover:bg-secondary/25"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm font-bold leading-snug text-foreground">{title}</span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
            {active && <Check className="h-3.5 w-3.5" />}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        {helper && <span className="mt-2 block text-[10px] font-semibold text-muted-foreground">{helper}</span>}
      </span>
    </button>
  );
}

function UnitSelection({ units, activeUnits, selectedByUnit, primaryUnits, disabled, onToggle }) {
  const [showOptional, setShowOptional] = useState(false);
  const hiddenUnits = units.filter((unitKey) => !primaryUnits.includes(unitKey) && !activeUnits.includes(unitKey));
  const visibleUnits = showOptional
    ? units
    : units.filter((unitKey) => primaryUnits.includes(unitKey) || activeUnits.includes(unitKey));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">1. Spațiile disponibile în locație</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Alege numai spațiile care există fizic. Cabinetul de optică, cabinetul optometric, atelierul și laboratorul sunt tratate separat.</p>
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
          {showOptional ? "Ascunde spațiile opționale" : `Arată alte spații disponibile (${hiddenUnits.length})`}
        </button>
      )}
    </section>
  );
}

function CapabilitySelection({ capabilityKeys, capabilities, activeUnits, primaryCapabilities, disabled, onToggle }) {
  const [showOptional, setShowOptional] = useState(false);
  if (capabilityKeys.length === 0) return null;
  const activeCapabilityKeys = new Set(capabilities.map((item) => item.capability_key));
  const hiddenCapabilities = capabilityKeys.filter((key) => !primaryCapabilities.includes(key) && !activeCapabilityKeys.has(key));
  const visibleCapabilities = showOptional
    ? capabilityKeys
    : capabilityKeys.filter((key) => primaryCapabilities.includes(key) || activeCapabilityKeys.has(key));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">2. Activități speciale</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Acestea sunt capabilități, nu camere separate. Fiecare activitate este legată de un cabinet, magazin, atelier sau laborator selectat.</p>
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
              title={definition?.title || capabilityKey}
              description={definition?.description || ""}
              helper={activeRow ? `Asociat: ${getFunctionalUnitDefinition(activeRow.parent_unit_key)?.shortTitle || activeRow.parent_unit_key}` : parentOptions.length === 0 ? "Selectează mai întâi un spațiu compatibil" : primaryCapabilities.includes(capabilityKey) ? "Recomandat pentru acest profil" : "Opțional"}
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

function CareSettingSelector({ options, value, disabled, onChange }) {
  const visibleOptions = options.filter((key) => CARE_SETTINGS[key]);
  if (visibleOptions.length <= 1 || visibleOptions.every((key) => key === "not_applicable" || key === "retail_only")) return null;
  const hasVisibleSelection = visibleOptions.includes(value);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold">3. Modul în care funcționează locația</h2>
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

function ResourceGroup({ title, emptyText, items, unitKey, type, disabled, links, onToggle }) {
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
          const label = type === "professionals" ? `${item.full_name} · ${item.professional_type || "specialist"}`
            : type === "equipment" ? item.equipment_label
              : item.facility_key;
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => onToggle(type, id, unitKey)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-secondary/40 disabled:opacity-60">
              <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${assigned ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{assigned && <Check className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {item.verification_status && <span className="text-[10px] text-muted-foreground">{item.verification_status}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnitResources({ unitKey, config, disabled, links, onToggle }) {
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
            <span className="block text-xs font-bold">Specialiști și dotări asociate acestei unități</span>
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
          <ResourceGroup title="Specialiști" emptyText="Nu există specialiști activi asociați locației." items={config.assignments || []} unitKey={unitKey} type="professionals" disabled={disabled} links={links} onToggle={onToggle} />
          <ResourceGroup title="Echipamente" emptyText="Nu există echipamente declarate." items={(config.equipment || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="equipment" disabled={disabled} links={links} onToggle={onToggle} />
          <ResourceGroup title="Facilități" emptyText="Nu există facilități declarate." items={(config.facilities || []).filter((item) => item.is_active !== false)} unitKey={unitKey} type="facilities" disabled={disabled} links={links} onToggle={onToggle} />
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
    <div className="border-t border-border/60 bg-secondary/10 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-bold">Nu găsești opțiunea?</div><p className="mt-1 text-[11px] text-muted-foreground">Propunerea primește status propriu și nu intră în profil sau matching până la clasificare.</p></div>
        <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Propune manual</button>
      </div>
      {open && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Denumirea produsului sau serviciului" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} /><button type="button" onClick={submit} className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Adaugă în draft</button></div>}
      {items.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{items.map((item, index) => <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">{item.label}<button type="button" disabled={disabled} onClick={() => onRemove(item)} className="rounded-full p-0.5 hover:bg-amber-100"><X className="h-3 w-3" /></button></span>)}</div>}
    </div>
  );
}

function UnitAccordion({ unitKey, sections, selected, serviceUnitMap, capabilities, prerequisites, config, resourceLinks, customSuggestions, open, disabled, onOpen, onToggleService, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion }) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const Icon = UNIT_ICONS[unitKey] || Building2;
  const selectedCount = sections.reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  return (
    <section className={`overflow-hidden rounded-[22px] border bg-card transition ${open ? "border-foreground/20 shadow-sm" : "border-border"}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 sm:px-5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          <div className="bg-secondary/10 px-4 py-3 sm:px-5"><p className="text-xs leading-relaxed text-muted-foreground">{definition?.description}</p></div>
          {sections.map((section) => {
            const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
            const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
            const capabilityActive = !section.capabilityKey || capabilities.some((item) => item.capability_key === section.capabilityKey && item.parent_unit_key === activeUnit);
            const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
            return (
              <div key={section.key} className="border-t border-border/60 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-3 bg-card px-4 py-3 sm:px-5">
                  <div className="min-w-0"><h3 className="text-xs font-bold">{section.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{section.description}</p></div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{selectedCountForSection(selected, section)} din {section.items.length} selectate</span>
                    {availableParents.length > 1 && (
                      <label className="text-[10px] font-semibold text-muted-foreground">Se realizează în
                        <select disabled={disabled} value={activeUnit} onChange={(event) => onChangeSectionUnit(section, event.target.value)} className="ml-2 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground">
                          {availableParents.map((key) => <option key={key} value={key}>{getFunctionalUnitDefinition(key)?.shortTitle || key}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                {section.note && <div className="mx-4 mb-3 flex gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:mx-5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {section.note}</div>}
                {!capabilityActive && <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 sm:mx-5">Activează mai întâi capabilitatea „{getCapabilityDefinition(section.capabilityKey)?.title || section.capabilityKey}” pentru această unitate.</div>}
                <div className="border-t border-border/50">
                  {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} prerequisite={prerequisites[item.id]} unitKey={activeUnit} capabilityActive={capabilityActive} disabled={disabled || !capabilityActive} onToggle={onToggleService} />)}
                </div>
                <CustomSuggestion unitKey={unitKey} section={section} disabled={disabled} items={suggestions} onAdd={onAddSuggestion} onRemove={onRemoveSuggestion} />
              </div>
            );
          })}
          <UnitResources unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} onToggle={onToggleResource} />
        </div>
      )}
    </section>
  );
}

function GlobalServiceSections({ sections, selected, prerequisites, disabled, onToggleService }) {
  if (sections.length === 0) return null;
  const helperText = {
    cas_reimbursed_services: "Bifează dacă locația oferă cel puțin un produs sau serviciu care poate fi decontat prin CAS. Detaliile și eligibilitatea se confirmă separat.",
    onsite_eye_testing_b2b: "Include consultații sau testări la domiciliu și screening ori testări de vedere la sediul companiilor.",
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-secondary/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold">4. Opțiuni generale ale locației</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Decontarea și serviciile oferite în afara locației se aplică întregii unități, nu unui singur cabinet.</p>
      </div>
      {sections.map((section) => (
        <div key={section.key} className="border-b border-border/60 last:border-b-0">
          <div className="bg-card px-4 py-3 sm:px-5"><h3 className="text-xs font-bold">{section.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{section.description}</p></div>
          <div className="border-t border-border/50">
            {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} prerequisite={prerequisites[item.id]} unitKey="" capabilityActive disabled={disabled} helperText={helperText[item.id] || ""} onToggle={onToggleService} />)}
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
          <h2 className="text-sm font-bold">5. Produse și servicii pe fiecare spațiu</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Deschide fiecare spațiu și selectează oferta disponibilă. La final poți asocia specialiștii, echipamentele și facilitățile corespunzătoare.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{selectedCount} opțiuni · {activeUnits.length} spații</span>
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
    { number: 1, label: "Spațiile locației", detail: activeUnits.length > 0 ? `${activeUnits.length} configurate` : "Selectează cel puțin un spațiu", done: activeUnits.length > 0 },
    { number: 2, label: "Activități speciale", detail: capabilities.length > 0 ? `${capabilities.length} selectate` : "Opțional", done: capabilities.length > 0, optional: true },
    { number: 3, label: "Mod de funcționare", detail: careSettingComplete ? CARE_SETTINGS[careSetting]?.label : "Necesită completare", done: careSettingComplete },
    { number: 4, label: "Opțiuni generale", detail: globalOptionCount > 0 ? `${globalOptionCount} selectate` : "Opțional", done: globalOptionCount > 0, optional: true },
    { number: 5, label: "Produse și servicii", detail: serviceCount > 0 ? `${serviceCount} selectate` : "Nu există selecții", done: serviceCount > 0 },
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
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/25 px-3 py-4 text-center text-xs text-muted-foreground">Nu ai selectat încă niciun spațiu.</p>
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

function LegacyServices({ services, rawRemovalKeys, disabled, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!services.length) return null;
  return (
    <section className="overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50/60">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"><AlertTriangle className="h-4 w-4 text-amber-800" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-amber-950">Date existente care necesită migrare</span><span className="text-[11px] text-amber-900/75">{services.length} chei vechi, ambigue sau necunoscute</span></span><ChevronDown className={`h-4 w-4 text-amber-900 transition ${open ? "rotate-180" : ""}`} /></button>
      {open && <div className="space-y-2 border-t border-amber-200 p-4 sm:p-5">{services.map((service) => { const marked = rawRemovalKeys.includes(service.raw_key); return <div key={`${service.id}:${service.raw_key}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5"><div><div className="text-xs font-bold">{service.label || service.raw_key}</div><div className="mt-1 text-[10px] text-muted-foreground">{service.raw_key}</div></div><button type="button" disabled={disabled} onClick={() => onToggle(service.raw_key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${marked ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-background"}`}>{marked ? "Eliminare solicitată" : "Solicită eliminarea"}</button></div>; })}</div>}
    </section>
  );
}

export default function ProviderServicesWorkspaceOperational({ locationId, location }) {
  const [config, setConfig] = useState(null);
  const [remoteCatalog, setRemoteCatalog] = useState(null);
  const [persistenceMode, setPersistenceMode] = useState("v2");
  const [draft, setDraft] = useState(null);
  const [approvedSelected, setApprovedSelected] = useState({});
  const [selected, setSelected] = useState({});
  const [activeUnits, setActiveUnits] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [serviceUnitMap, setServiceUnitMap] = useState({});
  const [resourceLinks, setResourceLinks] = useState({ professionals: [], equipment: [], facilities: [] });
  const [careSetting, setCareSetting] = useState("not_applicable");
  const [suggestions, setSuggestions] = useState([]);
  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);
  const [openUnit, setOpenUnit] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
  const visibleUnits = activeUnits.filter((unitKey) => sectionsByUnit[unitKey]?.length > 0);
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
      capabilities,
      service_unit_map: completeServiceMap,
      resource_links: resourceLinks,
      care_setting: careSetting,
    };
  };

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    setMessage("");

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
    setApprovedSelected(approved);
    setSelected(desired);
    setActiveUnits(initialUnits);
    setCapabilities(initialCapabilities);
    setServiceUnitMap(initialMap);
    setResourceLinks(payload.resource_links || buildResourceLinks(nextConfig));
    const allowedCareSettings = operationalLayout.careSettings || [];
    const persistedCareSetting = payload.care_setting || nextConfig.care_setting || "";
    const hasCommercialSpace = initialUnits.includes("optical_store");
    const hasClinicalSpace = initialUnits.some((unitKey) => ["optical_cabinet", "optometry_cabinet", "ophthalmology_office", "ophthalmology_diagnostics", "ophthalmology_procedure_room", "ophthalmology_surgery_unit"].includes(unitKey));
    const recommendedCareSetting = hasCommercialSpace && hasClinicalSpace && allowedCareSettings.includes("mixed")
      ? "mixed"
      : allowedCareSettings[0] || "not_applicable";
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

  const toggleUnit = (unitKey) => {
    if (!editable) return;
    if (activeUnits.includes(unitKey)) {
      const usedByServices = selectedServiceKeys(selected).some((serviceKey) => serviceUnitMap[serviceKey] === unitKey);
      const usedByCapability = capabilities.some((item) => item.parent_unit_key === unitKey);
      const usedByResources = resourceLinks.professionals.some((item) => item.unit_keys.includes(unitKey)) || resourceLinks.equipment.some((item) => item.unit_key === unitKey) || resourceLinks.facilities.some((item) => item.unit_key === unitKey);
      if (usedByServices || usedByCapability || usedByResources) {
        setMessage("Elimină mai întâi serviciile, capabilitățile și resursele asociate acestei unități.");
        return;
      }
      setActiveUnits((current) => current.filter((key) => key !== unitKey));
      if (openUnit === unitKey) setOpenUnit("");
      return;
    }
    setActiveUnits((current) => [...current, unitKey]);
    setOpenUnit(unitKey);
  };

  const toggleCapability = (capabilityKey, parentOptions) => {
    if (!editable) return;
    const existing = capabilities.find((item) => item.capability_key === capabilityKey);
    if (existing) {
      const used = selectedServiceKeys(selected).some((serviceKey) => getServiceOperationalContext(serviceKey)?.capabilityKey === capabilityKey);
      if (used) {
        setMessage("Elimină mai întâi serviciile care folosesc această capabilitate.");
        return;
      }
      setCapabilities((current) => current.filter((item) => item.capability_key !== capabilityKey));
      return;
    }
    const parent = parentOptions[0];
    setCapabilities((current) => [...current, { capability_key: capabilityKey, parent_unit_key: parent, note: "" }]);
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
  const toggleRawRemoval = (rawKey) => setRawRemovalKeys((current) => current.includes(rawKey) ? current.filter((key) => key !== rawKey) : [...current, rawKey]);

  const save = async () => {
    if (!editable) return;
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
    setSaving(true);
    setMessage("");
    setError("");
    const response = persistenceMode === "v2"
      ? await base44.functions.invoke("providerServiceConfigurationOps", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }))
      : await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSaving(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setMessage("Configurația a fost trimisă spre verificare.");
    await load();
  };

  if (loading) return <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă structura profesională a locației...</div>;
  if (error && !config) return <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-950"><p>{error}</p><button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold">Încearcă din nou</button></div>;

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Configurează oferta pentru {profileLabel(location)}.</p>{draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}</div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Începe cu spațiile fizice, continuă cu activitățile speciale și asociază fiecărui serviciu specialistul, dotarea și unitatea în care este realizat.</p></div>
        </div>
        <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută: control vedere, schimb șurub, OCT, oftalmolog copii..." />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}</div>
      </section>

      {persistenceMode === "legacy" && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Catalogul V2 este disponibil local. Draftul de servicii folosește fluxul compatibil până când endpointurile de configurare sunt publicate.</div>}
      {pendingReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Configurația este în verificare. Editarea este blocată până la decizia administratorului.</div>}
      {config?.can_edit_services === false && !pendingReview && <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">Ai acces de vizualizare. Modificarea serviciilor publice este disponibilă ownerului și managerului locației.</div>}
      {error && config && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <div className="space-y-4">
          {!query && <UnitSelection units={selectableUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={!editable} onToggle={toggleUnit} />}
          {!query && <CapabilitySelection capabilityKeys={selectableCapabilities} capabilities={capabilities} activeUnits={activeUnits} primaryCapabilities={primaryCapabilities} disabled={!editable} onToggle={toggleCapability} />}
          {!query && <CareSettingSelector options={operationalLayout.careSettings || []} value={careSetting} disabled={!editable} onChange={setCareSetting} />}
          {!query && <GlobalServiceSections sections={globalSections} selected={selected} prerequisites={config?.prerequisites_by_key || {}} disabled={!editable} onToggleService={toggleService} />}

          {!query && <ServiceCatalogIntro activeUnits={activeUnits} selectedCount={selectedCount} />}

          {query ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-sm font-bold">Rezultate pentru „{query}”</h2><p className="mt-1 text-[11px] text-muted-foreground">Căutarea recunoaște și formulări uzuale folosite de pacienții din România.</p></div>
              {searchResults.length > 0 ? searchResults.map(({ section, item }) => { const isLocationWide = section.key === "business_attributes"; const unitKey = isLocationWide ? "" : resolveSectionUnit(section, selected, serviceUnitMap, activeUnits); const capabilityActive = !section.capabilityKey || capabilities.some((capability) => capability.capability_key === section.capabilityKey && capability.parent_unit_key === unitKey); return <div key={`${section.key}:${item.id}`}><div className="border-b border-border/60 bg-secondary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{isLocationWide ? "Valabil la nivelul locației" : getFunctionalUnitDefinition(unitKey)?.shortTitle || "Spațiu neconfigurat"} · {section.title}</div><ServiceRow item={item} selected={selected} prerequisite={config?.prerequisites_by_key?.[item.id]} unitKey={unitKey} capabilityActive={capabilityActive} disabled={!editable || (!isLocationWide && !activeUnits.includes(unitKey))} onToggle={toggleService} /></div>; }) : <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nu am găsit opțiuni pentru această căutare.</div>}
            </section>
          ) : (
            <div className="space-y-3">
              {visibleUnits.map((unitKey) => <UnitAccordion key={unitKey} unitKey={unitKey} sections={sectionsByUnit[unitKey] || []} selected={selected} serviceUnitMap={serviceUnitMap} capabilities={capabilities} prerequisites={config?.prerequisites_by_key || {}} config={{ ...config, activeUnits }} resourceLinks={resourceLinks} customSuggestions={suggestions} open={openUnit === unitKey} disabled={!editable} onOpen={() => setOpenUnit((current) => current === unitKey ? "" : unitKey)} onToggleService={toggleService} onChangeSectionUnit={changeSectionUnit} onToggleResource={toggleResource} onAddSuggestion={addSuggestion} onRemoveSuggestion={removeSuggestion} />)}
              {visibleUnits.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Selectează cel puțin un spațiu care există în locație.</div>}
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

      <div className="sticky bottom-0 z-20 -mx-1 rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground"><strong className="text-foreground">{selectedCount}</strong> opțiuni · <strong className="text-foreground">{activeUnits.length}</strong> spații · <strong className="text-foreground">{capabilities.length}</strong> capabilități</div><div className="flex flex-wrap gap-2"><button type="button" disabled={saving || !editable} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salvează draftul</button>{draft && draft.status !== "pending_review" && <button type="button" disabled={saving || !editable} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite spre verificare</button>}</div></div>
        {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
