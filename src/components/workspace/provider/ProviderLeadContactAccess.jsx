import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ELIGIBLE_RESPONSE_TYPES = new Set(["can_help", "needs_details"]);

const REASON_LABELS = {
  pro_entitlement_required: "Accesul la datele aprobate este disponibil în planul Pro.",
  patient_approval_missing: "Clientul nu a aprobat încă distribuirea datelor către această locație.",
  patient_email_not_verified: "Clientul trebuie să își confirme adresa de email înainte ca accesul să poată fi acordat.",
  provider_response_not_eligible: "Este necesar un răspuns activ «Putem ajuta» sau «Avem nevoie de detalii».",
  lead_not_available: "Leadul nu mai este disponibil.",
  lead_status_not_eligible: "Starea actuală a leadului nu permite accesul la contact.",
  contact_not_active: "Datele de contact nu mai sunt active.",
  no_contact_fields_approved: "Clientul nu a aprobat niciun câmp de contact.",
  approval_lead_mismatch: "Acordul nu mai corespunde acestei cereri.",
  approval_location_mismatch: "Acordul nu a fost oferit acestei locații.",
  contact_locked: "Datele de contact sunt încă blocate.",
};

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}

function preferenceLabel(value) {
  if (value === "phone") return "Preferă telefonul";
  if (value === "either") return "Poate fi contactat prin email sau telefon";
  return "Preferă emailul";
}

function contactReason(status) {
  const reason = String(status?.reason || "contact_locked");
  return REASON_LABELS[reason] || "Datele de contact nu sunt disponibile în acest moment.";
}

export default function ProviderLeadContactAccess({ leadId, locationId, enabled, responseType }) {
  const [accessStatus, setAccessStatus] = useState(null);
  const [contact, setContact] = useState(null);
  const [checking, setChecking] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const eligibleResponse = ELIGIBLE_RESPONSE_TYPES.has(responseType);

  useEffect(() => {
    setAccessStatus(null);
    setContact(null);
    setError("");
  }, [enabled, leadId, locationId, responseType]);

  const contactRows = useMemo(() => {
    if (!contact) return [];
    return [
      contact.contact_name ? { key: "name", label: "Nume", value: contact.contact_name, icon: UserRound } : null,
      contact.contact_email ? { key: "email", label: "Email", value: contact.contact_email, href: `mailto:${contact.contact_email}`, icon: Mail } : null,
      contact.contact_phone ? { key: "phone", label: "Telefon", value: contact.contact_phone, href: `tel:${contact.contact_phone}`, icon: Phone } : null,
    ].filter(Boolean);
  }, [contact]);

  if (!enabled) return null;

  if (!eligibleResponse) {
    return (
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Răspunde mai întâi că locația poate ajuta sau că are nevoie de detalii. Contactul rămâne blocat până la acordul clientului.</p>
        </div>
      </div>
    );
  }

  const checkAccess = async () => {
    setChecking(true);
    setError("");
    setContact(null);
    try {
      const response = await base44.functions.invoke("providerLeadContactAccessOps", {
        action: "status",
        location_id: locationId,
        lead_id: leadId,
      });
      const data = responseData(response);
      setAccessStatus(data.contact_access || { available: false, state: "locked", reason: "contact_locked" });
    } catch (accessError) {
      setAccessStatus(null);
      setError(accessError?.message || "Starea accesului la contact nu a putut fi verificată.");
    } finally {
      setChecking(false);
    }
  };

  const readApprovedContact = async () => {
    setReading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLeadContactAccessOps", {
        action: "read",
        location_id: locationId,
        lead_id: leadId,
      });
      const data = responseData(response);
      setAccessStatus(data.contact_access || { available: true, state: "patient_approved" });
      setContact(data.contact || null);
    } catch (accessError) {
      setContact(null);
      setError(accessError?.message || "Datele aprobate nu au putut fi deschise.");
      await checkAccess();
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Date de contact aprobate
          </p>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            Datele se deschid numai după acordul clientului și sunt verificate din nou de server. Fiecare citire aprobată este înregistrată în audit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkAccess()}
          disabled={checking || reading}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Verifică acordul
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {accessStatus && !accessStatus.available && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-secondary/35 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{contactReason(accessStatus)}</p>
        </div>
      )}

      {accessStatus?.available && !contact && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Clientul a aprobat accesul pentru această locație
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Deschiderea va returna numai câmpurile aprobate și va crea o înregistrare de audit.
          </p>
          <button
            type="button"
            onClick={() => void readApprovedContact()}
            disabled={reading || checking}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Afișează datele aprobate
          </button>
        </div>
      )}

      {contact && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {contactRows.map((row) => {
              const Icon = row.icon;
              const content = (
                <>
                  <Icon className="h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{row.label}</span>
                    <span className="mt-0.5 block break-all text-sm font-semibold text-foreground">{row.value}</span>
                  </span>
                </>
              );
              return row.href ? (
                <a key={row.key} href={row.href} className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50">
                  {content}
                </a>
              ) : (
                <div key={row.key} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {content}
                </div>
              );
            })}
          </div>
          {contact.contact_preference && (
            <p className="mt-3 text-[11px] font-semibold text-muted-foreground">{preferenceLabel(contact.contact_preference)}</p>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Folosește datele numai pentru această cerere și conform acordului clientului. Conversația VIASEE rămâne dezactivată.
          </p>
        </div>
      )}
    </div>
  );
}
