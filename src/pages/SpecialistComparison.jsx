import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus } from "lucide-react";
import {
  Breadcrumbs,
  GuideCanvas,
  GuideNote,
  PrimaryCta,
} from "@/components/guides/GuideCanvas";
import { GUIDE_ORDER, SPECIALIST_GUIDES } from "@/data/specialistGuides";

const ROWS = [
  {
    label: "Realizează și adaptează ochelari",
    values: [true, "în funcție de serviciu", false],
  },
  {
    label: "Evaluează funcția vizuală și corecția optică",
    values: [false, true, true],
  },
  {
    label: "Stabilește diagnostic medical",
    values: [false, false, true],
  },
  {
    label: "Prescrie tratament pentru boli de ochi",
    values: [false, false, true],
  },
];

function Value({ value }) {
  if (value === true) return <Check className="h-5 w-5" aria-label="Da" />;
  if (value === false) return <Minus className="h-5 w-5 text-[#8a847c]" aria-label="Nu" />;
  return <span className="text-xs leading-4 text-[#5f5a53]">{value}</span>;
}

export default function SpecialistComparison() {
  return (
    <GuideCanvas>
      <Breadcrumbs current="Compară specialiștii" />

      <header className="mt-10 border-t-[3px] border-[#171717] pt-7">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6f6a63] sm:text-xs">
          Ghid comparativ · Răspuns direct
        </p>
        <h1 className="mt-6 max-w-6xl font-heading text-[clamp(3.2rem,8vw,8rem)] font-extrabold leading-[0.86] tracking-[-0.075em]">
          Optician, optometrist
          <span className="block font-display font-medium italic text-[#735c80]">
            sau oftalmolog?
          </span>
        </h1>
        <p className="mt-8 max-w-3xl text-lg leading-8 text-[#514d47] sm:text-xl">
          Alegerea depinde de ce ai nevoie: ochelari și reglaje, evaluarea vederii ori consultație, diagnostic și tratament medical.
        </p>
      </header>

      <section aria-labelledby="alegere-rapida" className="mt-16 sm:mt-24">
        <h2 id="alegere-rapida" className="sr-only">Alegere rapidă</h2>
        <div className="grid border-y-[3px] border-[#171717] lg:grid-cols-3">
          {GUIDE_ORDER.map((slug, index) => {
            const guide = SPECIALIST_GUIDES[slug];
            return (
              <div key={slug} className={`p-6 sm:p-8 lg:min-h-[31rem] ${index ? "border-t border-[#171717] lg:border-l lg:border-t-0" : ""}`} style={{ backgroundColor: guide.tint }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.18em]">{guide.number}</span>
                  <span className="h-3 w-3 bg-[#171717]" aria-hidden="true" />
                </div>
                <h3 className="mt-14 text-[clamp(2.2rem,4vw,4rem)] font-extrabold leading-[0.92] tracking-[-0.06em]">
                  {guide.name}
                </h3>
                <p className="mt-6 text-base font-semibold leading-7">{guide.shortAnswer}</p>
                <Link to={`/ghid/${slug}`} className="mt-8 inline-flex min-h-11 items-center gap-3 text-sm font-semibold underline decoration-[#171717]/30 underline-offset-4">
                  Vezi ghidul complet <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="comparatie" className="mt-20 sm:mt-28">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
          Comparație
        </p>
        <h2 id="comparatie" className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">
          Diferențele esențiale
        </h2>
        <div className="mt-8 overflow-x-auto border-y-[3px] border-[#171717]">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="w-[34%] p-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6a63]">Activitate</th>
                {GUIDE_ORDER.map((slug) => (
                  <th key={slug} scope="col" className="border-l border-[#171717]/30 p-5 text-sm font-extrabold">
                    {SPECIALIST_GUIDES[slug].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-[#171717]/30">
                  <th scope="row" className="p-5 text-sm font-semibold sm:text-base">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.label}-${GUIDE_ORDER[index]}`} className="border-l border-[#171717]/30 p-5">
                      <Value value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-20 grid gap-8 rounded-[2rem] bg-[#171717] p-7 text-[#f8f4ec] sm:mt-28 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center lg:p-16">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Nu ești sigur?
          </p>
          <h2 className="mt-4 max-w-3xl text-[clamp(2.4rem,5vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.06em]">
            Spune ce ai nevoie. Te ajutăm să alegi.
          </h2>
        </div>
        <div className="[&_a]:bg-[#f8f4ec] [&_a]:text-[#171717] [&_a_span]:bg-[#171717] [&_a_span]:text-white">
          <PrimaryCta to="/cerere">Trimite o cerere</PrimaryCta>
        </div>
      </section>

      <footer className="mt-12 flex flex-col gap-5 border-t border-[#171717]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <GuideNote />
        <Link to="/cum-verificam-informatiile" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
          Cum verificăm informațiile
        </Link>
      </footer>
    </GuideCanvas>
  );
}
