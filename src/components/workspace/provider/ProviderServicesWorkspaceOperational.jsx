// Faza 1 din docs/plan-refactor-servicii-2026-08-18.md: acest fisier a ramas STRICT
// de prezentare. Starea, incarcarea, dependentele, CAS si persistenta au fost mutate
// in services/useProviderServicesConfig.js, iar functiile pure in
// services/servicesConfigModel.js. Randarea si stilurile nu s-au schimbat.
import React, { useState } from "react";
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
  Send,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Store,
  Users,
  FileCheck,
  GraduationCap,
  Home,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
} from "@/lib/providerLocationFunctionalUnits";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { getServiceDescription } from "../../../../shared/serviceDescriptions.js";
import { useProviderServicesConfig } from "./services/useProviderServicesConfig";
import {
  cleanText,
  isSelected,
  possibleUnits,
  resolveSectionUnit,
  selectedCountForSection,
  serviceLabel,
} from "./services/servicesConfigModel";

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/35 focus:ring-2 focus:ring-foreground/5";

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

// Culorile exacte din CategoryShowcase.jsx (homepage), mapate pe grupurile canonice
// de servicii (2026-08-06). business_attributes ramane fara culoare - nu e o
// categorie de pe homepage, e un atribut de afacere.
const GROUP_TONE = {
  optical_retail: { bg: "#efd5c5", border: "#e1bda8", text: "#8a4a28" },
  lenses_and_measurements: { bg: "#efd5c5", border: "#e1bda8", text: "#8a4a28" },
  optometry: { bg: "#dce5e9", border: "#c6d3da", text: "#3d5a68" },
  contact_lenses: { bg: "#dce5e9", border: "#c6d3da", text: "#3d5a68" },
  ophthalmology_consults: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  specialties: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  procedures_surgery: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  children_and_prevention: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  investigations: { bg: "#dfe3d2", border: "#ccd2ba", text: "#565f3c" },
  technical_activities: { bg: "#eadcba", border: "#dac69b", text: "#6b551f" },
};

const UNIT_TONE = {
  optical_store: GROUP_TONE.optical_retail,
  optical_cabinet: GROUP_TONE.optical_retail,
  optometry_cabinet: GROUP_TONE.optometry,
  ophthalmology_office: GROUP_TONE.ophthalmology_consults,
  optical_workshop: GROUP_TONE.technical_activities,
  optical_laboratory: GROUP_TONE.technical_activities,
  ophthalmology_diagnostics: GROUP_TONE.investigations,
  ophthalmology_procedure_room: GROUP_TONE.ophthalmology_consults,
  ophthalmology_surgery_unit: GROUP_TONE.ophthalmology_consults,
};

