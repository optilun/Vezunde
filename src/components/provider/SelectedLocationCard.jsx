import React from "react";
import { MapPin } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function SelectedLocationCard({ location, onContinue, onChangeLocation }) {
  const requestsAccess = location.claim_action === "request_access";
  return (
    <div className="min-w-0 text-left">
      <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-xl sm:p-5">
        <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
        <div className="mt-1 break-words font-heading text-lg font-bold leading-snug">{location.name}</div>
        {location.organization_name && <div className="mt-1 break-words text-xs text-muted-foreground">{location.organization_name}</div>}
        <div className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{location.city}{location.address ? `, ${location.address}` : ""}</span>
        </div>
        <div className="mt-4 rounded-xl bg-secondary/40 px-3 py-3 text-xs leading-5 text-muted-foreground">
          {requestsAccess
            ? "Profilul este deja administrat. Vei trimite o solicitare de acces, iar rolul va fi confirmat la verificare."
            : "Profilul nu este administrat. Vei trimite o solicitare de revendicare si vei putea pregati profilul in cont."}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:mt-6">
        <button type="button" onClick={onContinue} className="min-h-12 w-full rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:rounded-full">
          {requestsAccess ? "Continua cu solicitarea de acces" : "Continua cu revendicarea"}
        </button>
        <button type="button" onClick={onChangeLocation} className="min-h-12 w-full rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:border-foreground/40 sm:rounded-full">
          Schimba locatia
        </button>
      </div>
    </div>
  );
}
