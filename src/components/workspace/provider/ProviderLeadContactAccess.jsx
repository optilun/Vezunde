import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ELIGIBLE_RESPONSE_TYPES = new Set(["can_help", "needs_details"]);

const REASON_LABELS = {
  pro_entitlement_required: "Accesul la telefonul aprobat este disponibil în planul Pro.",
  patient_approval_missing: "Clientul nu a aprobat încă distribuirea numărului către această locație.",
  provider_response_not_eligible: "Este necesar un răspuns activ «Putem ajuta» sau «Avem nevoie de detalii».",
  lead_not_available: "Leadul nu mai este disponibil.",
  lead_status_not_eligible: "Starea actuală a leadului nu permite accesul la telefon.",
  contact_not_active: "Datele clientului nu mai sunt active.",
  patient_phone_not_available: "Clientul nu a lăsat un număr de telefon.",
  phone_not_approved: "Clientul nu a aprobat distribuirea numărului de telefon.",
  approval_lead_mismatch: "Acordul nu mai corespunde acestei cereri.",
  approval_location_mismatch: "Acordul nu a fost oferit acestei locații.",
  phone_locked: "Numărul de telefon este încă blocat.",
  contact_locked: "Numărul de telefon este încă blocat.",
};

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}

function accessReason(status) {
  const reason = String(status?.reason || "phone_locked");
  return REASON_LABELS[reason] || "Numărul de telefon nu este disponibil în acest moment.";
}

export default function ProviderLeadContactAccess({ leadId, locationId, enabled, responseType }) {
  const [accessStatus, setAccessStatus] = useState(null);
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const eligibleResponse = ELIGIBLE_RESPONSE_TYPES.has(responseType);

  useEffect(() => {
    setAccessStatus(null);
    setPhone("");
    setError("");
  }, [enabled, leadId, locationId, responseType]);

  if (!enabled) return null;

  if (!eligibleResponse) {
    return (
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Răspunde mai întâi că locația poate ajuta sau că are nevoie de detalii. Telefonul rămâne ascuns până la acordul clientului.</p>
        </div>
      </div>
    );
  }

  const checkAccess = async () => {
    setChecking(true);
    setError("");
    setPhone("");
    try {
      const response = await base44.functions.invoke("providerLeadContactAccessOps", {
        action: "status",
        location_id: locationId,
        lead_id: leadId,
      });
      const data = responseData(response);
      setAccessStatus(data.contact_access || { available: false, state: "locked", reason: "phone_locked" });
    } catch (accessError) {
      setAccessStatus(null);
      setError(accessError?.message || "Starea accesului la telefon nu a putut fi verificată.");
    } finally {
      setChecking(false);
    }
  };

  const readApprovedPhone = async () => {
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
      setPhone(data.contact?.contact_phone || "");
    } catch (accessError) {
      setPhone("");
      setAccessStatus({ available: false, state: "locked", reason: "phone_locked" });
      setError(accessError?.message || "Numărul aprobat nu a putut fi deschis.");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Telefon solicitat separat
          </p>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            Numărul se deschide numai după acordul clientului pentru această locație. Fiecare citire este înregistrată în audit.
          </p>
        </div>
        <button type="button" onClick={() => void checkAccess()} disabled={checking || reading} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-60">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Verifică acordul
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>}

      {accessStatus && !accessStatus.available && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-secondary/35 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>{accessReason(accessStatus)}</p>
        </div>
      )}

      {accessStatus?.available && !phone && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Clientul a aprobat numărul pentru această locație</p>
          <button type="button" onClick={() => void readApprovedPhone()} disabled={reading || checking} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60">
            {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />} Afișează telefonul
          </button>
        </div>
      )}

      {phone && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-background p-4">
          <a href={`tel:${phone}`} className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50">
            <Phone className="h-4 w-4 text-primary" />
            <span><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Telefon aprobat</span><span className="mt-0.5 block text-sm font-semibold text-foreground">{phone}</span></span>
          </a>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Folosește numărul numai pentru această cerere și conform acordului clientului.</p>
        </div>
      )}
    </div>
  );
}
