import React, { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";
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
  verification_method: "manual_review",
};

const clearClaimResumeState = () => {
  sessionStorage.removeItem(CONTACT_RESUME_KEY);
  sessionStorage.removeItem(LOCATION_RESUME_KEY);
  sessionStorage.removeItem(STEP_RESUME_KEY);
};

const persistClaimResumeState = (location, contact, step = "review") => {
  if (location) sessionStorage.setItem(LOCATION_RESUME_KEY, JSON.stringify(location));
  sessionStorage.setItem(CONTACT_RESUME_KEY, JSON.stringify({ ...DEFAULT_CONTACT, ...contact }));
  sessionStorage.setItem(STEP_RESUME_KEY, step);
};

export default function ClaimForm({ location, user, step, onStepChange, onDone }) {
  const [contact, setContactState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CONTACT_RESUME_KEY);
      if (raw) return { ...DEFAULT_CONTACT, ...JSON.parse(raw) };
    } catch { /* ignore corrupt state */ }
    return {
      ...DEFAULT_CONTACT,
      contact_name: user?.full_name || user?.name || "",
      email: user?.email || "",
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setContactState((current) => {
      const next = {
        ...current,
        contact_name: current.contact_name || user.full_name || user.name || "",
        email: current.email || user.email || "",
      };
      persistClaimResumeState(location, next, step || "relation");
      return next;
    });
  }, [user?.id]);

  const requestedRole = useMemo(
    () => requestedRoleForRelationship(contact.claimant_relationship),
    [contact.claimant_relationship],
  );

  const setContact = (nextContact) => {
    const normalizedContact = { ...DEFAULT_CONTACT, ...nextContact };
    setContactState(normalizedContact);
    persistClaimResumeState(location, normalizedContact, step || "relation");
  };

  const goToStep = (nextStep) => {
    persistClaimResumeState(location, contact, nextStep);
    onStepChange(nextStep);
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
      setError("Sesiunea a expirat. Conecteaza-te din nou pentru a trimite solicitarea.");
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
        requested_membership_role: requestedRole,
        verification_method: contact.verification_method || "manual_review",
        representation_confirmed: contact.representation_confirmed,
      })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (res.data?.error) setError(res.data.error);
    else {
      clearClaimResumeState();
      onDone(res.data);
    }
  };

  const locationCard = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
          <div className="font-semibold">{location.name}</div>
          {location.organization_name && location.organization_name !== location.name && <div className="text-xs text-muted-foreground">{location.organization_name}</div>}
          <div className="text-sm text-muted-foreground flex items-start gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{location.city}{location.address ? `, ${location.address}` : ""}</span>
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {location.claim_action === "request_access" ? "Solicitare acces" : "Revendicare profil"}
        </span>
      </div>
    </div>
  );

  if (step === "contact") {
    return <ClaimContactStep locationCard={locationCard} contact={contact} onChange={setContact} onContinue={() => goToStep("review")} />;
  }

  if (step === "review") {
    return (
      <ClaimReviewStep
        locationCard={locationCard}
        contact={contact}
        requestedRole={requestedRole}
        error={error}
        submitting={submitting}
        onSubmit={submit}
      />
    );
  }

  return (
    <ClaimRelationStep
      locationCard={locationCard}
      contact={contact}
      requestedRole={requestedRole}
      onChange={setContact}
      onContinue={() => goToStep("contact")}
    />
  );
}
