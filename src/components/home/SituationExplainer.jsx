import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const ROLES = [
  {
    number: "01",
    term: "optician medical",
    termSize: "text-[clamp(3.35rem,6.5vw,6.5rem)]",
    type: "/ specialist tehnic / ochelari si dispozitive optice",
    navDescription: "ochelari, reglaje si reparatii",
    definition:
      "Interpreteaza prescriptia optica si realizeaza, monteaza, verifica, adapteaza si intretine ochelarii, astfel incat lentilele si rama sa ofere corectia si confortul prevazute.",
    example:
      "„Am o prescriptie si vreau ochelari noi, lentile noi, un reglaj sau o reparatie.”",
    difference:
      "Nu efectueaza consultatii medicale si nu diagnosticheaza ori trateaza afectiuni oculare.",
    cta: "Gaseste o optica",
    to: "/cerere?categorie=reparatii",
    accent: "#a97825",
  },
  {
    number: "02",
    term: "optometrist",
    termSize: "text-[clamp(3.35rem,8vw,7.5rem)]",
    type: "/ specialist in evaluarea functiei vizuale /",
    navDescription: "evaluarea vederii si corectie optica",
    definition:
      "Evalueaza functia vizuala prin masuratori optometrice, determina corectia optica si recomanda solutii pentru vedere; cand este necesara o evaluare medicala, te indruma catre medicul oftalmolog.",
    example:
      "„Vreau sa-mi verific vederea, dioptriile sau adaptarea la ochelari ori lentile de contact.”",
    difference:
      "Nu este medic, iar evaluarea optometrica nu inlocuieste consultatia, diagnosticul sau tratamentul oftalmologic.",
    cta: "Gaseste un optometrist",
    to: "/cerere?categorie=control_vedere",
    accent: "#345bc8",
  },
  {
    number: "03",
    term: "medic oftalmolog",
    termSize: "text-[clamp(3.25rem,6vw,5.8rem)]",
    type: "/ medic specialist / sanatatea ochilor",
    navDescription: "diagnostic si tratament",
    definition:
      "Efectueaza consultatia medicala oftalmologica, diagnosticheaza si trateaza afectiunile ochilor si indica, atunci cand este necesar, investigatii, medicamente, proceduri sau interventii chirurgicale.",
    example:
      "„Am durere, roseata, vedere scazuta, un simptom nou sau vreau sa verific sanatatea ochilor.”",
    difference:
      "Este singurul dintre aceste trei roluri care stabileste un diagnostic medical si indica tratamentul unei afectiuni oculare.",
    cta: "Gaseste un medic oftalmolog",
    to: "/cerere?categorie=consult_oftalmologic",
    accent: "#735c80",
  },
];

function RoleMark({ color }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.35rem] shadow-[0_8px_20px_rgba(25,25,25,0.08)]"
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 40 40" className="h-5 w-5 text-[#f8f4ec]" fill="currentColor">
        <rect x="17" y="3" width="6" height="34" rx="2" />
        <rect x="3" y="17" width="34" height="6" rx="2" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(45 20 20)" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(135 20 20)" />
        <rect x="16" y="16" width="8" height="8" rx="1.5" fill={color} />
      </svg>
    </span>
  );
}

