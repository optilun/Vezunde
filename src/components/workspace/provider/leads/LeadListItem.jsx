// Randul de conversatie din inboxul de leaduri (2026-08-22).
//
// Inainte, fiecare cerere era o placa tonala mare, in registrul editorial al homepage-ului.
// Acum lista se citeste ca intr-o aplicatie de mesagerie: avatar, titlu, ultimul rezumat pe
// un singur rand, ora la dreapta si un punct pentru cererile necitite. Paleta si fonturile
// raman cele din design system - se schimba doar structura, nu identitatea vizuala.
//
// Doar prezentare: starea si eticheta de raspuns vin neschimbate din backend.
import React from "react";
import { Archive } from "lucide-react";

// Aceleasi tonuri ca placile de categorii din homepage, pastrate acum pe avatar.
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

// Ora pentru azi, "Ieri" pentru ziua precedenta, data scurta mai departe - conventia din
// aplicatiile de mesagerie, care face lista mult mai usor de scanat decat data completa.
function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ieri";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short" }).format(date);
}

function initial(value) {
  return String(value || "").trim().charAt(0).toUpperCase() || "C";
}

export default function LeadListItem({ lead, response, selected, onSelect }) {
  const terminal = lead.is_historical === true;
  const unread = !terminal && lead.status === "new";
  const tone = terminal ? { border: "#d9d4ca", bg: "#f1ede4" } : toneFor(lead);
  const title = lead.intent_label || "Cerere client";
  const place = [lead.city, lead.county].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] ${
        selected ? "bg-foreground/[0.07]" : "hover:bg-foreground/[0.035]"
      }`}
    >
      <span
        aria-hidden="true"
        style={{ borderColor: tone.border, backgroundColor: tone.bg }}
        className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-heading text-[15px] font-extrabold text-[#1c1c1c]"
      >
        {terminal ? <Archive className="h-4 w-4 text-black/45" /> : initial(title)}
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#F8F4EC] bg-[#171717]" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`min-w-0 truncate font-heading text-[14px] tracking-[-0.02em] text-foreground ${unread ? "font-extrabold" : "font-bold"}`}>
            {title}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">
            {formatWhen(lead.created_date)}
          </span>
        </span>

        <span className="mt-1 flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-[12.5px] leading-relaxed ${unread ? "font-medium text-foreground/85" : "text-muted-foreground"}`}>
            {lead.preview_summary || "Rezumatul cererii nu este disponibil."}
          </span>
          {response?.response_label && (
            <span className="shrink-0 rounded-full bg-[#171717] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white">
              {response.response_label}
            </span>
          )}
        </span>

        {place && (
          <span className="mt-1 block truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/65">
            {place}
          </span>
        )}
      </span>
    </button>
  );
}
