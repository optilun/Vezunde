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
      className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all ${selected ? "border-transparent bg-gradient-to-br from-blue-50 to-white shadow-[0_10px_26px_rgba(37,99,235,0.16)] ring-2 ring-blue-500" : "border-border bg-card hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(23,23,23,0.07)]"}`}
    >
      {/* Marcaj de card comercial: banda colorata in stanga, ca la listele de oferte. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${terminal ? "bg-neutral-300" : lead.status === "new" ? "bg-gradient-to-b from-emerald-400 to-emerald-600" : "bg-gradient-to-b from-blue-400 to-blue-600"}`} />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <p className="min-w-0 truncate text-[13px] font-extrabold text-foreground">{lead.intent_label || "Cerere client"}</p>
        {lead.status === "new" && !terminal && <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">Nou</span>}
        {terminal && <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <p className="mt-1 line-clamp-2 pl-1.5 text-[11px] leading-relaxed text-muted-foreground">{lead.preview_summary || "Rezumatul cererii nu este disponibil."}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-1.5 text-[10px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5"><MapPin className="h-3 w-3 text-blue-600" /> {[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibilă"}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5">{formatDate(lead.created_date)}</span>
      </div>
      {response?.response_label && (
        <span className="mt-2 ml-1.5 inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white">{response.response_label}</span>
      )}
    </button>
  );
}