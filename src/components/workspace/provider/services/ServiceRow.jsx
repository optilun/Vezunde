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
//
// 2026-08-23 (a doua trecere, tot la cererea lui Alex): pastila CAS s-a mutat DE PE
// randul de dedesubt PE randul serviciului, in dreapta. Cardul de grup a incercat
// pentru asta o singura coloana, dar Alex a cerut inapoi la doua (se citea mai bine) -
// deci coloanele au ramas late (minmax 280px in ProviderServicesTheme.css), suficient
// cat pastila sa incapa langa eticheta fara sa mai fie nevoie de un rand intreg.
// Randul de aici e acum <div flex> cu doua elemente FRATE - butonul de bifare si
// (cand e vizibila) pastila CAS - nu buton in buton, ceea ce ar fi HTML invalid si
// ar sparge click-ul.
import React from "react";
import { Check } from "lucide-react";
import { getServiceDescription } from "../../../../../shared/serviceDescriptions.js";
import { ChangeBadge, StatusBadge } from "./ServiceBadges";
import { isSelected, serviceLabel } from "./servicesConfigModel";

export default function ServiceRow({ item, selected, approvedSelected, prerequisite, unitKey, disabled, helperText = "", onToggle, casActive = false, casEligible = false, onToggleCas, filter = "all", showDescription = true, compact = false, reviewState = {} }) {
  const active = isSelected(selected, item);
  const approved = isSelected(approvedSelected, item);
  // Trei straturi, de cand se poate edita in paralel cu verificarea (2026-08-23): aprobat,
  // trimis spre aprobare, in lucru. Randul nu primeste a doua harta de selectie, ci doar
  // DIFERENTA celui trimis fata de aprobat - din ea reconstruieste starea trimisa. Cand nu
  // exista nicio cerere in verificare harta e goala, starea trimisa cade peste cea aprobata
  // si tot ce urmeaza se comporta exact ca inainte.
  const review = reviewState[item.id] || "";
  const submitted = review === "added" ? true : review === "removed" ? false : approved;
  // Marcajele de draft se raporteaza la ce s-a TRIMIS, nu la ce e aprobat: altfel un element
  // aflat in verificare ar aparea vesnic drept "nou in draft", desi a plecat deja.
  const removalRequested = submitted && !active;
  const draftAddition = active && !submitted;
  // Neatins de la trimitere => e chiar ce asteapta decizia adminului.
  const inReview = review && active === submitted ? review : "";
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
    // Filtrul "changes" lipsea de aici (corectat 2026-08-23, in aceeasi zi in care a fost
    // adaugat): UnitAccordion filtra sectiunile, dar randul isi decide singur vizibilitatea
    // prin data-service-filter-visible, iar CSS-ul ascunde ce e "false" - deci ecranul ar fi
    // ramas gol. Se raporteaza la starea APROBATA, ca si placa "in draft" din Verificare:
    // acolo numarul inseamna "tot ce nu e inca publicat", trimis sau nu.
    || (filter === "changes" && active !== approved)
    || (filter === "issues" && blocked);
  return (
    <div
      data-service-filter-visible={filterVisible ? "true" : "false"}
      className={`services-row relative flex items-center border-b border-border/50 transition last:border-b-0 ${removalRequested ? "bg-[#efd5c5]" : "bg-transparent"}`}
    >
    <button
      type="button"
      data-service-key={item.id}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(item, unitKey)}
      className={`grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"} ${removalRequested ? "hover:bg-[#efd5c5]" : active ? "" : "hover:bg-card/60"}`}
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
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} inReview={inReview} />
          {!removalRequested && <StatusBadge prerequisite={prerequisite} />}
        </span>
      </span>
    </button>
    {/* DECONTAREA CAS: eticheta pe randul serviciului, nu pe un rand propriu.
        Ramane o pastila, nu o bifa - nu e o actiune de acelasi rang cu serviciul, e o
        insusire a lui. Dar sta acum LANGA eticheta (frate cu butonul de bifare, nu
        continut in el), in dreapta randului. */}
    {casVisible && (
      <div className={`services-cas-slot shrink-0 ${compact ? "pr-3" : "pr-4"}`}>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={casActive}
          data-on={casActive ? "true" : "false"}
          onClick={() => onToggleCas?.(item.id)}
          className="services-cas-chip"
        >
          {casActive && <Check aria-hidden="true" />}
          Decontat CAS
        </button>
      </div>
    )}
    </div>
  );
}
