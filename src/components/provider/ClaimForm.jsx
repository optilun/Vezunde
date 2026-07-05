import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import ClaimRelationStep from "@/components/provider/ClaimRelationStep";
import ClaimContactStep from "@/components/provider/ClaimContactStep";
import ClaimReviewStep from "@/components/provider/ClaimReviewStep";

// Module 3H.1B.2: temporary session state so a login redirect doesn't lose the form.
const CONTACT_RESUME_KEY = "pending_claim_contact";

// Module 3H.1B.3.UI: short claim flow — orchestrates 3 sub-steps (relation,
// contact, review) using the existing submitProviderClaim action, unchanged.
export default function ClaimForm({ location, step, onStepChange, onDone }) {
  const [contact, setContact] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CONTACT_RESUME_KEY);
      if (raw) {
        sessionStorage.removeItem(CONTACT_RESUME_KEY);
        return { contact_name: "", claimant_relationship: "", email: "", phone: "", representation_confirmed: false, ...JSON.parse(raw) };
      }
    } catch { /* ignore corrupt state */ }
    return { contact_name: "", claimant_relationship: "", email: "", phone: "", representation_confirmed: false };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      sessionStorage.setItem("pending_claim_location", JSON.stringify(location));
      sessionStorage.setItem(CONTACT_RESUME_KEY, JSON.stringify(contact));
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
    else onDone();
  };

  const locationCard = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
      <div className="font-semibold">{location.name}</div>
      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
        <MapPin className="w-3.5 h-3.5" />
        {location.city}{location.address ? `, ${location.address}` : ""}
      </div>
    </div>
  );

  if (step === "contact") {
    return (
      <ClaimContactStep
        locationCard={locationCard}
        contact={contact}
        onChange={setContact}
        onContinue={() => onStepChange("review")}
      />
    );
  }

  if (step === "review") {
    return (
      <ClaimReviewStep
        locationCard={locationCard}
        contact={contact}
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
      onChange={setContact}
      onContinue={() => onStepChange("contact")}
    />
  );
}