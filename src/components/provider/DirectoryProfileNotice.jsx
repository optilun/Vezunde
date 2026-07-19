import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Flag } from "lucide-react";
import DirectoryCorrectionForm from "@/components/provider/DirectoryCorrectionForm";
import {
  buildClaimLocationState,
  getPublicProfilePresentation,
} from "@/lib/providerPublicPresentation";

export default function DirectoryProfileNotice({ location, compact = false }) {
  const [reportOpen, setReportOpen] = useState(false);
  const presentation = getPublicProfilePresentation("directory");
  const claimState = buildClaimLocationState(location);

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
              ? "Informatii de baza din surse publice. Profilul nu este administrat inca de furnizor."
              : "Acest profil informativ foloseste date din surse publice si nu este administrat inca de furnizor. Afisarea nu reprezinta un parteneriat sau o recomandare VIASEE."
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
            <button
              type="button"
              onClick={() => setReportOpen((current) => !current)}
              aria-expanded={reportOpen}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" /> {reportOpen ? "Inchide formularul" : "Semnaleaza informatii incorecte"}
            </button>
          </div>
        </div>
      </div>
      {reportOpen && <DirectoryCorrectionForm location={location} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
