import React, { useState } from "react";
import { ArrowLeft, MapPin, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ContactIdentityFields, { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// Module 3H.1B.2: temporary session state so a login redirect doesn't lose the form.
const CONTACT_RESUME_KEY = "pending_claim_contact";

export default function ClaimForm({ location, onDone, onBack }) {
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
  const [reviewing, setReviewing] = useState(false);

  const submit = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      // Save minimal session state (location + form values), then resume post-login.
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

  const valid = contact.contact_name.trim() && contact.email.trim() && contact.claimant_relationship && contact.representation_confirmed;

  const LocationCard = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
      <div className="font-semibold">{location.name}</div>
      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
        <MapPin className="w-3.5 h-3.5" />
        {location.city}{location.address ? `, ${location.address}` : ""}
      </div>
    </div>
  );

  if (reviewing) {
    return (
      <div className="text-left">
        <button type="button" onClick={() => setReviewing(false)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Inapoi
        </button>
        <h2 className="mt-4 font-heading text-lg font-bold">Revizuire</h2>
        <div className="mt-3">{LocationCard}</div>
        <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Nume</span><span className="font-medium">{contact.contact_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Relatie</span><span className="font-medium">{CLAIMANT_RELATIONSHIPS[contact.claimant_relationship] || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{contact.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Telefon</span><span className="font-medium">{contact.phone || "—"}</span></div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Cererea ta va fi verificata manual de echipa Vezunde. Vei fi anuntat pe email dupa analiza.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <ContinueButton onClick={submit} disabled={!valid} loading={submitting}>
          Trimite cererea de revendicare
        </ContinueButton>
      </div>
    );
  }

  return (
    <div className="text-left">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Inapoi la cautare
      </button>
      <p className="mt-4 text-sm text-muted-foreground">
        Pentru a revendica un profil trebuie sa fii conectat la aceasta locatie — proprietar, angajat sau reprezentant autorizat.
      </p>
      <div className="mt-4">{LocationCard}</div>
      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Date de contact</div>
        <ContactIdentityFields value={contact} onChange={setContact} />
      </div>
      {!contact.representation_confirmed && contact.contact_name && (
        <div className="mt-3 flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Confirma ca reprezinti aceasta locatie pentru a putea continua.
        </div>
      )}
      <ContinueButton onClick={() => setReviewing(true)} disabled={!valid}>
        Continua spre revizuire
      </ContinueButton>
      <p className="mt-3 text-xs text-muted-foreground">
        Pentru a trimite cererea este necesar un cont. Cautarea ramane libera.
      </p>
    </div>
  );
}