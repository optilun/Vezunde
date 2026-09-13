import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Search, Send, X } from "lucide-react";
import { CARE_SETTINGS, getFunctionalUnitDefinition, getCapabilityDefinition } from "@/lib/providerLocationFunctionalUnits";
import { useProviderServicesConfig } from "./services/useProviderServicesConfig";
import UnitPicker from "./services/UnitPicker";
import UnitAccordion from "./services/UnitAccordion";
import GlobalServiceSections from "./services/GlobalServiceSections";
import CareSettingPicker from "./services/CareSettingPicker";
import ServicesSearchResults from "./services/ServicesSearchResults";
import DependencyRemovalDialog from "./services/DependencyRemovalDialog";
import LegacyServices from "./services/LegacyServices";
import { isSelected, selectedServiceKeys, serviceLabel } from "./services/servicesConfigModel";
import { getEditorStatus, reviewFingerprint, saveBeforeContinuing, selectionChanges, stableSignature } from "./services/servicesEditorModel";
import "./ProviderServicesEditor.css";

const unitLabel = key => getFunctionalUnitDefinition(key)?.shortTitle || getFunctionalUnitDefinition(key)?.title || key;

function ReviewCard({ title, count, onEdit, children }) {
  return <section className="services-editor__review-card">
    <header><div><h3>{title}</h3>{count != null && <span>{count}</span>}</div>
      <button type="button" onClick={onEdit}>Modifică<span className="sr-only">: {title}</span></button>
    </header>{children}
  </section>;
}

