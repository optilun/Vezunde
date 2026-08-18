// Faza 2: marcajele de stare ale unui rand de serviciu.
// Etapa 2 (2026-08-18): TREI tipuri fixe de marcaj, cu clase proprii, in loc de cinci
// variante colorate ad-hoc. Culoarea inseamna doar stare: portocaliu = atentie,
// neutru = informativ sau draft. Stilurile stau in ProviderServicesTheme.css.
import React from "react";
import { AlertTriangle, Info } from "lucide-react";

export function StatusBadge({ prerequisite }) {
  if (!prerequisite || prerequisite.status === "available") return null;
  const blocked = prerequisite.eligible === false;
  return (
    <span className={`services-badge ${blocked ? "is-attention" : "is-info"}`}>
      {blocked ? <AlertTriangle aria-hidden="true" /> : <Info aria-hidden="true" />}
      {prerequisite.status_label || (blocked ? "Opțiune indisponibilă" : "Informație declarată")}
    </span>
  );
}

export function ChangeBadge({ draftAddition, removalRequested, modified }) {
  if (removalRequested) return <span className="services-badge is-attention">Eliminare propusă</span>;
  if (modified) return <span className="services-badge is-draft">Modificat în draft</span>;
  if (draftAddition) return <span className="services-badge is-draft">Nou în draft</span>;
  return null;
}