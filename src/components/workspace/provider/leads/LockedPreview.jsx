// Previzualizare blocata pentru planurile fara drept de acces.
//
// Ideea: interfata arata la fel pentru toata lumea. Cine nu are inca planul necesar vede
// aceeasi structura, dar estompata, cu un strat de deblocare deasupra - nu un gol sau un
// paragraf de explicatii, ca pana acum.
//
// REGULA DE SIGURANTA, deliberata si obligatorie: continutul de sub estompare NU este
// niciodata date reale. Backendul nu trimite mesajele sau datele clientului catre planurile
// fara drept (vezi sanitizeProviderLeadForFreeInbox si controlledChatEligibility), iar aici
// desenam doar o schita decorativa, generata local. Un blur CSS peste date reale ar fi doar
// o perdea: oricine deschide consola sau inspecteaza elementul le-ar putea citi. Asa, nu
// exista nimic de descoperit.
//
// Schita este marcata aria-hidden, ca cititoarele de ecran sa nu anunte text fals; mesajul
// real ramane in stratul de deblocare.
import React from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

export default function LockedPreview({ title, description, children, actionLabel = "Vezi planurile", actionTo = "/plati-si-abonamente" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/25">
      <div aria-hidden="true" className="pointer-events-none select-none blur-[5px] saturate-50 opacity-70">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background/70 via-background/85 to-background/95 px-5 py-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-foreground" />
          </span>
          <p className="mt-3 font-heading text-[15px] font-extrabold tracking-[-0.02em] text-foreground">{title}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
          <Link
            to={actionTo}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-5 font-heading text-[12px] font-bold text-background transition-opacity hover:opacity-90"
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Schita de conversatie folosita sub estompare. Text generic, fara nicio legatura cu vreo
// cerere reala - exista doar ca sa se intrevada forma unui chat.
export function ConversationSkeleton() {
  const rows = [
    { mine: false, width: "72%" },
    { mine: true, width: "58%" },
    { mine: false, width: "80%" },
    { mine: true, width: "45%" },
  ];
  return (
    <div className="space-y-2.5 px-4 py-5">
      {rows.map((row, index) => (
        <div key={index} className={`flex items-end gap-2 ${row.mine ? "justify-end" : "justify-start"}`}>
          {!row.mine && <span className="h-7 w-7 shrink-0 rounded-full border border-border bg-card" />}
          <span
            style={{ width: row.width }}
            className={`block h-11 rounded-2xl ${row.mine ? "rounded-br-md bg-foreground/85" : "rounded-bl-md border border-border bg-card"}`}
          />
        </div>
      ))}
    </div>
  );
}

// Schita pentru randul de actiuni (butoanele de raspuns): doar forme de pastila.
export function ActionsSkeleton() {
  return (
    <div className="grid gap-2.5 px-4 py-5 sm:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <span key={index} className="block h-12 rounded-full border border-border bg-card" />
      ))}
    </div>
  );
}

// Schita pentru fisa clientului, in aceeasi logica: doar bare, fara continut.
export function DetailsSkeleton() {
  return (
    <div className="space-y-3 px-4 py-5">
      {["45%", "70%", "88%", "62%"].map((width, index) => (
        <div key={index} className="flex items-center gap-2.5">
          <span className="h-4 w-4 shrink-0 rounded-full border border-border bg-card" />
          <span style={{ width }} className="block h-3.5 rounded-full bg-foreground/15" />
        </div>
      ))}
    </div>
  );
}
