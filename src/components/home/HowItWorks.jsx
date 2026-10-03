import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import { prefetchOnIntent } from "@/lib/routePrefetch";
import { softGlowBackground } from "@/lib/softGlow";

const STEPS = [
  {
    number: "01",
    title: "Spui ce cauți",
    description: "Descrie ce ai nevoie, în cuvintele tale.",
    kind: "input",
    accent: "#345bc8",
    tone: "bg-[#f0f2ee]",
    glow: softGlowBackground("169 198 215", 0.10),
  },
  {
    number: "02",
    title: "Răspunzi pe scurt",
    description: "Alegi pentru cine cauți și în ce zonă.",
    kind: "choices",
    accent: "#a97825",
    tone: "bg-[#f5f0e5]",
    glow: softGlowBackground("211 181 101", 0.09),
  },
  {
    number: "03",
    title: "Compari opțiunile",
    description: "Vezi serviciile, adresa și datele de contact.",
    kind: "results",
    accent: "#735c80",
    tone: "bg-[#f3eff2]",
    glow: softGlowBackground("190 169 200", 0.09),
  },
];

const RESULT_PRINCIPLES = [
  {
    number: "01",
    title: "Rezultate potrivite",
    description:
      "Ține cont de ce ai căutat și de zona ta, ca să nu pierzi timpul cu rezultate care nu se potrivesc.",
  },
  {
    number: "02",
    title: "Detalii despre locație",
    description:
      "Vezi ce servicii oferă, adresa, datele de contact și dacă profilul a fost verificat.",
  },
  {
    number: "03",
    title: "Decizia rămâne a ta",
    description:
      "Compari informațiile disponibile și alegi ce ți se potrivește, în ritmul tău.",
  },
];

