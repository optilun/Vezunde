// Detaliile private ale clientului, exact aceleasi reguli de afisare ca inainte: se arata
// numai daca backendul a marcat full_details_status.available (Top 3 + Pro + acord activ).
import React from "react";
import { Mail, MessageSquareText, UserRound } from "lucide-react";

export default function LeadFullDetails({ lead }) {
  if (lead.is_historical) {
    return (
      <div className="rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">
        Datele private ale clientului nu mai sunt disponibile după încheierea cererii. Istoricul chatului rămâne separat, numai pentru locațiile Pro eligibile.
      </div>
    );
  }

  const details = lead.full_details;
  if (!lead.full_details_status?.available || !details) {
    return (
      <div className="rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">
        {lead.access_tier === "pro_full"
          ? "Acest lead este în Top 3, dar detaliile complete necesită plan Pro activ și acordul actual al clientului."
          : "Acest lead este disponibil ca rezumat anonim. Detaliile complete și chatul sunt rezervate locațiilor Pro din Top 3."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Detalii Pro · Top 3</p>
        <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">Acces auditat</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Client</p><p className="font-semibold text-foreground">{details.client_name || "Nume indisponibil"}</p></div>
        </div>
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email verificat</p><p className="break-all font-semibold text-foreground">{details.client_email || "Email neconfirmat sau necompletat"}</p></div>
        </div>
        <div className="flex items-start gap-2">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mesajul clientului</p><p className="whitespace-pre-wrap leading-relaxed text-foreground">{details.detailed_message}</p></div>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        {details.phone_available_for_request
          ? "Clientul a lăsat și un număr de telefon. Numărul rămâne ascuns și poate fi solicitat separat."
          : "Clientul nu a lăsat un număr de telefon. Comunicarea poate continua prin email și prin chatul VIASEE deschis de client."}
      </p>
    </div>
  );
}