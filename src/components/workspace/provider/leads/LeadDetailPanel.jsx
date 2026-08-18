// Coloana din dreapta a inboxului: leadul selectat, cu raspunsul locatiei, accesul la
// telefon si conversatia. Actiunile si conditiile (canRespond / canAccessContact / canChat)
// vin din entitlement, exact ca inainte - nu se decide nimic nou aici.
import React from "react";
import { Archive, CheckCircle2, Clock3, HelpCircle, Loader2, LockKeyhole, MapPin, XCircle } from "lucide-react";
import ProviderLeadContactAccess from "../ProviderLeadContactAccess";
import ProviderLeadChat from "../ProviderLeadChat";
import LeadFullDetails from "./LeadFullDetails";

const RESPONSE_OPTIONS = [
  { key: "can_help", label: "Putem ajuta", icon: CheckCircle2, active: "border-transparent bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_8px_18px_rgba(16,185,129,0.3)]", idle: "hover:border-emerald-300 hover:text-emerald-700" },
  { key: "needs_details", label: "Avem nevoie de detalii", icon: HelpCircle, active: "border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_8px_18px_rgba(245,158,11,0.3)]", idle: "hover:border-amber-300 hover:text-amber-700" },
  { key: "cannot_help", label: "Nu putem ajuta", icon: XCircle, active: "border-transparent bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-[0_8px_18px_rgba(244,63,94,0.28)]", idle: "hover:border-rose-300 hover:text-rose-700" },
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

export default function LeadDetailPanel({ lead, response, locationId, canRespond, canAccessContact, canChat, onMarkViewed, onRespond, marking, responding }) {
  const services = lead.matched_service_keys?.length ? lead.matched_service_keys : lead.service_keys;
  const terminal = lead.is_historical === true;
  const closure = CLOSURE_PRESENTATION[lead.closure_reason] || {
    title: lead.status === "expired" ? "Cerere expirată" : "Cerere încheiată",
    description: "Cererea nu mai acceptă acțiuni noi. Informațiile disponibile sunt păstrate numai ca istoric.",
  };

  return (
    <article className="space-y-5 rounded-[22px] border border-blue-100 bg-card p-5 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-extrabold tracking-tight text-foreground">{lead.intent_label || "Cerere client"}</h2>
              {lead.status === "new" && !terminal && <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">Nou</span>}
              {terminal && <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground"><Archive className="h-3 w-3" /> Încheiată</span>}
              {response?.response_label && <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">{response.response_label}</span>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead.preview_summary || "Rezumatul cererii nu este disponibil."}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {formatDate(lead.created_date)}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(services || []).slice(0, 5).map((service) => <span key={service} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{serviceLabel(service)}</span>)}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibilă"}</span>
          <span>{lead.for_whom === "copil" ? "Pentru copil" : "Pentru adult"}</span>
          {!terminal && lead.status === "new" && !response && (
            <button type="button" onClick={() => onMarkViewed(lead.id)} disabled={marking} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground hover:bg-secondary disabled:opacity-60">
              {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Marchează ca văzut
            </button>
          )}
        </div>
      </header>

      {terminal && (
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><Archive className="h-4 w-4 text-primary" /> {closure.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{closure.description}</p>
          {lead.closed_at && <p className="mt-2 text-[11px] text-muted-foreground">Încheiată la {formatDate(lead.closed_at)}</p>}
        </div>
      )}

      <LeadFullDetails lead={lead} />

      {canRespond && !terminal && (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground">Răspunsul locației</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {RESPONSE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = response?.response_type === option.key;
              return (
                <button key={option.key} type="button" onClick={() => onRespond(lead.id, option.key)} disabled={responding} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition-all disabled:opacity-60 ${selected ? option.active : `border-border bg-background text-foreground ${option.idle}`}`}>
                  {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Răspunsul nu distribuie automat telefonul și nu deschide unilateral chatul.</p>
        </div>
      )}

      {!terminal && (
        <ProviderLeadContactAccess
          leadId={lead.id}
          locationId={locationId}
          enabled={canAccessContact && lead.full_details?.phone_available_for_request === true}
          responseType={response?.response_type || ""}
        />
      )}

      <ProviderLeadChat
        leadId={lead.id}
        locationId={locationId}
        enabled={canChat && lead.access_tier === "pro_full"}
        responseType={response?.response_type || ""}
        terminal={terminal}
      />

      <p className="inline-flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> {terminal ? "Contactul este retras, iar cererea este disponibilă numai în istoric." : "Telefonul rămâne separat. Chatul devine activ numai după deschiderea explicită de către client."}
      </p>
    </article>
  );
}