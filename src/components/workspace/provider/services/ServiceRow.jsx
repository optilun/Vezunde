// Faza 2: randul de serviciu plus bifa secundara de CAS.
//
// 2026-08-23 (varianta A aprobata de Alex): randul a fost rearanjat ca sa se citeasca
// dintr-o privire, nu sa se citeasca propriu-zis.
//   - controlul e acum o BIFA in stanga, nu un comutator in dreapta. Motivul practic:
//     intr-un grup cu 6-7 randuri ochiul scaneaza o singura coloana de bife, nu bate
//     de fiecare data toata latimea randului pana la comutatorul din marginea dreapta.
//     (Inlocuieste decizia din 2026-08-06, "comutator" - luata inainte de gruparea in
//     carduri, cand randurile erau late cat continutul.)
//   - descrierea din catalog e ASCUNSA implicit si apare doar cand grupul are
//     "Descrieri" pornit. Mesajele de stare - eliminare propusa, blocaj de
//     prerechizita - se arata mereu, indiferent de comutator: acelea nu sunt text de
//     lectura, sunt avertismente.
import React from "react";
import { Check } from "lucide-react";
import { getServiceDescription } from "../../../../../shared/serviceDescriptions.js";
import { ChangeBadge, StatusBadge } from "./ServiceBadges";
import { isSelected, serviceLabel } from "./servicesConfigModel";

export default function ServiceRow({ item, selected, approvedSelected, prerequisite, unitKey, disabled, helperText = "", onToggle, casActive = false, casEligible = false, onToggleCas, filter = "all", showDescription = true, compact = false }) {
  const active = isSelected(selected, item);
  const approved = isSelected(approvedSelected, item);
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  const blockerDetail = active && prerequisite?.eligible === false
    ? prerequisite.blockers?.[0]?.message
    : "";
  // Textul de stare are prioritate si NU poate fi ascuns. Descrierea de catalog este
  // optionala si tine de comutatorul "Descrieri".
  const stateDetail = removalRequested
    ? "La trimiterea cererii, elementul este ascuns public până la soluționare."
    : blockerDetail || helperText;
  const catalogDetail = showDescription ? getServiceDescription(item.id) : "";
  const detail = stateDetail || catalogDetail;
  const casVisible = active && !removalRequested && casEligible;
  // Faza 3: filtrele de verificare ("Oferta selectata", "Observatii") se aplica aici,
  // din props. Inainte invelisul scana DOM-ul si scria data-service-filter-visible.
  const blocked = active && prerequisite?.eligible === false;
  const filterVisible = filter === "all"
    || (filter === "selected" && active)
    || (filter === "issues" && blocked);
  return (
    <div
      data-service-filter-visible={filterVisible ? "true" : "false"}
      className={`services-row relative border-b border-border/50 transition last:border-b-0 ${removalRequested ? "bg-[#efd5c5]" : "bg-transparent"}`}
    >
    <button
      type="button"
      data-service-key={item.id}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(item, unitKey)}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"} ${removalRequested ? "hover:bg-[#efd5c5]" : active ? "" : "hover:bg-card/60"}`}
    >
      {/* Bifa. Cerneala plina = ales, contur = neales, portocaliul de atentie = se
          elimina la trimitere. Aceleasi trei stari ca in restul modulului. */}
      <span
        aria-hidden="true"
        className={`mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border transition-colors ${removalRequested ? "border-[#e1bda8] bg-[#efd5c5]" : active ? "border-foreground bg-foreground" : "border-foreground/25 bg-background"}`}
      >
        {active && !removalRequested && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
        {removalRequested && <span className="h-[2px] w-[9px] rounded-full bg-black/45" />}
      </span>
      <span className="min-w-0">
        <span className={`services-row__title block font-semibold leading-snug text-foreground ${compact ? "text-[13.5px]" : "text-sm"}`}>{serviceLabel(item)}</span>
        {detail && <span className="services-row__detail mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
          {!removalRequested && <StatusBadge prerequisite={prerequisite} />}
        </span>
      </span>
    </button>
    {/* CAS ramane un rand secundar, indentat sub serviciul pe care il insoteste. */}
    {casVisible && (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={casActive}
        onClick={() => onToggleCas?.(item.id)}
        className={`services-cas-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border/40 text-left transition hover:bg-card/60 disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "px-3 py-2 pl-9" : "px-4 py-2.5 pl-10"}`}
      >
        <span className="text-[11px] font-semibold text-muted-foreground">Decontat prin CAS</span>
        <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors ${casActive ? "border-foreground bg-foreground" : "border-border bg-background"}`}>
          {casActive && <Check className="h-2.5 w-2.5 text-background" />}
        </span>
      </button>
    )}
    </div>
  );
}
