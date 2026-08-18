// Faza 1 din docs/plan-refactor-servicii-2026-08-18.md: toata starea, incarcarea,
// dependentele si persistenta configurarii de servicii, mutate 1:1 din
// ProviderServicesWorkspaceOperational.jsx. Comportamentul si payloadul trimis la
// salvare NU se schimba - doar locul in care traieste logica.
import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getServiceGroupLayout } from "@/lib/canonicalServiceCatalog";
import { PROVIDER_SERVICE_SECTIONS } from "@/lib/providerServiceWorkspaceSections";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
  getFunctionalUnitLayout,
} from "@/lib/providerLocationFunctionalUnits";
import { getServiceOperationalContext, getServiceSearchTerms } from "@/lib/serviceOperationalTaxonomy";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { evaluateServicePrerequisites } from "../../../../../shared/servicePrerequisiteEngine.js";
import {
  applyDraft,
  backendFunctionMissing,
  buildResourceLinks,
  capabilityIdentity,
  cleanText,
  configurationSignature,
  countSelected,
  groupServiceKeys,
  inferCapabilities,
  isB2B,
  legacyServiceRows,
  normalizeSelected,
  normalizeSuggestions,
  normalizedSearch,
  removalPayload,
  resolveSectionUnit,
  resourceRemovalPayload,
  safeParse,
  sectionsForProfile,
  SERVICE_GROUP_BY_KEY,
  selectedCountForSection,
  selectedServiceKeys,
  serviceLabel,
  unitRow,
} from "./servicesConfigModel";

