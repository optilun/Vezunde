import React, { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function lockedMessage(reason) {
  const messages = {
    pro_entitlement_required: "Accesul la contact este disponibil în planul Pro.",
    provider_response_not_eligible: "Trimite mai întâi un răspuns eligibil către client.",
    patient_approval_missing: "Clientul nu a aprobat încă accesul acestei locații la contact.",
    patient_email_not_verified: "Adresa de email a clientului nu este încă verificată.",
    contact_not_active: "Datele de contact nu mai sunt active.",
    lead_not_available: "Leadul nu mai este disponibil.",
    lead_status_not_eligible: "Statusul leadului nu mai permite accesul la contact.",
  };
  return messages[reason] || "Contactul este încă blocat.";
}

function preferenceLabel(value) {
  if (value === "phone") return "Telefon";
  if (value === "either") return "Email sau telefon";
  return "Email";
}

export default function ProviderLeadContactAccess({ leadId, locationId }) {
  const [access, setAccess] = useState(null);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    if (!leadId || !locationId) return;
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLeadContactAccessOps", {
        action: "status",
        lead_id: leadId,
        location_id: locationId,
      });
      const data = responseData(response);
      setAccess(data.contact_access || null);
      if (data.contact_access?.available !== true) setContact(null);
    } catch (loadError) {
      setError(loadError?.message || "Starea contactului nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
  }, [leadId, locationId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const readContact = async () => {
    setReading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLeadContactAccessOps", {
        action: "read",
        lead_id: leadId,
        location_id: locationId,
      });
      const data = responseData(response);
      setAccess(data.contact_access || null);
      setContact(data.contact || null);
    } catch (readError) {
      setContact(null);
      setError(readError?.message || "Contactul nu a putut fi încărcat.");
      await loadStatus();
    } finally {
      setReading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 flex min-h-16 items-center justify-center rounded-xl border border-border bg-secondary/25 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Verificăm acordul pentru contact...
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/25 p-4">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground">Contact aprobat de client</p>
          {!access?.available ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {lockedMessage(access?.reason)}
            </p>
          ) : !contact ? (
            <>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Clientul a aprobat accesul acestei locații. Datele nu sunt încărcate automat; fiecare citire este înregistrată.
              </p>
              <button
                type="button"
                onClick={() => void readContact()}
                disabled={reading}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Vezi contactul aprobat
              </button>
            </>
          ) : (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-background p-3">
              {contact.contact_name && (
                <p className="flex items-center gap-2 text-xs text-foreground">
                  <UserRound className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold">{contact.contact_name}</span>
                </p>
              )}
              {contact.contact_email && (
                <a href={`mailto:${contact.contact_email}`} className="flex items-center gap-2 break-all text-xs font-semibold text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.contact_email}
                </a>
              )}
              {contact.contact_phone && (
                <a href={`tel:${contact.contact_phone}`} className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.contact_phone}
                </a>
              )}
              {contact.contact_preference && (
                <p className="text-[11px] text-muted-foreground">
                  Preferință de contact: <strong className="text-foreground">{preferenceLabel(contact.contact_preference)}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => setContact(null)}
                className="mt-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground hover:bg-secondary"
              >
                <EyeOff className="h-3.5 w-3.5" /> Ascunde contactul
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
