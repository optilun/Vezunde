import React from "react";
import { Link } from "react-router-dom";
import { Building2, Flag } from "lucide-react";
import {
  buildClaimLocationState,
  buildDirectoryReportHref,
  getPublicProfilePresentation,
} from "@/lib/providerPublicPresentation";

export default function DirectoryProfileNotice({ location, compact = false }) {
  const presentation = getPublicProfilePresentation("directory");
  const claimState = buildClaimLocationState(location);
  const reportHref = buildDirectoryReportHref(location);

  return (
    <div className={compact
      ? "rounded-2xl border border-dashed border-border bg-secondary/45 px-4 py-3"
      : "rounded-3xl border border-dashed border-border bg-secondary/40 p-6"
    }>
      <div className="flex items-start gap-3">
        <span className={`flex shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground ${compact ? "h-8 w-8" : "h-10 w-10"}`}>
          <Building2 className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground">{presentation.label}</div>
          <p className={`mt-1 leading-relaxed text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
            {compact
              ? "Informatii de baza din surse publice, neconfirmate inca de furnizor."
              : "VIASEE afiseaza momentan doar numele, tipul si localitatea. Adresa exacta, contactul, programul si serviciile nu sunt publicate pana cand profilul este revendicat."
            }
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              to="/adauga-sau-revendica"
              state={claimState}
              className="text-xs font-semibold text-foreground underline decoration-foreground/35 underline-offset-4 hover:decoration-foreground"
            >
              Revendica acest profil
            </Link>
            <a
              href={reportHref}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" /> Semnaleaza informatii incorecte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