export default function SituationExplainer() {
  const [active, setActive] = useState(1);
  const prefersReducedMotion = useReducedMotion();
  const current = ROLES[active];

  const activateFromKeyboard = (event, index) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const next = (index + direction + ROLES.length) % ROLES.length;
    setActive(next);
    requestAnimationFrame(() => {
      document.getElementById(`role-index-${next}`)?.focus();
    });
  };

  return (
    <section
      aria-labelledby="specialist-guide-title"
      className="mx-auto mt-24 max-w-[84rem] px-5 sm:mt-32 lg:mt-36"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.55 }}
      >
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75 sm:text-[11px]">
          Ghid VIASEE · Cine te poate ajuta
        </p>

        <div className="mt-7 grid gap-8 lg:grid-cols-[0.78fr_2.22fr] lg:items-end lg:gap-10">
          <h2
            id="specialist-guide-title"
            className="font-heading text-2xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-3xl"
          >
            Nu stii la cine sa mergi?
            <span className="mt-1 block font-display text-[1.08em] font-medium italic text-muted-foreground/60">
              Nu trebuie sa stii.
            </span>
          </h2>

          <div
            role="tablist"
            aria-label="Alege profesionistul"
            className="grid grid-cols-3 border-y border-black/15 lg:border-y-0"
          >
            {ROLES.map((role, index) => {
              const selected = active === index;

              return (
                <button
                  key={role.term}
                  type="button"
                  role="tab"
                  id={`role-index-${index}`}
                  aria-controls="role-definition"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => activateFromKeyboard(event, index)}
                  className={`relative min-h-[6.75rem] border-l border-black/20 px-3 py-4 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] sm:px-5 lg:min-h-[5.75rem] lg:py-2 ${
                    selected ? "text-foreground" : "text-muted-foreground/[0.58] hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {selected && <RoleMark color={role.accent} />}
                    <span className="font-mono text-[10px] tracking-[0.16em] sm:text-xs">
                      {role.number}
                    </span>
                  </span>
                  <span className="mt-3 block font-heading text-sm font-bold leading-tight tracking-[-0.025em] sm:text-lg lg:text-xl">
                    {role.term.charAt(0).toUpperCase() + role.term.slice(1)}
                  </span>
                  <span className="mt-1 hidden text-xs leading-tight text-muted-foreground xl:block">
                    {role.navDescription}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 -bottom-px h-[3px] origin-left transition-transform duration-300 sm:inset-x-5 ${
                      selected ? "scale-x-100" : "scale-x-0"
                    }`}
                    style={{ backgroundColor: role.accent }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={active}
            id="role-definition"
            role="tabpanel"
            aria-labelledby={`role-index-${active}`}
            aria-live="polite"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
            className="mt-12 sm:mt-14"
          >
            <div className="flex flex-col gap-5 pb-7 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <h3
                className={`${current.termSize} min-w-0 font-heading font-extrabold leading-[0.82] tracking-[-0.075em] text-[#171717]`}
              >
                {current.term}
              </h3>
              <p className="max-w-xl pb-1 font-heading text-lg font-bold leading-tight tracking-[-0.025em] text-foreground/85 sm:text-xl lg:text-right xl:text-2xl">
                {current.type}
              </p>
            </div>

            <div className="grid gap-5 border-y-[4px] border-[#171717] py-7 sm:py-9 lg:grid-cols-[7rem_1fr] lg:items-start lg:gap-10">
              <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#171717] sm:h-[5.25rem] sm:w-[5.25rem]">
                <ArrowRight className="h-7 w-7 sm:h-9 sm:w-9" aria-hidden="true" />
              </span>
              <p className="max-w-[70rem] font-heading text-[clamp(2rem,4.35vw,4.15rem)] font-bold leading-[1.04] tracking-[-0.055em] text-[#171717]">
                {current.definition}
              </p>
            </div>

            <div className="grid border-b-[3px] border-[#171717] lg:grid-cols-2">
              <div className="py-7 lg:border-r lg:border-black/25 lg:py-9 lg:pr-12">
                <p className="font-heading text-base font-semibold tracking-[-0.02em] text-foreground/75 sm:text-lg">
                  Mergi cand
                </p>
                <p className="mt-4 max-w-[38rem] font-heading text-[clamp(2rem,3.45vw,3.45rem)] font-semibold leading-[1.06] tracking-[-0.05em] text-[#171717]">
                  {current.example}
                </p>
              </div>

              <div className="border-t border-black/25 py-7 lg:border-t-0 lg:py-9 lg:pl-12">
                <p className="font-heading text-base font-semibold tracking-[-0.02em] text-foreground/75 sm:text-lg">
                  Diferenta importanta
                </p>
                <p className="mt-4 max-w-[39rem] font-heading text-[clamp(1.8rem,3.1vw,3.1rem)] font-semibold leading-[1.07] tracking-[-0.045em] text-[#171717]">
                  {current.difference}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <Link
                to={current.to}
                className="group inline-flex min-h-14 items-center gap-7 rounded-full bg-[#171717] py-2 pl-7 pr-2 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(18,18,18,0.12)] outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(18,18,18,0.17)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:min-h-16 sm:pl-9 sm:text-base"
              >
                {current.cta}
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F4EC] text-[#171717] sm:h-12 sm:w-12">
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>

              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground sm:text-sm">
                <RoleMark color={current.accent} />
                <span>
                  Competentele pot varia in functie de calificare si autorizare. VIASEE ofera orientare, nu diagnostic.
                </span>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
