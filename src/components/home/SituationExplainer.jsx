import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const ROLES = [
  {
    number: "01",
    term: "optician",
    type: "substantiv · specialist tehnic",
    short: "ochelari, rame si reparatii",
    definition:
      "Specialistul care realizeaza, monteaza, ajusteaza si repara ochelarii pe baza unei prescriptii sau a unei recomandari de corectie.",
    helps: ["Rame si lentile", "Montaj si centrare", "Reglaje", "Reparatii"],
    boundaryTitle: "Nu inlocuieste",
    boundary:
      "Consultul medical, diagnosticul sau tratamentul unei afectiuni oculare.",
    cta: "Gaseste o optica",
    to: "/cerere?categorie=reparatii",
    accent: "#9a6a22",
    tabActive: "border-[#d6bd8b] bg-[#eadcba]/65",
    cardTone: "border-[#ded0ad] bg-[#fffaf0]/82",
    badgeTone: "border-[#d6bd8b] bg-[#eadcba]/60 text-[#75501b]",
  },
  {
    number: "02",
    term: "optometrist",
    type: "substantiv · specialist in evaluarea vederii",
    short: "evaluarea vederii si corectia optica",
    definition:
      "Evalueaza functia vizuala, masoara acuitatea si refractia si determina corectia optica necesara pentru ochelari sau lentile de contact.",
    helps: ["Control de vedere", "Dioptrii", "Ochelari", "Lentile de contact"],
    boundaryTitle: "Important",
    boundary:
      "Nu este medic si nu trateaza boli oculare. Cand observa semne care necesita evaluare medicala, te indruma catre medicul oftalmolog.",
    cta: "Cauta un control de vedere",
    to: "/cerere?categorie=control_vedere",
    accent: "#48738a",
    tabActive: "border-[#b7ccd6] bg-[#dce5e9]/72",
    cardTone: "border-[#c3d3da] bg-[#f7fbfc]/82",
    badgeTone: "border-[#b7ccd6] bg-[#dce5e9]/70 text-[#365c70]",
  },
  {
    number: "03",
    term: "medic oftalmolog",
    type: "substantiv · medic specialist",
    short: "diagnostic si tratament medical",
    definition:
      "Medicul care examineaza ochii, diagnosticheaza si trateaza afectiunile oculare. Poate recomanda investigatii, prescrie tratament si efectua proceduri sau interventii in limitele competentei sale.",
    helps: ["Simptome oculare", "Afectiuni", "Consultatii pentru copii", "Investigatii si tratament"],
    boundaryTitle: "Alege direct medicul pentru",
    boundary:
      "Durere, roseata persistenta, vedere scazuta brusc, traumatism sau orice simptom care te ingrijoreaza.",
    cta: "Gaseste un medic oftalmolog",
    to: "/cerere?categorie=consult_oftalmologic",
    accent: "#735c80",
    tabActive: "border-[#cec0d3] bg-[#e8e0ea]/72",
    cardTone: "border-[#d7cadb] bg-[#fcf9fd]/82",
    badgeTone: "border-[#cec0d3] bg-[#e8e0ea]/70 text-[#624f6e]",
  },
];

