import React from "react";
import { MapPin } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function SelectedLocationCard({ location, onContinue, onChangeLocation }) {
  const requestsAccess = location.claim_action === "request_access";
  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
        <div className="font-heading font-bold text-lg mt-0.5">{location.name}</div>
        {location.organization_name && <div className="mt-0.5 text-xs text-muted-foreground">{location.organization_name}</div>}
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {location.city}{location.address ? `, ${location.address}` : ""}
        </div>
        <div className="mt-4 rounded-xl bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {requestsAccess
            ? "Profilul este deja administrat. Vei trimite o solicitare de acces, iar rolul va fi confirmat la verificare."
            : "Profilul nu este administrat. Vei trimite o solicitare de revendicare si vei putea pregati profilul in cont."}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={onContinue} className="w-full px-6 py-3 rounded-full text-sm font-semibold text-white transition-colors" style={{ backgroundColor: "#171717" }}>
          {requestsAccess ? "Continua cu solicitarea de acces" : "Continua cu revendicarea"}
        </button>
        <button type="button" onClick={onChangeLocation} className="w-full px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors">
          Schimba locatia
        </button>
      </div>
    </div>
  );
}
