// Randul de lead, in limbajul vizual al homepage-ului (2026-08-19): placa tonala pastelata
// cu textura tehnica, colturi marcate, meta in mono. Culorile sunt exact paleta din
// CategoryShowcase.jsx - nu introducem un al doilea sistem de culoare in aplicatie.
// Doar prezentare: starea si eticheta de raspuns vin din backend.
import React from "react";
import { Archive } from "lucide-react";

// Aceleasi tonuri ca placile de categorii din homepage.
const TONES = [
  { border: "#c6d3da", bg: "#dce5e9" },
  { border: "#e1bda8", bg: "#efd5c5" },
  { border: "#ccd2ba", bg: "#dfe3d2" },
  { border: "#d4c6d8", bg: "#e8e0ea" },
  { border: "#dac69b", bg: "#eadcba" },
];

function toneFor(lead) {
  const key = String(lead.intent || lead.id || "");
  let sum = 0;
  for (let index = 0; index < key.length; index += 1) sum += key.charCodeAt(index);
  return TONES[sum % TONES.length];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function LeadListItem({ lead, response, selected, onSelect }) {
  const terminal = lead.is_historical === true;
  const tone = terminal ? { border: "#d9d4ca", bg: "#f1ede4" } : toneFor(lead);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      style={{ borderColor: tone.border, backgroundColor: tone.bg }}
      className={`group relative w-full overflow-hidden rounded-[1.4rem] border px-4 py-3.5 text-left outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(34,30,24,0.07)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none ${selected ? "shadow-[0_18px_42px_rgba(34,30,24,0.09)] ring-2 ring-foreground ring-offset-4 ring-offset-[#F8F4EC]" : "shadow-[0_10px_30px_rgba(34,30,24,0.028)]"}`}
    >
      <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={{ backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" }} />
      <span aria-hidden="true" className="absolute left-2.5 top-2.5 h-2.5 w-2.5 border-l border-t border-black/25" />
      <span aria-hidden="true" className="absolute bottom-2.5 right-2.5 h-2.5 w-2.5 border-b border-r border-black/25" />

      <div className="relative z-10">
        <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.2em] text-black/50">
          {terminal ? "Încheiată" : lead.status === "new" ? "Cerere nouă" : "În lucru"} · {formatDate(lead.created_date)}
        </p>
        <p className="mt-1.5 font-heading text-[1.0625rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#1c1c1c]">
          {lead.intent_label || "Cerere client"}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-black/60">
          {lead.preview_summary || "Rezumatul cererii nu este disponibil."}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.09] pt-2.5">
          <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-black/55">
            {[lead.city, lead.county].filter(Boolean).join(" · ") || "Localitate indisponibilă"}
          </span>
          {terminal ? (
            <Archive aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-black/45" />
          ) : response?.response_label ? (
            <span className="shrink-0 rounded-full bg-[#171717] px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white">{response.response_label}</span>
          ) : lead.status === "new" ? (
            <span aria-hidden="true" className="h-[9px] w-[9px] shrink-0 rounded-full border border-[#8d7658] bg-[#f8f4ec]" />
          ) : null}
        </div>
      </div>
    </button>
  );
}