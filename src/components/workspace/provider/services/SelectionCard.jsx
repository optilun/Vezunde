// Faza 2: cardul de selectie folosit pentru zone, activitati si atribute de locatie.
// variant="square" adaugat 2026-08-18, doar pentru grila de spatii (UnitPicker) - restul
// picker-elor (dotari, atribute) raman pe varianta implicita, pe randuri.
import React from "react";
import { Check, Info, X } from "lucide-react";
import { ChangeBadge } from "./ServiceBadges";

export default function SelectionCard({ active, approved = false, title, description, helper, icon: Icon, disabled, onClick, variant = "row", tone = null, badge = "" }) {
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  // Id stabil pentru aria-describedby (2026-08-23): butonul cardului nu poate avea un
  // descendent cu tabindex - specificatia HTML interzice explicit asta pentru <button>,
  // la fel ca butonul-in-buton. Descrierea ramane deci accesibila prin aria-describedby
  // (cititoarele de ecran o anunta la focus), iar "i"-ul vizibil e doar decorativ.
  const descriptionId = React.useId();
  // Tonul categoriei pe placa iconitei (2026-08-23). Regula modulului spune ca fondul
  // cardului inseamna DOAR stare; placa de 40x40 e altceva - spune din ce familie face
  // parte spatiul, si leaga cardul de randul din coloana din stanga si de simbolul din
  // antetul grupului. Cand cardul e propus spre eliminare, tonul cedeaza locul
  // portocaliului de atentie: acolo starea are prioritate.
  const toneStyle = tone && !removalRequested
    ? { "--card-tone": tone.bg, "--card-tone-border": tone.border }
    : undefined;
  const toneAttr = tone && !removalRequested ? "true" : undefined;

  if (variant === "square") {
    return (
      <button
        type="button"
        aria-pressed={active}
        data-selection-state={removalRequested ? "removal" : active ? "on" : "off"}
        disabled={disabled}
        onClick={onClick}
        aria-describedby={description ? descriptionId : undefined}
        className={`services-card services-card--square relative flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-[#e1bda8] bg-[#efd5c5]" : active ? "border-[#ccd2ba] bg-[#dfe3d2]" : "border-border bg-card hover:bg-secondary/25"}`}
      >
        <span className={`services-card__check absolute right-3 top-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${removalRequested ? "border-[#e1bda8] bg-[#efd5c5] text-black/70" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
          {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
        </span>
        <span data-tone={toneAttr} style={toneStyle} className={`services-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-[#efd5c5] text-black/70" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="block text-sm font-semibold leading-snug text-foreground">{title}</span>
            {/* Descrierea sta sub un "i", nu mereu deschisa (2026-08-23, la cererea lui
                Alex): pe un card de 40x40 cu titlu, insigna si contor, doua randuri de
                text explicativ ingreunau cardul mai mult decat lamureau.
                "i"-ul de aici e strict decorativ (fara tabindex): specificatia HTML nu
                permite un descendent cu tabindex in interiorul unui <button> - acelasi
                motiv pentru care CAS nu sta in interiorul butonului de serviciu. Textul
                ramane accesibil real prin aria-describedby pe butonul cardului, citit de
                cititoarele de ecran la focus; "i"-ul cu tooltip e doar pentru soarece. */}
            {description && (
              <span
                aria-hidden="true"
                onClick={(event) => event.stopPropagation()}
                className="services-card__info group relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-48 -translate-x-1/2 rounded-lg border border-border bg-foreground px-2.5 py-2 text-[11px] font-normal leading-relaxed text-background opacity-0 shadow-lg transition group-hover:opacity-100">
                  {description}
                </span>
              </span>
            )}
            {description && <span id={descriptionId} className="sr-only">{description}</span>}
          </span>
        </span>
        {/* Recomandarea e o pastila, contorul ramane text (2026-08-23): pana acum
            "8 optiuni asociate" (fapt) si "Optional" (recomandare) stateau in acelasi
            loc, in aceeasi culoare, desi sunt lucruri diferite. */}
        {badge && <span className="services-card__badge">{badge}</span>}
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {helper && <span className="text-[10px] font-medium text-muted-foreground">{helper}</span>}
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      data-selection-state={removalRequested ? "removal" : active ? "on" : "off"}
      disabled={disabled}
      onClick={onClick}
      className={`services-card flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-[#e1bda8] bg-[#efd5c5]" : active ? "border-[#ccd2ba] bg-[#dfe3d2]" : "border-border bg-card hover:bg-secondary/25"}`}
    >
      <span data-tone={toneAttr} style={toneStyle} className={`services-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-[#efd5c5] text-black/70" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm font-semibold leading-snug text-foreground">{title}</span>
          {/* BIFA, nu comutator (2026-08-23). Pe 2026-08-18 aici s-a pus comutator tocmai
              "pentru consecventa cu serviciile"; intre timp serviciile au trecut pe bifa,
              deci argumentul s-a inversat si comutatorul ramasese singurul din modul.
              Regula, confirmata de cercetare (NN/g, IBM Carbon): comutatorul inseamna
              efect imediat; ce se confirma printr-un buton de salvare se bifeaza. */}
          <span
            aria-hidden="true"
            className={`services-card__check mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${removalRequested ? "border-[#e1bda8] bg-[#efd5c5] text-black/70" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
          >
            {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
          </span>
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {helper && <span className="text-[10px] font-semibold text-muted-foreground">{helper}</span>}
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        </span>
      </span>
    </button>
  );
}
