import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import ClaimRelationStep from "@/components/provider/ClaimRelationStep";
import ClaimScopeStep from "@/components/provider/ClaimScopeStep";
import ClaimContactStep from "@/components/provider/ClaimContactStep";
import ClaimReviewStep from "@/components/provider/ClaimReviewStep";
import {
  CLAIM_SCOPE,
  normalizeClaimScopeDraft,
  scopeDraftForChoice,
  validateClaimScopeDraft,
} from "@/lib/providerClaimScope";

const CONTACT_RESUME_KEY = "pending_claim_contact";
const LOCATION_RESUME_KEY = "pending_claim_location";
const SCOPE_RESUME_KEY = "pending_claim_scope";
const STEP_RESUME_KEY = "pending_claim_step";

const DEFAULT_CONTACT = {
  contact_name: "",
  claimant_relationship: "",
  email: "",
  phone: "",
  representation_confirmed: false,
};

const DEFAULT_SCOPE = {
  claim_scope: CLAIM_SCOPE.LOCATION,
  requested_location_ids: [],
  excluded_location_ids: [],
  reported_missing_location: "",
};

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch (_error) {
    return null;
  }
}

function readSessionJson(key) {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

const clearClaimResumeState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(CONTACT_RESUME_KEY);
    storage.removeItem(LOCATION_RESUME_KEY);
    storage.removeItem(SCOPE_RESUME_KEY);
    storage.removeItem(STEP_RESUME_KEY);
  } catch (_error) {
    // Revendicarea ramane utilizabila chiar daca stocarea temporara este indisponibila.
  }
};

const persistClaimResumeState = (location, contact, scope, step = "review") => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    if (location) storage.setItem(LOCATION_RESUME_KEY, JSON.stringify(location));
    storage.setItem(CONTACT_RESUME_KEY, JSON.stringify({ ...DEFAULT_CONTACT, ...contact }));
    storage.setItem(SCOPE_RESUME_KEY, JSON.stringify({ ...DEFAULT_SCOPE, ...scope }));
    storage.setItem(STEP_RESUME_KEY, step);
  } catch (_error) {
    // Autentificarea si trimiterea continua chiar daca browserul blocheaza sessionStorage.
  }
};

