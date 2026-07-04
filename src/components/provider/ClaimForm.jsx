import React, { useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ContactIdentityFields from "@/components/provider/ContactIdentityFields";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function ClaimForm({ location, onDone, onBack }) {
  const [contact, setContact] = useState({ contact_name: "", role: "", email: "", phone: "", representation_confirmed: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
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
        representation_confirmed: contact.representation_confirmed,
      })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (res.data?.error) setError(res.data.error);
    else onDone();
  };

  const valid = contact.contact_name.trim() && contact.email.trim() && contact.representation_confirmed;

  return (
    <div className="text-left">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Inapoi la cautare
      </button>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
        <div className="font-semibold">{location.name}</div>
        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5" />
          {location.city}{location.address ? `, ${location.address}` : ""}
        </div>
      </div>
      <div className="mt-5">
        <ContactIdentityFields value={contact} onChange={setContact} />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={submit} disabled={!valid} loading={submitting}>
        Trimite cererea de revendicare
      </ContinueButton>
      <p className="mt-3 text-xs text-muted-foreground">
        Pentru a trimite cererea este necesar un cont. Cautarea ramane libera.
      </p>
    </div>
  );
}