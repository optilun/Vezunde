import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import ClaimRelationStep from "@/components/provider/ClaimRelationStep";
import ClaimContactStep from "@/components/provider/ClaimContactStep";
import ClaimReviewStep from "@/components/provider/ClaimReviewStep";

const CONTACT_RESUME_KEY = "pending_claim_contact";
const LOCATION_RESUME_KEY = "pending_claim_location";
const STEP_RESUME_KEY = "pending_claim_step";

const DEFAULT_CONTACT = {
  contact_name: "",
  claimant_relationship: "",
  email: "",
  phone: "",
  representation_confirmed: false,
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
    storage.removeItem(STEP_RESUME_KEY);
  } catch (_error) {
    // Revendicarea ramane utilizabila chiar daca stocarea temporara este indisponibila.
  }
};

const persistClaimResumeState = (location, contact, step = "review") => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    if (location) storage.setItem(LOCATION_RESUME_KEY, JSON.stringify(location));
    storage.setItem(CONTACT_RESUME_KEY, JSON.stringify({ ...DEFAULT_CONTACT, ...contact }));
    storage.setItem(STEP_RESUME_KEY, step);
  } catch (_error) {
    // Autentificarea si trimiterea continua chiar daca browserul blocheaza sessionStorage.
  }
};

export default function ClaimForm({ location, step, onStepChange, onDone }) {
  const [contact, setContactState] = useState(() => ({
    ...DEFAULT_CONTACT,
    ...(readSessionJson(CONTACT_RESUME_KEY) || {}),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    persistClaimResumeState(location, contact, step || "relation");
  }, [location, step]);

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
        persistClaimResumeState(location, next, step || "contact");
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [location, step]);

  const setContact = (nextContact) => {
    const normalizedContact = { ...DEFAULT_CONTACT, ...nextContact };
    setContactState(normalizedContact);
    persistClaimResumeState(location, normalizedContact, step || "relation");
  };

  const goToStep = (nextStep) => {
    persistClaimResumeState(location, contact, nextStep);
    onStepChange(nextStep);
  };

  const continueAfterRelation = async () => {
    persistClaimResumeState(location, contact, "contact");
    setAuthChecking(true);
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    setAuthChecking(false);
    if (!authenticated) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    onStepChange("contact");
  };

  const submit = async () => {
    persistClaimResumeState(location, contact, "review");
    if (!contact.claimant_relationship || !contact.representation_confirmed) {
      setError("Confirma relatia cu locatia inainte de trimitere.");
      onStepChange("relation");
      return;
    }
    if (!String(contact.contact_name || "").trim() || !String(contact.email || "").trim()) {
      setError("Completeaza numele si emailul inainte de trimitere.");
      onStepChange("contact");
      return;
    }
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await base44.functions
      .invoke("submitProviderClaim", {
        mode: "claim",
        location_id: location.id,
        contact,
        claimant_relationship: contact.claimant_relationship,
        representation_confirmed: contact.representation_confirmed,
      })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
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

  if (step === "contact") {
    return <ClaimContactStep locationCard={locationCard} contact={contact} onChange={setContact} onContinue={() => goToStep("review")} />;
  }

  if (step === "review") {
    return <ClaimReviewStep locationCard={locationCard} contact={contact} error={error} submitting={submitting} onSubmit={submit} />;
  }

  return (
    <ClaimRelationStep
      locationCard={locationCard}
      contact={contact}
      onChange={setContact}
      onContinue={continueAfterRelation}
      loading={authChecking}
    />
  );
}
