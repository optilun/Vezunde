// Randul de lead din coloana din stanga a inboxului. Doar prezentare: starea si eticheta
// de raspuns vin din providerLeadInboxOps / providerLeadResponseOps, nu sunt calculate aici.
import React from "react";
import { Archive, MapPin } from "lucide-react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function LeadListItem({ lead, response, selected, onSelect }) {
  const terminal = lead.is_historical === true;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${selected ? "border-foreground bg-secondary/60" : "border-border bg-card hover:bg-secondary/35"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-extrabold text-foreground">{lead.intent_label || "Cerere client"}</p>
        {lead.status === "new" && !terminal && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Nou</span>}
        {terminal && <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{lead.preview_summary || "Rezumatul cererii nu este disponibil."}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibilă"}</span>
        <span>· {formatDate(lead.created_date)}</span>
      </div>
      {response?.response_label && (
        <span className="mt-2 inline-block rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{response.response_label}</span>
      )}
    </button>
  );
}