function StepGraphic({ kind, accent }) {
  if (kind === "input") {
    return (
      <svg viewBox="0 0 320 170" className="h-full w-full" fill="none" aria-hidden="true" focusable="false">
        <path d="M28 37H292M28 133H292M28 37V49M292 37V49M28 121V133M292 121V133" stroke="#171717" strokeOpacity=".18" />
        <rect x="40" y="55" width="240" height="68" rx="9" fill="#171717" fillOpacity=".04" />
        <rect x="40" y="51" width="240" height="68" rx="9" fill="#fffdf8" stroke="#171717" strokeOpacity=".20" />
        <text x="56" y="73" fill="#77736b" fontSize="10" fontFamily="Arial, sans-serif">Spune-ne ce cauți</text>
        <text x="56" y="96" fill="#171717" fontSize="14" fontFamily="Arial, sans-serif">Control de vedere</text>
        <circle cx="253" cy="85" r="15" fill={accent} />
        <path d="M247 85H259M254 80L259 85L254 90" stroke="#fffdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "choices") {
    return (
      <svg viewBox="0 0 320 170" className="h-full w-full" fill="none" aria-hidden="true" focusable="false">
        <path d="M48 24V146M38 24H58M38 146H58" stroke="#171717" strokeOpacity=".20" />
        {["Pentru mine", "Control de vedere", "În apropiere"].map((label, index) => {
          const y = 45 + index * 40;
          const selected = index === 1;
          return (
            <g key={label}>
              <rect x="64" y={y - 15} width="210" height="30" rx="6" fill={selected ? accent : "#fffdf8"} stroke="#171717" strokeOpacity={selected ? ".06" : ".18"} />
              <circle cx="48" cy={y} r="6" fill={selected ? accent : "#fffdf8"} stroke={selected ? accent : "#79766e"} strokeWidth="1.5" />
              {selected && <path d={`M45 ${y}L47 ${y + 2}L51 ${y - 2}`} stroke="#fffdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
              <text x="78" y={y + 4} fill={selected ? "#fffdf8" : "#484640"} fontSize="12" fontFamily="Arial, sans-serif">{label}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 170" className="h-full w-full" fill="none" aria-hidden="true" focusable="false">
      <circle cx="67" cy="85" r="35" stroke="#171717" strokeOpacity=".14" />
      <path d="M21 85H113M67 39V131" stroke="#171717" strokeOpacity=".14" />
      <path d="M67 109S46 88 46 73A21 21 0 0 1 88 73C88 88 67 109 67 109Z" fill={accent} />
      <circle cx="67" cy="73" r="7" fill="#fffdf8" />
      <path d="M103 85H126" stroke="#171717" strokeOpacity=".45" />
      <rect x="111" y="82" width="6" height="6" fill="#171717" />
      <rect x="126" y="45" width="166" height="88" rx="9" fill="#171717" fillOpacity=".04" />
      <rect x="126" y="41" width="166" height="88" rx="9" fill="#fffdf8" stroke="#171717" strokeOpacity=".20" />
      <rect x="139" y="55" width="26" height="26" rx="5" fill={accent} fillOpacity=".12" />
      <path d="M147 73V62H157V73M144 73H160M150 65H154M150 68H154" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="174" y="65" fill="#171717" fontSize="11" fontFamily="Arial, sans-serif">Optică medicală</text>
      <text x="174" y="79" fill="#77736b" fontSize="9" fontFamily="Arial, sans-serif">Servicii pentru vedere</text>
      <path d="M139 92H279" stroke="#171717" strokeOpacity=".12" />
      <text x="139" y="112" fill="#646159" fontSize="11" fontFamily="Arial, sans-serif">Adresă · Contact</text>
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-viasee-works-title"
      className="mx-auto mt-16 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      <Reveal className="grid gap-8 lg:grid-cols-[1.55fr_0.75fr] lg:items-end lg:gap-16">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/70 sm:text-[11px]">
            Cum funcționează
          </p>
          <h2
            id="how-viasee-works-title"
            className="mt-5 max-w-[58rem] font-heading text-[2rem] sm:text-[clamp(2.7rem,5.8vw,5.7rem)] font-extrabold leading-[0.94] tracking-[-0.065em] text-[#171717]"
          >
            <span className="sm:hidden">Un specialist,<br />în trei pași.</span>
            <span className="hidden sm:inline">De la ce cauți</span>
            <span className="hidden sm:block">la unde poți merge.</span>
          </h2>
        </div>

        <div className="hidden sm:block lg:pb-1">
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Totul pornește de la o descriere simplă a ceea ce cauți. Pe baza câtorva întrebări scurte, ajungi la o listă cu cabinetele, clinicile și opticile din zona ta care se potrivesc. Este un ghid de orientare — nu un diagnostic și nu o consultație medicală.
          </p>
          <Link
            to="/cerere"
            {...prefetchOnIntent("/cerere")}
            className="group mt-6 inline-flex min-h-14 items-center gap-6 rounded-full bg-[#171717] py-2 pl-7 pr-2 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(18,18,18,0.12)] outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(18,18,18,0.17)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:text-base"
          >
            Începe căutarea
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F4EC] text-[#171717]">
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </Reveal>

      <div className="mt-6 sm:hidden">
        <div className="grid gap-3">
          {STEPS.map((step) => (
            <article key={step.number} className={"flex min-h-28 items-center gap-3 overflow-hidden rounded-xl border border-black/[0.12] p-4 shadow-[0_2px_3px_rgba(28,24,18,0.025),0_6px_16px_rgba(28,24,18,0.04)] " + step.tone}>
              <span className="self-start pt-1 font-mono text-[10px] font-semibold text-foreground/60">{step.number}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-lg font-bold leading-tight">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/65">{step.description}</p>
              </div>
              <div className="h-20 w-24 shrink-0"><StepGraphic kind={step.kind} accent={step.accent} /></div>
            </article>
          ))}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">Servicii · Adrese · Contact · Statusul profilului</p>
        <Link to="/cerere" {...prefetchOnIntent("/cerere")} className="mt-5 flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#171717] px-6 text-sm font-semibold text-white">
          Începe căutarea<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-10 hidden sm:mt-12 sm:block">
        <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
          {STEPS.map((step, index) => (
            <Reveal
              as="article"
              key={step.number}
              delay={index * 70}
              className="relative h-full"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[148px] -z-10 opacity-30"
                style={{ backgroundImage: step.glow }}
              />
              <div className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-black/[0.12] shadow-[0_2px_3px_rgba(28,24,18,0.025),0_8px_20px_rgba(28,24,18,0.04)] ${step.tone}`}>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: "url('/images/home/viasee-technical-grain.svg')",
                    backgroundSize: "180px 180px",
                  }}
                />
                <div className="relative flex items-center justify-between border-b border-black/[0.08] px-5 py-4 lg:px-6">
                  <span className="font-mono text-xs font-semibold tracking-[0.18em] text-foreground/65">
                    {step.number}
                  </span>
                  <span className="h-2.5 w-2.5" style={{ backgroundColor: step.accent }} aria-hidden="true" />
                </div>
                <div className="relative h-40 border-b border-black/[0.08] px-3 py-2 lg:h-44 lg:px-4">
                  <StepGraphic kind={step.kind} accent={step.accent} />
                </div>
                <div className="relative flex-1 px-5 py-6 lg:px-6">
                  <h3 className="font-heading text-2xl font-extrabold leading-[1.1] tracking-[-0.04em] text-[#171717] lg:text-[1.75rem]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/65 lg:text-base">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal className="mt-24 hidden border-y-[3px] border-[#171717] sm:mt-28 sm:block">
        <div className="grid lg:grid-cols-[1.1fr_2fr]">
          <div className="border-b border-black/20 px-1 py-7 lg:border-b-0 lg:border-r lg:px-0 lg:py-9 lg:pr-10">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/65 sm:text-[11px]">
              Ce vezi în rezultate
            </p>
            <h3 className="mt-3 max-w-sm font-heading text-2xl font-extrabold leading-tight tracking-[-0.035em] sm:text-3xl">
              Informații clare, ca să alegi cu încredere.
            </h3>
          </div>

          <div className="grid sm:grid-cols-3">
            {RESULT_PRINCIPLES.map((item, index) => (
              <div
                key={item.number}
                className={`px-1 py-7 sm:px-6 sm:py-9 ${index > 0 ? "border-t border-black/20 sm:border-l sm:border-t-0" : ""}`}
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                  {item.number}
                </span>
                <h4 className="mt-3 font-heading text-lg font-bold leading-tight tracking-[-0.025em]">
                  {item.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </Reveal>
    </section>
  );
}
