import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarCheck, Flag, Globe2, MapPin, Phone } from "lucide-react";
import DirectoryCorrectionForm from "@/components/provider/DirectoryCorrectionForm";
import {
  buildClaimLocationState,
  getPublicProfilePresentation,
} from "@/lib/providerPublicPresentation";

function formatCheckedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function compactWebsite(value) {
  return String(value || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export default function DirectoryProfileNotice({ location, compact = false }) {
  const [reportOpen, setReportOpen] = useState(false);
  const presentation = getPublicProfilePresentation("directory");
  const claimState = buildClaimLocationState(location);
  const checkedAt = formatCheckedAt(location?.source_checked_at);
  const basicDetailsVisible = location?.public_detail_level === "basic" || location?.expose_basic_details === true;

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
              ? "Informații din surse publice. Profilul nu este administrat încă de furnizor."
              : "Acest profil informativ folosește date din surse publice și nu este administrat încă de furnizor. Afișarea nu reprezintă un parteneriat sau o recomandare VIASEE."
            }
          </p>

          {(location?.source_label || checkedAt) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
              {location?.source_label && (
                <span className="rounded-full border border-border bg-card px-2.5 py-1">{location.source_label}</span>
              )}
              {checkedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1">
                  <CalendarCheck className="h-3 w-3" /> Verificat la {checkedAt}
                </span>
              )}
              {basicDetailsVisible && (
                <span className="rounded-full border border-border bg-card px-2.5 py-1">Date de bază verificate editorial</span>
              )}
            </div>
          )}

          {!compact && basicDetailsVisible && (location?.address || location?.phone_public || location?.website) && (
            <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-card p-4 text-xs text-foreground sm:grid-cols-2">
              {location?.address && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{location.address}</span>
                </div>
              )}
              {location?.phone_public && (
                <a href={`tel:${String(location.phone_public).replace(/\s/g, "")}`} className="flex items-center gap-2 font-semibold hover:underline">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {location.phone_public}
                </a>
              )}
              {location?.website && (
                <a href={location.website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold hover:underline">
                  <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{compactWebsite(location.website)}</span>
                </a>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              to="/adauga-sau-revendica"
              state={claimState}
              className="text-xs font-semibold text-foreground underline decoration-foreground/35 underline-offset-4 hover:decoration-foreground"
            >
              Revendică acest profil
            </Link>
            <button
              type="button"
              onClick={() => setReportOpen((current) => !current)}
              aria-expanded={reportOpen}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" /> {reportOpen ? "Închide formularul" : "Semnalează informații incorecte"}
            </button>
          </div>
        </div>
      </div>
      {reportOpen && <DirectoryCorrectionForm location={location} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