function ServiceRow({ item, selected, approvedSelected, prerequisite, unitKey, disabled, helperText = "", onToggle, casActive = false, casEligible = false, onToggleCas }) {
  const active = isSelected(selected, item);
  const approved = isSelected(approvedSelected, item);
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  const blockerDetail = active && prerequisite?.eligible === false
    ? prerequisite.blockers?.[0]?.message
    : "";
  // Descrierea din catalog e textul implicit al randului; mesajele de stare au prioritate.
  const detail = removalRequested
    ? "La trimiterea cererii, elementul este ascuns public până la soluționare."
    : blockerDetail || helperText || getServiceDescription(item.id);
  const casVisible = active && !removalRequested && casEligible;
  return (
    <div
      className={`relative border-b border-border/50 transition last:border-b-0 ${removalRequested ? "bg-amber-50/60" : "bg-transparent"}`}
    >
    <button
      type="button"
      data-service-key={item.id}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(item, unitKey)}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${removalRequested ? "hover:bg-amber-50" : active ? "" : "hover:bg-card/60"}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-snug text-foreground">{serviceLabel(item)}</span>
        {detail && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
          {!removalRequested && <StatusBadge prerequisite={prerequisite} />}
        </span>
      </span>
      {/* Comutator pentru activarea serviciului: decizie de owner (2026-08-06). */}
      <span
        className={`relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full transition-colors ${removalRequested ? "bg-amber-300" : active ? "bg-foreground" : "bg-border"}`}
      >
        <span className={`absolute h-[18px] w-[18px] rounded-full bg-background shadow-sm transition-all ${active || removalRequested ? "left-[21px]" : "left-[3px]"}`} />
      </span>
    </button>
    {/* CAS ramane BIFA, deliberat diferit de comutatorul serviciului. */}
    {casVisible && (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={casActive}
        onClick={() => onToggleCas?.(item.id)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border/40 px-4 py-2.5 pl-8 text-left transition hover:bg-card/60 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="text-[11px] font-semibold text-muted-foreground">Decontat prin CAS</span>
        <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors ${casActive ? "border-foreground bg-foreground" : "border-border bg-background"}`}>
          {casActive && <Check className="h-2.5 w-2.5 text-background" />}
        </span>
      </button>
    )}
    </div>
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
      {/* Lista derulanta, nu butoane-pastila: o singura alegere dintr-un set numit. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
        <span className="text-[13px] font-semibold text-foreground">Varianta selectată</span>
        <div className="relative">
          <select
            value={hasVisibleSelection ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Tipul activității"
            className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-9 text-[13px] font-medium text-foreground outline-none transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {!hasVisibleSelection && <option value="" disabled>Alege o opțiune</option>}
            {visibleOptions.map((key) => (
              <option key={key} value={key}>{CARE_SETTINGS[key].label}</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
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
  // Pornesc DESCHISE doar sectiunile care au deja selectii: utilizatorul vede imediat
  // ce si-a configurat, iar filtrele din invelis scaneaza randurile din DOM.
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
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${UNIT_TONE[unitKey] ? "" : open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}
          style={UNIT_TONE[unitKey] ? { background: UNIT_TONE[unitKey].bg, borderColor: UNIT_TONE[unitKey].border, color: UNIT_TONE[unitKey].text } : undefined}
        ><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {sections.map((section) => {
            const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
            const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
            const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
            return (
              <div key={section.key} className="pt-7 first:pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={openSections.has(section.key)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {/* Bulina de culoare, dupa identitatea de pe homepage. */}
                    {GROUP_TONE[section.group] && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: GROUP_TONE[section.group].bg, border: `1.5px solid ${GROUP_TONE[section.group].border}` }}
                      />
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${openSections.has(section.key) ? "rotate-180" : ""}`} />
                    <h3 className="min-w-0 truncate text-[15px] font-bold tracking-tight">{section.title}</h3>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{selectedCountForSection(selected, section)} din {section.items.length}</span>
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
                    <div className="border-t border-border/50">
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

const BUSINESS_ATTRIBUTE_ICONS = {
  home_visit_eye_care: Home,
  workplace_vision_screening: Building2,
  employer_glasses_reimbursement: FileCheck,
  mobile_optical_unit: Truck,
  school_vision_screening: GraduationCap,
};

function GlobalServiceSections({ sections, selected, approvedSelected, disabled, onToggleService }) {
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
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Aceste opțiuni se aplică întregii locații, nu unei singure zone. Nu cerem documente - informațiile sunt declarate de furnizor.</p>
      </div>
      {/* Carduri mari: sunt atribute despre cum functioneaza afacerea, nu produse. */}
      <div className="space-y-2 p-4 sm:p-5">
        {sections.flatMap((section) => section.items).map((item) => {
          const active = isSelected(selected, item);
          const approved = isSelected(approvedSelected, item);
          const Icon = BUSINESS_ATTRIBUTE_ICONS[item.id] || Building2;
          return (
            <SelectionCard
              key={`${item.group}:${item.id}`}
              active={active}
              approved={approved}
              title={serviceLabel(item)}
              description={helperText[item.id] || ""}
              icon={Icon}
              disabled={disabled}
              onClick={() => onToggleService(item, "")}
            />
          );
        })}
      </div>
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

export default function ProviderServicesWorkspaceOperational(props) {
  const state = useProviderServicesConfig(props);
  const {
    config, draft, persistenceMode, loading, saving, message, error, conflicts, pendingRemoval,
    query, selected, approvedSelected, activeUnits, approvedUnits, capabilities, approvedCapabilities,
    serviceUnitMap, casServiceKeys, resourceLinks, approvedResourceLinks, careSetting, approvedCareSetting,
    setCareSetting, suggestions, rawRemovalKeys, openUnit, setOpenUnit, operationalLayout, profileSections,
    globalSections, sectionsByUnit, selectableUnits, primaryUnits, selectableCapabilities, primaryCapabilities,
    visibleUnits, searchResults, selectedCount, selectedByUnit, draftPrerequisites, readiness, dirty, editable,
    pendingReview, isB2BProfile, load, toggleUnit, toggleCapability, toggleService, toggleCasService,
    changeSectionUnit, toggleResource, addSuggestion, removeSuggestion, toggleRawRemoval,
    confirmDependencyRemoval, cancelDependencyRemoval, save, submit, withdraw,
  } = state;

  if (loading) return <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă structura profesională a locației...</div>;
  if (error && !config) return <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-950"><p>{error}</p><button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold">Încearcă din nou</button></div>;

  return (
    <div className="space-y-4 pb-20">
      {draft && (
        <div className="flex items-center gap-2 px-1">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>
        </div>
      )}

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
          {!query && <GlobalServiceSections sections={globalSections} selected={selected} approvedSelected={approvedSelected} disabled={!editable} onToggleService={toggleService} />}

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

      <DependencyRemovalDialog request={pendingRemoval} onCancel={cancelDependencyRemoval} onConfirm={confirmDependencyRemoval} />

      <div className="sticky bottom-0 z-20 -mx-1 rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className={`text-xs ${dirty ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{pendingReview ? "Modificări trimise spre aprobare" : dirty ? "Ai modificări nesalvate" : draft ? "Draft salvat" : "Nu există modificări nesalvate"}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={saving || !editable || !dirty} onClick={save} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salvează draftul</button>{draft && draft.status !== "pending_review" && <button type="button" disabled={saving || !editable || dirty || !readiness.configurationComplete} onClick={submit} title={dirty ? "Salvează modificările înainte de trimitere" : readiness.blockers[0]?.message || ""} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite modificările spre aprobare</button>}{pendingReview && persistenceMode === "v2" && <button type="button" disabled={saving} onClick={withdraw} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><X className="h-4 w-4" /> Retrage cererea</button>}</div></div>
        {!pendingReview && !dirty && !readiness.configurationComplete && <p className="mt-2 text-xs text-muted-foreground">{readiness.blockers[0]?.message}</p>}
        {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}