export default function ClaimForm({ location, step, preferredScope = "", onStepChange, onDone }) {
  const [contact, setContactState] = useState(() => ({
    ...DEFAULT_CONTACT,
    ...(readSessionJson(CONTACT_RESUME_KEY) || {}),
  }));
  const [scope, setScopeState] = useState(() => normalizeClaimScopeDraft({
    ...DEFAULT_SCOPE,
    ...(readSessionJson(SCOPE_RESUME_KEY) || {}),
  }, location?.id));
  const [scopeOptions, setScopeOptions] = useState(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const scopeRequestInFlight = useRef(false);
  const scopeLoadAttempted = useRef(false);

  useEffect(() => {
    persistClaimResumeState(location, contact, scope, step || "relation");
  }, [location, step]);

  useEffect(() => {
    scopeRequestInFlight.current = false;
    scopeLoadAttempted.current = false;
    setScopeOptions(null);
    setScopeError("");
  }, [location?.id]);

  useEffect(() => {
    let cancelled = false;
    base44.auth.isAuthenticated().then(async (authenticated) => {
      if (!authenticated || cancelled) return;
      const user = await base44.auth.me().catch(() => null);
      if (!user || cancelled) return;
      setContactState((current) => {
        const next = {
          ...current,
          contact_name: current.contact_name || user.full_name || user.name || "",
          email: current.email || user.email || "",
        };
        persistClaimResumeState(location, next, scope, step || "contact");
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [location, step]);

  const loadScopeOptions = useCallback(async (force = false) => {
    if (!location?.id || scopeRequestInFlight.current || (!force && scopeLoadAttempted.current)) return;
    scopeRequestInFlight.current = true;
    scopeLoadAttempted.current = true;
    setScopeLoading(true);
    setScopeError("");
    const response = await base44.functions.invoke("getProviderClaimScopeOptions", {
      location_id: location.id,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    scopeRequestInFlight.current = false;
    setScopeLoading(false);
    if (response.data?.error) {
      setScopeError(response.data.error);
      return;
    }
    const options = response.data || null;
    setScopeOptions(options);
    setScopeState((current) => {
      // Aria propusa din cautare (card de organizatie) se aplica o singura data, doar
      // daca utilizatorul nu a ales deja altceva si daca aria e permisa.
      const requestedScope = current.claim_scope === CLAIM_SCOPE.LOCATION && preferredScope
        ? preferredScope
        : current.claim_scope;
      current = { ...current, claim_scope: requestedScope };
      const availableScope = current.claim_scope === CLAIM_SCOPE.ORGANIZATION && !options?.supports_organization_claim
        ? CLAIM_SCOPE.LOCATION
        : current.claim_scope === CLAIM_SCOPE.SELECTED_LOCATIONS && !options?.supports_selected_locations
          ? CLAIM_SCOPE.LOCATION
          : current.claim_scope;
      const next = scopeDraftForChoice(availableScope, options, current);
      persistClaimResumeState(location, contact, next, step || "scope");
      return next;
    });
  }, [contact, location, preferredScope, step]);

  useEffect(() => {
    if (["scope", "contact", "review"].includes(step) && !scopeOptions) loadScopeOptions();
  }, [loadScopeOptions, scopeOptions, step]);

  const setContact = (nextContact) => {
    const normalizedContact = { ...DEFAULT_CONTACT, ...nextContact };
    setContactState(normalizedContact);
    persistClaimResumeState(location, normalizedContact, scope, step || "relation");
  };

  const setScope = (nextScope) => {
    const normalizedScope = normalizeClaimScopeDraft(nextScope, location?.id);
    setScopeState(normalizedScope);
    persistClaimResumeState(location, contact, normalizedScope, step || "scope");
  };

  const goToStep = (nextStep) => {
    persistClaimResumeState(location, contact, scope, nextStep);
    onStepChange(nextStep);
  };

  // Fara verificare de autentificare aici (2026-08-18): ruta cere cont la intrare.
  const continueAfterRelation = () => {
    persistClaimResumeState(location, contact, scope, "scope");
    onStepChange("scope");
  };

  const continueAfterScope = () => {
    const validationError = validateClaimScopeDraft(scope, scopeOptions);
    if (validationError) {
      setScopeError(validationError);
      return;
    }
    setScopeError("");
    goToStep("contact");
  };

  const submit = async () => {
    persistClaimResumeState(location, contact, scope, "review");
    if (!contact.claimant_relationship || !contact.representation_confirmed) {
      setError("Confirma relatia inainte de trimitere.");
      onStepChange("relation");
      return;
    }
    if (!scopeOptions) {
      setError("Locatiile asociate trebuie incarcate din nou.");
      onStepChange("scope");
      return;
    }
    const scopeValidationError = validateClaimScopeDraft(scope, scopeOptions);
    if (scopeValidationError) {
      setError(scopeValidationError);
      onStepChange("scope");
      return;
    }
    if (!String(contact.contact_name || "").trim() || !String(contact.email || "").trim()) {
      setError("Completeaza numele si emailul inainte de trimitere.");
      onStepChange("contact");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await base44.functions
      .invoke("submitProviderScopedClaim", {
        mode: "claim",
        location_id: location.id,
        claim_scope: scope.claim_scope,
        requested_location_ids: scope.requested_location_ids,
        excluded_location_ids: scope.excluded_location_ids,
        reported_missing_location: scope.reported_missing_location,
        // Sugestiile de retea (2026-08-19): trimise separat de requested_location_ids,
        // ca adminul sa vada clar ce a cerut furnizorul explicit si ce a acceptat
        // dintr-o sugestie automata a sistemului.
        include_network_suggestions: Boolean(scope.include_network_suggestions),
        suggested_location_ids: scope.suggested_location_ids || [],
        contact,
        claimant_relationship: contact.claimant_relationship,
        representation_confirmed: contact.representation_confirmed,
      })
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSubmitting(false);
    if (res.data?.error) setError(res.data.error);
    else {
      clearClaimResumeState();
      onDone(res.data || {});
    }
  };

  const locationCard = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
      <div className="font-semibold">{location.name}</div>
      <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {location.city}{location.address ? `, ${location.address}` : ""}
      </div>
    </div>
  );

  if (step === "scope") {
    return (
      <ClaimScopeStep
        locationCard={locationCard}
        options={scopeOptions}
        scope={scope}
        contact={contact}
        loading={scopeLoading}
        error={scopeError}
        onChange={setScope}
        onRetry={() => loadScopeOptions(true)}
        onContinue={continueAfterScope}
      />
    );
  }

  if (step === "contact") {
    return <ClaimContactStep locationCard={locationCard} contact={contact} onChange={setContact} onContinue={() => goToStep("review")} />;
  }

  if (step === "review") {
    return <ClaimReviewStep locationCard={locationCard} contact={contact} scope={scope} options={scopeOptions} error={error} submitting={submitting} onSubmit={submit} />;
  }

  return (
    <ClaimRelationStep
      locationCard={locationCard}
      contact={contact}
      onChange={setContact}
      onContinue={continueAfterRelation}
    />
  );
}