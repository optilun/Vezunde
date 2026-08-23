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

// A treia stare, adaugata 2026-08-23 odata cu editarea in paralel cu verificarea: pana
// acum un element putea fi doar "aprobat" sau "in draft", iar tot ce nu era inca aprobat
// arata la fel. De cand se poate lucra mai departe cat timp o cerere e la admin, cele doua
// sunt lucruri diferite - unul asteapta o decizie, celalalt nici macar nu a plecat - si
// singurul care mai poate fi schimbat e al doilea.
// Ordinea de mai jos e deliberata: ce s-a lucrat DUPA trimitere are prioritate, pentru ca
// e informatia mai proaspata si singura pe care utilizatorul o mai poate influenta acum.
export function ChangeBadge({ draftAddition, removalRequested, modified, inReview = "" }) {
  if (removalRequested) return <span className="services-badge is-attention">Eliminare propusă</span>;
  if (modified) return <span className="services-badge is-draft">Modificat în draft</span>;
  if (draftAddition) return <span className="services-badge is-draft">Nou în draft</span>;
  if (inReview === "removed") return <span className="services-badge is-review">Eliminare în verificare</span>;
  if (inReview === "added") return <span className="services-badge is-review">În verificare</span>;
  return null;
}