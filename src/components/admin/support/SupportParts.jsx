import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { ORGANIZATION_ID_PREFIX } from "@/lib/adminGlobalSearch";
import { supportSourceLabel } from "@/lib/adminLabels";
import { adminHref } from "@/lib/adminNavConfig";

// Piese comune pentru Tichete suport și Feedback (2026-10-07): același câmp de căutare, același buton
// de actualizare, aceleași detalii de context și aceeași defilare spre detaliu pe telefon.

// Câmpul de căutare, butonul de actualizare, filtrul cu listă și defilarea spre detaliu sunt comune cu celelalte
// liste „listă + detaliu” (vezi ui/AdminListControls.jsx); aici păstrăm numele vechi.
export {
  AdminFilterSelect as FilterSelect,
  AdminRefreshButton as RefreshButton,
  AdminSearchField as SupportSearchField,
  useScrollToDetail,
} from "@/components/admin/ui/AdminListControls";

export function EmailLink({ email }) {
  if (!email) return <span className="text-muted-foreground">Email indisponibil</span>;
  return (
    <a href={`mailto:${email}`} className="break-all underline underline-offset-2 hover:text-foreground">
      {email}
    </a>
  );
}

// De unde a venit mesajul și ce poți deschide din el. Identificatorii tehnici stau într-o secțiune
// închisă: contează doar când cauți ceva în Base44.
export function SupportContext({ source, pagePath, organizationId, professionalProfileId, userId }) {
  const technical = [
    ["ID utilizator", userId],
    ["ID organizație", organizationId],
    ["ID profil profesional", professionalProfileId],
  ].filter(([, value]) => value);
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div>
        Trimis din <span className="font-semibold text-foreground">{supportSourceLabel(source)}</span>
        {pagePath && <span className="[overflow-wrap:anywhere]"> · {pagePath}</span>}
      </div>
      {organizationId && (
        <Link
          to={adminHref("profiluri", "", `${ORGANIZATION_ID_PREFIX}${organizationId}`)}
          className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2"
        >
          Deschide organizația <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
      {technical.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none font-semibold hover:text-foreground">Detalii tehnice</summary>
          <dl className="mt-1.5 space-y-0.5 break-all">
            {technical.map(([label, value]) => (
              <div key={label}><dt className="inline">{label}: </dt><dd className="inline font-mono text-[11px]">{value}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