export default function ProviderServicesEditor(props) {
  const m = useProviderServicesConfig(props);
  const [view, setView] = useState("configuration");
  const [unitIndex, setUnitIndex] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [reviewed, setReviewed] = useState({});
  const headingRef = useRef(null);
  const initialised = useRef(false);
  const continueLock = useRef(false);
  const storageKey = "viasee:services-reviewed:v1:" + (props.locationId || props.location?.id || "");
  const allItems = m.profileSections.flatMap(section => section.items);
  const itemMap = Object.fromEntries(allItems.map(item => [item.id, item]));
  const itemLabel = key => serviceLabel(itemMap[key] || { id: key, label: key });
  const globalKeys = new Set(m.globalSections.flatMap(section => section.items.map(item => item.id)));
  const publicKeys = selectedServiceKeys(m.selected).filter(key => !globalKeys.has(key));
  const approvedPublicKeys = selectedServiceKeys(m.approvedSelected).filter(key => !globalKeys.has(key));
  const hasWorkingCopy = Boolean(m.draft || m.dirty);
  const activeUnitKey = m.visibleUnits[unitIndex] || m.visibleUnits[0];
  const sections = m.sectionsByUnit[activeUnitKey] || [];
  const groupFingerprint = section => reviewFingerprint({
    services: section.items.filter(item => isSelected(m.selected, item)).map(item => item.id),
    cas: section.items.filter(item => m.casServiceKeys.includes(item.id)).map(item => item.id),
    capabilities: m.capabilities.filter(item => item.parent_unit_key === activeUnitKey),
    map: Object.fromEntries(section.items.map(item => [item.id, m.serviceUnitMap[item.id] || ""])),
  });
  const fingerprints = {
    configuration: reviewFingerprint(m.activeUnits),
    options: reviewFingerprint({ care: m.careSetting, selected: selectedServiceKeys(m.selected).filter(key => globalKeys.has(key)) }),
  };
  for (const key of m.visibleUnits) {
    const unitSections = m.sectionsByUnit[key] || [];
    for (const section of unitSections) {
      fingerprints[key + ":" + section.key] = reviewFingerprint({
        services: section.items.filter(item => isSelected(m.selected, item)).map(item => item.id),
        cas: section.items.filter(item => m.casServiceKeys.includes(item.id)).map(item => item.id),
        capabilities: m.capabilities.filter(item => item.parent_unit_key === key),
        map: Object.fromEntries(section.items.map(item => [item.id, m.serviceUnitMap[item.id] || ""])),
      });
    }
  }
  const unitDone = key => (m.sectionsByUnit[key] || []).length > 0 && m.sectionsByUnit[key].every(section => reviewed[key + ":" + section.key] === fingerprints[key + ":" + section.key]);
  const steps = [
    { key: "configuration", title: "Spațiile locației", meta: m.activeUnits.length + " selectate", done: reviewed.configuration === fingerprints.configuration },
    ...m.visibleUnits.map((key, index) => ({ key: "unit:" + index, title: unitLabel(key), meta: (m.selectedByUnit[key] || 0) + " servicii selectate", done: unitDone(key) })),
    { key: "options", title: "Opțiunile locației", meta: "Opțional", done: reviewed.options === fingerprints.options },
    { key: "review", title: "Verifică și trimite", meta: "Rezumatul ofertei" },
  ];
  const currentKey = view === "unit" ? "unit:" + unitIndex : view;
  const currentStep = steps.findIndex(step => step.key === currentKey);
  const doneCount = steps.filter(step => step.done).length;

  useEffect(() => {
    try { setReviewed(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { setReviewed({}); }
    initialised.current = false;
  }, [storageKey]);
  useEffect(() => {
    if (!m.loading && m.config && !initialised.current) {
      initialised.current = true;
      if (approvedPublicKeys.length > 0 || m.draft) setView("review");
    }
  }, [m.loading, m.config, m.draft, approvedPublicKeys.length]);
  useEffect(() => {
    if (unitIndex >= m.visibleUnits.length) setUnitIndex(0);
  }, [unitIndex, m.visibleUnits.length]);
  useEffect(() => {
    if (!m.dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [m.dirty]);

  const go = key => {
    if (m.saving) return;
    m.setQuery("");
    if (key.startsWith("unit:")) { setUnitIndex(Number(key.split(":")[1])); setView("unit"); }
    else setView(key === "selected" ? "review" : key);
    setNavOpen(false);
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      headingRef.current?.focus({ preventScroll: true });
    });
  };
  const markReviewed = (key, fingerprint) => setReviewed(previous => {
    const next = { ...previous, [key]: fingerprint };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Progress is optional when storage is unavailable. */ }
    return next;
  });
  const continueStep = async (key, fingerprint, next) => {
    if (continueLock.current || m.saving) return false;
    continueLock.current = true;
    const result = await saveBeforeContinuing({
      dirty: m.dirty,
      save: m.save,
      onSuccess: () => { markReviewed(key, fingerprint); next?.(); },
    });
    continueLock.current = false;
    return result;
  };

  const serviceChanges = selectionChanges(approvedPublicKeys, publicKeys, itemLabel);
  const globalChanges = selectionChanges(selectedServiceKeys(m.approvedSelected).filter(key => globalKeys.has(key)), selectedServiceKeys(m.selected).filter(key => globalKeys.has(key)), itemLabel);
  const spaceChanges = selectionChanges(m.approvedUnits, m.activeUnits, unitLabel);
  const casChanges = selectionChanges(m.config?.cas_service_keys || [], m.casServiceKeys.filter(key => publicKeys.includes(key)), itemLabel);
  const capabilityChanges = selectionChanges(
    m.approvedCapabilities.map(item => item.capability_key + "|" + item.parent_unit_key),
    m.capabilities.map(item => item.capability_key + "|" + item.parent_unit_key),
    key => { const [capability, unit] = key.split("|"); return (getCapabilityDefinition(capability)?.title || capability) + " · " + unitLabel(unit); },
  );
  const careChanged = m.careSetting !== m.approvedCareSetting;
  const resourcesChanged = stableSignature(m.resourceLinks) !== stableSignature(m.approvedResourceLinks);
  const assignmentChanges = publicKeys.filter(key => (m.serviceUnitMap[key] || "") !== (m.config?.service_unit_map?.[key] || "") && (m.serviceUnitMap[key] || m.config?.service_unit_map?.[key]));
  const totalChanges = serviceChanges.length + globalChanges.length + spaceChanges.length + casChanges.length + capabilityChanges.length + m.suggestions.length + m.rawRemovalKeys.length + Number(careChanged) + Number(resourcesChanged) + assignmentChanges.length;
  const hasChanges = hasWorkingCopy && totalChanges > 0;
  const status = getEditorStatus({ saving: m.saving, error: m.error, dirty: m.dirty, pendingReview: m.pendingReview, hasDraft: Boolean(m.draft), hasChanges, approvedCount: approvedPublicKeys.length });
  const title = m.query ? "Rezultatele căutării" : view === "unit" ? unitLabel(activeUnitKey) : view === "configuration" ? "Ce spații ai la această locație?" : view === "options" ? "Opțiuni pentru întreaga locație" : view === "advanced" ? "Servicii din evidența anterioară" : "Verifică oferta locației";
  const description = m.query ? "Poți selecta un serviciu direct din rezultate." : view === "configuration" ? "Bifează tipurile de spații existente. Nu este nevoie să treci fiecare cameră." : view === "unit" ? "Bifează doar serviciile pe care le oferi. Poți lăsa un grup fără selecții." : view === "options" ? "Alege ce se aplică locației. Poți continua și fără opțiuni suplimentare." : "Verifică serviciile și detaliile înainte să trimiți modificările spre aprobare.";
  const disabled = !m.editable || m.saving;
  const isReview = view === "review" && !m.query;
  const changeList = (title, entries) => entries.length > 0 && <div className="services-editor__change-group"><h4>{title}</h4><ul>{entries.map(entry => <li key={entry.kind + entry.key}><span data-kind={entry.kind}>{entry.kind === "added" ? "Adăugat" : "Eliminare propusă"}</span>{entry.label}{m.reviewState[entry.key] && <small>În verificare</small>}</li>)}</ul></div>;

  if (m.loading) return <div className="services-editor__loading" role="status">Se încarcă oferta locației…</div>;
  if (!m.config) return <div className="services-editor__notice" role="alert"><p>{m.error || "Nu am putut încărca oferta."}</p><button type="button" onClick={m.load}>Încearcă din nou</button></div>;

  return <div className="services-editor">
    <aside className="services-editor__nav">
      <button type="button" className="services-editor__mobile-toggle" aria-expanded={navOpen} onClick={() => setNavOpen(value => !value)}>Secțiunile ofertei <ChevronDown /></button>
      <nav aria-label="Configurarea serviciilor" data-open={navOpen}>
        <div className="services-editor__nav-intro"><strong>Oferta locației</strong><p>{publicKeys.length} servicii selectate</p></div>
        <ol>{steps.map((step, index) => <li key={step.key}><button type="button" disabled={m.saving} aria-current={!m.query && step.key === currentKey ? "step" : undefined} onClick={() => go(step.key)}>
          <span className="services-editor__step-number">{step.done ? <Check /> : String(index + 1).padStart(2, "0")}</span>
          <span><strong>{step.title}</strong><small>{step.done ? "Revizuită · " : ""}{step.meta}</small></span>
        </button></li>)}</ol>
        <p className="services-editor__progress-note">{doneCount} din {steps.length - 1} secțiuni revizuite pe acest dispozitiv. Numărul de servicii bifate nu reprezintă progresul.</p>
      </nav>
    </aside>

    <section className="services-editor__main" aria-labelledby="services-editor-title">
      <header className="services-editor__heading">
        <span className="services-editor__eyebrow">{isReview ? "Rezumat" : "Configurarea ofertei"}</span>
        <h2 ref={headingRef} tabIndex={-1} id="services-editor-title">{title}</h2>
        <p>{description}</p>
      </header>
      <div className="services-editor__status" data-tone={status.tone} role={m.error ? "alert" : "status"}>
        <span className="services-editor__status-dot" /><div><strong>{status.title}</strong><p>{status.detail}</p>
        {m.message && !m.dirty && !m.error && <small>{m.message}</small>}</div>
      </div>
      {!m.editable && <div className="services-editor__notice">{m.conflicts[0]?.message || "Ai acces de vizualizare. Ownerul sau managerul locației poate modifica oferta."}</div>}
      {m.draft?.admin_note && ["needs_more_info", "rejected"].includes(m.draft.status) && <div className="services-editor__notice"><strong>Completări solicitate</strong><p>{m.draft.admin_note}</p></div>}
      {m.persistenceMode === "legacy" && <div className="services-editor__notice">Salvarea spațiilor și a resurselor este momentan indisponibilă. Serviciile pot fi salvate.</div>}
      <div className="services-editor__search"><Search /><input type="search" aria-label="Caută în toate serviciile" placeholder="Caută în toate serviciile" value={m.query} onChange={event => m.setQuery(event.target.value)} />{m.query && <button type="button" aria-label="Șterge căutarea" onClick={() => m.setQuery("")}><X /></button>}</div>

      <div className="services-editor__content">
      {m.query ? <ServicesSearchResults query={m.query} results={m.searchResults} selected={m.selected} approvedSelected={m.approvedSelected} reviewState={m.reviewState} serviceUnitMap={m.serviceUnitMap} activeUnits={m.activeUnits} prerequisites={m.draftPrerequisites} disabled={disabled} onToggleService={m.toggleService} onClearQuery={() => m.setQuery("")} /> : <>
        {view === "configuration" && <UnitPicker units={m.selectableUnits} activeUnits={m.activeUnits} approvedUnits={m.approvedUnits} selectedByUnit={m.selectedByUnit} primaryUnits={m.primaryUnits} reviewState={m.reviewState} disabled={disabled} onToggle={m.toggleUnit} />}
        {view === "options" && <GlobalServiceSections sections={m.globalSections} selected={m.selected} approvedSelected={m.approvedSelected} reviewState={m.reviewState} disabled={disabled} onToggleService={m.toggleService} onSetSelection={m.setServicesSelection} careSettingSlot={<CareSettingPicker embedded options={m.operationalLayout.careSettings || []} approvedValue={m.approvedCareSetting} value={m.careSetting} disabled={disabled} onChange={m.setCareSetting} />} />}
        {view === "unit" && activeUnitKey && <UnitAccordion key={activeUnitKey} unitKey={activeUnitKey} sections={sections} selected={m.selected} approvedSelected={m.approvedSelected} reviewState={m.reviewState} serviceUnitMap={m.serviceUnitMap} prerequisites={m.draftPrerequisites} config={{ ...m.config, activeUnits: m.activeUnits }} resourceLinks={m.resourceLinks} approvedResourceLinks={m.approvedResourceLinks} customSuggestions={m.suggestions} capabilities={m.capabilities} approvedCapabilities={m.approvedCapabilities} onToggleCapability={m.toggleCapability} open disabled={disabled} casServiceKeys={m.casServiceKeys} onToggleCas={m.toggleCasService} onToggleService={m.toggleService} onSetSelection={m.setServicesSelection} onChangeSectionUnit={m.changeSectionUnit} onToggleResource={m.toggleResource} onAddSuggestion={m.addSuggestion} onRemoveSuggestion={m.removeSuggestion} stepMode active stepIndex={unitIndex} onGoToUnit={index => go("unit:" + index)} onChooseView={() => go("options")} unitTitles={m.visibleUnits} onBeforeNext={section => continueStep(activeUnitKey + ":" + section.key, groupFingerprint(section))} dirty={m.dirty} saving={m.saving} reviewedGroups={reviewed} groupFingerprints={fingerprints} />}
        {view === "unit" && !activeUnitKey && <div className="services-editor__notice">Alege mai întâi spațiile existente.<button type="button" onClick={() => go("configuration")}>Alege spațiile</button></div>}
        {view === "advanced" && <LegacyServices services={m.config.legacy_or_unknown_services || []} rawRemovalKeys={m.rawRemovalKeys} disabled={disabled} onToggle={m.toggleRawRemoval} />}
        {isReview && <>
          <div className="services-editor__summary"><strong>{publicKeys.length}<span>servicii selectate</span></strong><strong>{m.activeUnits.length}<span>spații selectate</span></strong><strong>{approvedPublicKeys.length}<span>servicii aprobate</span></strong></div>
          {hasChanges && <section className="services-editor__review-card services-editor__changes"><header><div><h3>{m.pendingReview ? "Diferențe față de oferta aprobată" : "Ce se schimbă în ofertă"}</h3><span>{m.dirty ? "Include modificările nesalvate" : "Modificări salvate"}</span></div></header>
            {changeList("Servicii", serviceChanges)}{changeList("Spații", spaceChanges)}{changeList("Opțiunile locației", globalChanges)}{changeList("Decontare CAS", casChanges)}{changeList("Activități și dotări", capabilityChanges)}
            {careChanged && <p>Tipul activității: {CARE_SETTINGS[m.approvedCareSetting]?.label || "Nespecificat"} → {CARE_SETTINGS[m.careSetting]?.label || m.careSetting}</p>}
            {assignmentChanges.length > 0 && <div className="services-editor__change-group"><h4>Asocierea serviciilor cu spațiile</h4><ul>{assignmentChanges.map(key => <li key={key}>{itemLabel(key)} → {unitLabel(m.serviceUnitMap[key])}</li>)}</ul></div>}
            {resourcesChanged && <p>Asocierile specialiștilor, echipamentelor sau facilităților au fost modificate. Detaliile sunt în rezumatul fiecărei zone.</p>}
            {m.suggestions.length > 0 && <div className="services-editor__change-group"><h4>Servicii propuse manual</h4><ul>{m.suggestions.map((item, index) => <li key={index}>{item.label} · {unitLabel(item.functional_unit_key)}</li>)}</ul></div>}
            {m.rawRemovalKeys.length > 0 && <p>{m.rawRemovalKeys.length} eliminări propuse din evidența anterioară.</p>}
            {serviceChanges.some(entry => entry.kind === "removed") && <p className="services-editor__notice">La trimiterea cererii, serviciile propuse spre eliminare sunt ascunse public până la soluționare.</p>}
          </section>}
          <ReviewCard title="Spațiile locației" count={m.activeUnits.length + " selectate"} onEdit={() => go("configuration")}><p>{m.activeUnits.map(unitLabel).join(" · ") || "Nu ai selectat spații."}</p></ReviewCard>
          {m.visibleUnits.map((key, index) => {
            const unitSections = m.sectionsByUnit[key] || [];
            const items = [...new Map(unitSections.flatMap(section => section.items).filter(item => isSelected(m.selected, item)).map(item => [item.id, item])).values()];
            const suggestions = m.suggestions.filter(item => item.functional_unit_key === key);
            const links = [
              ...(m.resourceLinks.professionals || []).filter(item => item.unit_keys?.includes(key)).map(item => m.config.assignments?.find(row => row.id === item.assignment_id)?.full_name || "Specialist"),
              ...(m.resourceLinks.equipment || []).filter(item => item.unit_key === key).map(item => m.config.equipment?.find(row => row.id === item.equipment_id)?.equipment_label || "Echipament"),
              ...(m.resourceLinks.facilities || []).filter(item => item.unit_key === key).map(item => m.config.facilities?.find(row => row.id === item.facility_id)?.facility_key || "Facilitate"),
            ];
            return <ReviewCard key={key} title={unitLabel(key)} count={items.length + " servicii selectate"} onEdit={() => go("unit:" + index)}>
              {items.length ? <ul className="services-editor__offer-list">{items.map(item => <li key={item.id}><Check /><span>{serviceLabel(item)}</span>{m.casServiceKeys.includes(item.id) && <small>Decontat CAS</small>}</li>)}</ul> : <p>Niciun serviciu selectat. Poți revizui zona sau o poți lăsa fără servicii.</p>}
              {suggestions.length > 0 && <p>Propuse manual: {suggestions.map(item => item.label).join(" · ")}</p>}
              {links.length > 0 && <p>Resurse asociate: {links.join(" · ")}</p>}
            </ReviewCard>;
          })}
          <ReviewCard title="Opțiunile locației" onEdit={() => go("options")}><p>{CARE_SETTINGS[m.careSetting]?.label || m.careSetting}</p><ul>{selectedServiceKeys(m.selected).filter(key => globalKeys.has(key)).map(key => <li key={key}>{itemLabel(key)}</li>)}</ul>{!selectedServiceKeys(m.selected).some(key => globalKeys.has(key)) && <p>Fără opțiuni suplimentare.</p>}</ReviewCard>
          {(m.config.legacy_or_unknown_services || []).length > 0 && <button type="button" className="services-editor__text-button" onClick={() => go("advanced")}>Revizuiește serviciile din evidența anterioară</button>}
        </>}
      </>}
      </div>

      {(!m.query && ["configuration", "options"].includes(view)) && <div className="services-editor__continue">
        <span>{view === "configuration" ? "Selectează doar spațiile existente." : "Opțiunile suplimentare nu sunt obligatorii."}</span>
        {currentStep > 0 && <button type="button" disabled={m.saving} onClick={() => go(steps[currentStep - 1].key)}><ArrowLeft /> Înapoi</button>}
        <button type="button" className="is-primary" disabled={m.saving} onClick={() => continueStep(view, fingerprints[view], () => go(steps[currentStep + 1]?.key || "review"))}>{m.saving ? "Se salvează…" : m.dirty ? "Salvează și continuă" : "Confirmă și continuă"}<ArrowRight /></button>
      </div>}

      <footer className="services-editor__actions">
        <div><strong>{m.saving ? "Se salvează…" : m.dirty ? "Modificări nesalvate" : m.pendingReview ? "Cerere în verificare" : m.draft && hasChanges ? "Modificări salvate" : "Oferta este salvată"}</strong><small>Salvarea păstrează progresul. Trimiterea cere aprobarea modificărilor.</small></div>
        {m.editable && m.dirty && <button type="button" disabled={m.saving} onClick={m.save}>Salvează progresul</button>}
        {isReview && m.draft && !m.pendingReview && hasChanges && <button type="button" className="is-primary" disabled={disabled || m.dirty || !m.readiness.configurationComplete} onClick={m.submit}><Send /> Trimite spre aprobare</button>}
        {!isReview && <button type="button" disabled={m.saving} onClick={() => go("review")}>Vezi rezumatul</button>}
        {isReview && m.pendingReview && m.persistenceMode === "v2" && m.editable && <button type="button" disabled={m.saving} onClick={m.withdraw}>Retrage cererea</button>}
      </footer>
      {isReview && m.dirty && <p className="services-editor__footnote">Salvează progresul pentru a putea trimite modificările spre aprobare.</p>}
    </section>
    <DependencyRemovalDialog request={m.pendingRemoval} onCancel={m.cancelDependencyRemoval} onConfirm={m.confirmDependencyRemoval} />
  </div>;
}
