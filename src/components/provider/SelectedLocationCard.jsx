import React from "react";
import { MapPin } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function SelectedLocationCard({ location, onContinue, onChangeLocation }) {
  const isAccessRequest = location.claim_action === "request_access";
  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
            <div className="font-heading font-bold text-lg mt-0.5">{location.name}</div>
            {location.organization_name && location.organization_name !== location.name && <div className="text-xs text-muted-foreground">{location.organization_name}</div>}
            <div className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{location.city}{location.address ? `, ${location.address}` : ""}</span>
            </div>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {isAccessRequest ? "Profil administrat" : "Profil disponibil"}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {isAccessRequest
          ? "Profilul este deja administrat. Vei trimite o solicitare de acces, iar rolul va fi verificat inainte de aprobare."
          : "Profilul nu are momentan un owner confirmat. Vei trimite o solicitare de revendicare si acces."}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={onContinue} className="w-full px-6 py-3 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: "#171717" }}>
          {isAccessRequest ? "Continua cu solicitarea de acces" : "Continua cu revendicarea"}
        </button>
        <button type="button" onClick={onChangeLocation} className="w-full px-6 py-3 rounded-xl border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors">
          Alege alta locatie
        </button>
      </div>
    </div>
  );
}
