// Coloana din dreapta a inboxului, in limbajul homepage-ului (2026-08-19): fundal crem,
// titlu editorial, secvente despartite de linii subtiri cu eyebrow mono, actiune primara
// ca pastila neagra. Regulile de acces (canRespond / canAccessContact / canChat) vin din
// entitlement, exact ca inainte - aici nu se decide nimic.
import React from "react";
import { Archive, CheckCircle2, HelpCircle, Loader2, LockKeyhole, XCircle } from "lucide-react";
import ProviderLeadContactAccess from "../ProviderLeadContactAccess";
import ProviderLeadChat from "../ProviderLeadChat";
import LeadFullDetails from "./LeadFullDetails";

const RESPONSE_OPTIONS = [
  { key: "can_help", label: "Putem ajuta", icon: CheckCircle2 },
  { key: "needs_details", label: "Avem nevoie de detalii", icon: HelpCircle },
  { key: "cannot_help", label: "Nu putem ajuta", icon: XCircle },
];

const CLOSURE_PRESENTATION = {
  request_resolved: {
    title: "Cerere rezolvată de client",
    description: "Clientul a confirmat că și-a rezolvat nevoia. Răspunsurile și conversația rămân doar în istoric.",
  },
  request_closed: {
    title: "Cerere închisă de client",
    description: "Cererea nu mai acceptă răspunsuri, mesaje sau acces la date de contact.",
  },
  request_expired: {
    title: "Cerere expirată",
    description: "Perioada activă s-a încheiat automat. Datele de contact nu mai sunt disponibile.",
  },
};

function formatDate(value) {
  if (!value) return "Dată indisponibilă";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function serviceLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Eyebrow({ children }) {
  return <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">{children}</p>;
}

export default function LeadDetailPanel({ lead, response, locationId, canRespond, canAccessContact, canChat, onMarkViewed, onRespond, marking, responding }) {
  const services = lead.matched_service_keys?.length ? lead.matched_service_keys : lead.service_keys;
  const terminal = lead.is_historical === true;
  const closure = CLOSURE_PRESENTATION[lead.closure_reason] || {
    title: lead.status === "expired" ? "Cerere expirată" : "Cerere încheiată",
    description: "Cererea nu mai acceptă acțiuni noi. Informațiile disponibile sunt păstrate numai ca istoric.",
  };

  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-7 shadow-[0_10px_30px_rgba(34,30,24,0.03)]">
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={{ backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" }} />

      <div className="relative z-10">
        <header>
          <Eyebrow>{terminal ? "Istoric cereri" : lead.status === "new" ? "Cerere nouă" : "Cerere în lucru"} · {formatDate(lead.created_date)}</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-heading text-[2rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[2.4rem]">
            {lead.intent_label || "Cerere client"}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {lead.preview_summary || "Rezumatul cererii nu este disponibil."}
          </p>

          {/* Linia subtire cu jaloane: acelasi accent grafic ca banda de sub placile din homepage. */}
          <div className="relative mt-6 h-px bg-[#9a8668]/45">
            {[18, 52, 84].map((position) => (
              <span key={position} aria-hidden="true" className="absolute -top-1 h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-[#8d7658] bg-[#f8f4ec]" style={{ left: `${position}%` }} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {(services || []).slice(0, 5).map((service) => (
              <span key={service} className="rounded-full border border-[#c6d3da] bg-[#dce5e9] px-3 py-1 font-heading text-[12px] font-bold tracking-[-0.01em] text-[#1c1c1c]">
                {serviceLabel(service)}
              </span>
            ))}
            <span className="rounded-full border border-[#e3ddd0] bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {[lead.city, lead.county].filter(Boolean).join(" · ") || "Localitate indisponibilă"}
            </span>
            <span className="rounded-full border border-[#e3ddd0] bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {lead.for_whom === "copil" ? "Pentru copil" : "Pentru adult"}
            </span>
            {!terminal && lead.status === "new" && !response && (
              <button type="button" onClick={() => onMarkViewed(lead.id)} disabled={marking} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-foreground/25 px-3.5 font-heading text-[12px] font-bold text-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-60">
                {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Marchează ca văzut
              </button>
            )}
          </div>
        </header>

        {terminal && (
          <section className="mt-8 border-t border-border pt-6">
            <Eyebrow>Stare finală</Eyebrow>
            <h3 className="mt-2 inline-flex items-center gap-2 font-heading text-xl font-extrabold tracking-[-0.03em]">
              <Archive aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> {closure.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{closure.description}</p>
            {lead.closed_at && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">Încheiată la {formatDate(lead.closed_at)}</p>}
          </section>
        )}

        <section className="mt-8 border-t border-border pt-6">
          <Eyebrow>Datele clientului</Eyebrow>
          <div className="mt-3">
            <LeadFullDetails lead={lead} />
          </div>
        </section>

        {canRespond && !terminal && (
          <section className="mt-8 border-t border-border pt-6">
            <Eyebrow>Răspunsul locației</Eyebrow>
            <h3 className="mt-2 font-heading text-xl font-extrabold tracking-[-0.03em]">Ce transmiți clientului</h3>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {RESPONSE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = response?.response_type === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onRespond(lead.id, option.key)}
                    disabled={responding}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-heading text-[13px] font-bold tracking-[-0.015em] outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#fdfbf6] disabled:opacity-60 motion-reduce:transform-none ${selected ? "bg-[#171717] text-white shadow-[0_16px_38px_rgba(18,18,18,0.15)]" : "border border-foreground/20 bg-white/70 text-foreground hover:shadow-[0_12px_28px_rgba(34,30,24,0.06)]"}`}
                  >
                    {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Răspunsul nu distribuie automat telefonul și nu deschide unilateral chatul.
            </p>
          </section>
        )}

        {!terminal && (
          <section className="mt-8 border-t border-border pt-6">
            <Eyebrow>Contact telefonic</Eyebrow>
            <div className="mt-3">
              <ProviderLeadContactAccess
                leadId={lead.id}
                locationId={locationId}
                enabled={canAccessContact && lead.full_details?.phone_available_for_request === true}
                responseType={response?.response_type || ""}
              />
            </div>
          </section>
        )}

        <section className="mt-8 border-t border-border pt-6">
          <Eyebrow>Conversație</Eyebrow>
          <div className="mt-3">
            <ProviderLeadChat
              leadId={lead.id}
              locationId={locationId}
              enabled={canChat && lead.access_tier === "pro_full"}
              responseType={response?.response_type || ""}
              terminal={terminal}
            />
          </div>
        </section>

        <p className="mt-8 inline-flex items-start gap-2 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
          <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {terminal ? "Contactul este retras, iar cererea este disponibilă numai în istoric." : "Telefonul rămâne separat. Chatul devine activ numai după deschiderea explicită de către client."}
        </p>
      </div>
    </article>
  );
}