export default function SituationExplainer() {
  const [active, setActive] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const current = ROLES[active];

  return (
    <section
      aria-labelledby="specialist-guide-title"
      className="mx-auto mt-32 max-w-6xl px-5 sm:mt-44"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6 }}
      >
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70 sm:text-[11px]">
          Mic dictionar de vedere
        </p>
        <h2
          id="specialist-guide-title"
          className="mt-4 max-w-2xl font-heading text-3xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl"
        >
          Nu stii la cine sa mergi?
          <br />
          <span className="font-display font-medium italic text-muted-foreground/60">
            Nu trebuie sa stii.
          </span>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Afla simplu ce face fiecare si alege ajutorul potrivit pentru vederea ta.
        </p>
      </motion.div>

      <div className="mt-12 grid items-start gap-7 lg:mt-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 xl:gap-16">
        <div
          role="tablist"
          aria-label="Alege profesionistul"
          className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-2"
        >
          {ROLES.map((role, index) => {
            const selected = active === index;

            return (
              <button
                key={role.term}
                type="button"
                role="tab"
                id={`specialist-tab-${index}`}
                aria-controls="specialist-definition"
                aria-selected={selected}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
                    return;
                  }

                  event.preventDefault();
                  const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
                  const next = (index + direction + ROLES.length) % ROLES.length;
                  setActive(next);
                  requestAnimationFrame(() => {
                    document.getElementById(`specialist-tab-${next}`)?.focus();
                  });
                }}
                className={`group rounded-[1.35rem] border px-5 py-4 text-left outline-none transition-[background-color,border-color,transform] duration-300 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:min-h-[8.5rem] lg:min-h-0 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-5 ${
                  selected
                    ? `${role.tabActive} lg:border-foreground/25 lg:bg-transparent`
                    : "border-black/[0.07] bg-white/20 text-muted-foreground hover:-translate-y-0.5 hover:border-black/15 lg:border-border lg:bg-transparent lg:hover:translate-y-0"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/65">
                    {role.number}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full transition-transform duration-300 ${
                      selected ? "scale-100" : "scale-0"
                    }`}
                    style={{ backgroundColor: role.accent }}
                  />
                </span>
                <span
                  className={`mt-3 block font-display text-[1.7rem] font-semibold italic leading-none tracking-[-0.025em] sm:text-3xl lg:text-[2rem] ${
                    selected ? "text-foreground" : "text-muted-foreground/65"
                  }`}
                >
                  {role.term}
                </span>
                <span className="mt-2 block text-xs leading-snug text-muted-foreground sm:text-sm">
                  {role.short}
                </span>
              </button>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-28">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={active}
              id="specialist-definition"
              role="tabpanel"
              aria-labelledby={`specialist-tab-${active}`}
              aria-live="polite"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
              className={`relative isolate overflow-hidden rounded-[2rem] border p-6 shadow-[0_18px_55px_rgba(35,30,24,0.05)] backdrop-blur-[3px] sm:p-9 lg:p-10 ${current.cardTone}`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-10 -z-10 font-display text-[9rem] font-semibold italic leading-none text-black/[0.035] sm:text-[12rem]"
              >
                {current.number}
              </span>

              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                Ghid VIASEE · definitia {current.number}
              </p>
              <h3 className="mt-5 max-w-[90%] font-display text-[3.2rem] font-semibold italic leading-[0.9] tracking-[-0.045em] text-foreground sm:text-[4.6rem]">
                {current.term}
              </h3>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {current.type}
              </p>

              <div className="mt-7 border-t border-black/[0.09] pt-6">
                <p className="text-base leading-relaxed text-foreground/[0.78] sm:text-lg">
                  {current.definition}
                </p>
              </div>

              <div className="mt-7 grid gap-6 border-t border-black/[0.09] pt-6 sm:grid-cols-[1fr_0.95fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Te ajuta cu
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {current.helps.map((item) => (
                      <span
                        key={item}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${current.badgeTone}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-black/[0.07] bg-white/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {current.boundaryTitle}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                    {current.boundary}
                  </p>
                </div>
              </div>

              <Link
                to={current.to}
                className="group mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold text-white outline-none transition-[gap,transform] hover:-translate-y-0.5 hover:gap-4 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none"
              >
                {current.cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-7 flex items-start gap-3 rounded-[1.25rem] border border-black/[0.07] bg-white/25 px-5 py-4 text-sm leading-relaxed text-muted-foreground sm:mt-9">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          VIASEE ofera orientare, nu diagnostic. Pentru pierderea brusca a vederii,
          traumatism ocular sau durere intensa, solicita asistenta medicala de urgenta.
        </p>
      </div>
    </section>
  );
}