export function useProviderServicesConfig({ locationId, location, onWorkspaceSnapshot, query: externalQuery, onQueryChange, requestedOpenUnitKey }) {
  // Actiunile (save/submit/withdraw) sunt expuse in sus prin snapshot, ca invelisul
  // sa le poata apela direct. Ref-ul tine mereu ultimele handlere; functiile expuse
  // raman stabile ca identitate, altfel snapshot-ul s-ar schimba la fiecare randare.
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
  const [casServiceKeys, setCasServiceKeys] = useState([]);
  const [approvedResourceLinks, setApprovedResourceLinks] = useState({ professionals: [], equipment: [], facilities: [] });
  const [resourceLinks, setResourceLinks] = useState({ professionals: [], equipment: [], facilities: [] });
  const [approvedCareSetting, setApprovedCareSetting] = useState("not_applicable");
  const [careSetting, setCareSetting] = useState("not_applicable");
  const [suggestions, setSuggestions] = useState([]);
  const [rawRemovalKeys, setRawRemovalKeys] = useState([]);
  const [openUnit, setOpenUnit] = useState("");
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
  }, [unitSections, selected, serviceUnitMap, activeUnits]);

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
    // Rezultatul ultimei operatii (salvare, trimitere, retragere, eroare de server) se
    // vedea doar in bara veche, ascunsa de invelisul actual - deci utilizatorul apasa
    // "Salvează" si nu primea nicio confirmare. Acum urca in bara vizibila, cu ton.
    const actionMessage = error
      || message
      || adminNote
      || (dirty ? "Salvează modificările înainte de trimitere." : "")
      || (readiness.configurationComplete ? "Configurația este pregătită pentru trimitere." : readiness.blockers[0]?.message || "");
    const actionTone = error ? "error" : message ? "success" : "info";
    return {
      units,
      selectedCount: readiness.publicServiceKeys.length,
      globalOptionCount: readiness.globalOptionCount,
      suggestionCount: suggestions.length,
      unitCount: activeUnits.length,
      capabilityCount: capabilities.length,
      hasCapabilitySection: (selectableCapabilities || []).length > 0,
      hasCareSettingSection: ((operationalLayout?.careSettings) || []).filter(
        (key) => key !== "not_applicable" && key !== "retail_only",
      ).length > 0,
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
      actionTone,
      saving,
      canSave: Boolean(!saving && editable && dirty),
      canSubmit: Boolean(!saving && draft && editable && !dirty && readiness.configurationComplete),
      canWithdraw: Boolean(!saving && pendingReview && persistenceMode === "v2"),
      hasSave: true,
      hasSubmit: Boolean(draft && draft.status !== "pending_review"),
      hasWithdraw: Boolean(pendingReview && persistenceMode === "v2"),
      approvedCount: selectedServiceKeys(approvedSelected).filter(
        (serviceKey) => getServiceOperationalContext(serviceKey)?.sectionKey !== "business_attributes",
      ).length,
      pendingReview,
      ...stableActions,
    };
  }, [activeUnits, approvedSelected, capabilities.length, careSetting, conflicts, dirty, draft, editable, error, message, operationalLayout, pendingReview, persistenceMode, profileSections, readiness, saving, sectionsByUnit, selectableCapabilities, selectedByUnit, stableActions, suggestions.length, visibleUnits]);

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

  // Faza 3: invelisul cere deschiderea unei zone printr-o proprietate. Inainte apasa
  // programatic butonul de antet gasit in DOM (`header?.click()`).
  useEffect(() => {
    // Formatul e "cheieZona#nonce": nonce-ul permite redeschiderea aceleiasi zone.
    const key = String(requestedOpenUnitKey || "").split("#")[0];
    if (key) setOpenUnit(key);
  }, [requestedOpenUnitKey]);

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
    setCasServiceKeys((current) => current.filter((serviceKey) => !serviceKeys.has(serviceKey)));
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
    setCasServiceKeys((current) => current.filter((serviceKey) => !serviceKeys.has(serviceKey)));
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
      setCasServiceKeys((keys) => keys.filter((serviceKey) => serviceKey !== item.id));
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
      section.items.filter((item) => (selected[item.group] || []).includes(item.id)).forEach((item) => { next[item.id] = unitKey; });
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
          cas_service_keys: payload.cas_service_keys,
        },
      }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, fields: requestError.response?.data?.fields || [] } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.fields?.length ? `${response.data.error}: ${response.data.fields.join(", ")}` : response.data.error);
      return;
    }
    setMessage(persistenceMode === "v2" ? "Draftul complet a fost salvat." : "Draftul a fost salvat prin fluxul compatibil.");
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

  // Conectam handlerii reali la ref, dupa ce toti trei sunt definiti.
  actionsRef.current = { save, submit, withdraw };

  return {
    // date si stare
    config,
    draft,
    persistenceMode,
    loading,
    saving,
    message,
    error,
    conflicts,
    pendingRemoval,
    query,
    setQuery,
    // selectii
    selected,
    approvedSelected,
    activeUnits,
    approvedUnits,
    capabilities,
    approvedCapabilities,
    serviceUnitMap,
    casServiceKeys,
    resourceLinks,
    approvedResourceLinks,
    careSetting,
    approvedCareSetting,
    setCareSetting,
    suggestions,
    rawRemovalKeys,
    openUnit,
    setOpenUnit,
    // derivate
    operationalLayout,
    profileSections,
    globalSections,
    sectionsByUnit,
    selectedByUnit,
    selectableUnits,
    primaryUnits,
    selectableCapabilities,
    primaryCapabilities,
    visibleUnits,
    searchResults,
    selectedCount,
    draftPrerequisites,
    readiness,
    dirty,
    editable,
    pendingReview,
    isB2BProfile,
    // actiuni
    load,
    toggleUnit,
    toggleCapability,
    toggleService,
    toggleCasService,
    changeSectionUnit,
    toggleResource,
    addSuggestion,
    removeSuggestion,
    toggleRawRemoval,
    confirmDependencyRemoval,
    cancelDependencyRemoval: () => setPendingRemoval(null),
    save,
    submit,
    withdraw,
  };
}

export { selectedCountForSection };