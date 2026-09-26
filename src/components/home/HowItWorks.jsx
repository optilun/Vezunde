import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import { prefetchOnIntent } from "@/lib/routePrefetch";
import { softGlowBackground } from "@/lib/softGlow";

const STEPS = [
  {
    number: "01",
    title: "Ne spui ce cauți",
    description:
      "Explici cu propriile cuvinte de ce ai nevoie — nu trebuie să știi denumirea exactă a serviciului sau a specialistului.",
    kind: "input",
    accent: "#345bc8",
    tone: "bg-[#dce5e9]",
    glow: softGlowBackground("169 198 215", 0.35),
    placement: "lg:col-span-4 lg:mt-14",
    shape: "rounded-[1.75rem_1.75rem_0.55rem_1.75rem]",
  },
  {
    number: "02",
    title: "Răspunzi la câteva întrebări",
    description:
      "Ne spui pentru cine cauți, ce fel de ajutor ai nevoie și în ce zonă. Durează mai puțin de un minut.",
    kind: "choices",
    accent: "#a97825",
    tone: "bg-[#eadcba]",
    glow: softGlowBackground("211 181 101", 0.32),
    placement: "lg:col-span-3 lg:-mt-3",
    shape: "rounded-[0.55rem_1.75rem_1.75rem_1.75rem]",
  },
  {
    number: "03",
    title: "Vezi unde poți merge",
    description:
      "Primești o listă de opțiuni potrivite din zona ta, pe care le poți compara înainte să alegi.",
    kind: "results",
    accent: "#735c80",
    tone: "bg-[#e8e0ea]",
    glow: softGlowBackground("190 169 200", 0.34),
    placement: "lg:col-span-5 lg:mt-8",
    shape: "rounded-[1.75rem_0.55rem_1.75rem_1.75rem]",
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
      <svg viewBox="0 0 320 170" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M34 36H286M34 134H286" stroke="#171717" strokeOpacity=".18" />
        <rect x="50" y="57" width="220" height="58" rx="18" fill="#F8F4EC" fillOpacity=".72" stroke="#171717" strokeOpacity=".28" />
        <path d="M76 79H205M76 94H168" stroke="#171717" strokeWidth="6" strokeLinecap="round" strokeOpacity=".72" />
        <rect x="236" y="72" width="28" height="28" rx="14" fill={accent} />
        <path d="M245 86H255M251 81L256 86L251 91" stroke="#F8F4EC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 36V50M286 36V50M34 120V134M286 120V134" stroke="#171717" strokeOpacity=".42" />
      </svg>
    );
  }

  if (kind === "choices") {
    return (
      <svg viewBox="0 0 260 170" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M48 28V142" stroke="#171717" strokeOpacity=".24" />
        {[54, 91, 128].map((y, index) => (
          <g key={y}>
            <rect
              x="48"
              y={y - 14}
              width={index === 1 ? 174 : 148}
              height="28"
              rx="14"
              fill={index === 1 ? accent : "#F8F4EC"}
              fillOpacity={index === 1 ? "1" : ".68"}
              stroke="#171717"
              strokeOpacity={index === 1 ? ".08" : ".22"}
            />
            <circle cx="48" cy={y} r="7" fill={index === 1 ? "#171717" : "#F8F4EC"} stroke="#171717" strokeWidth="2" />
            <path d={index === 1 ? `M72 ${y}H164` : `M72 ${y}H142`} stroke={index === 1 ? "#F8F4EC" : "#171717"} strokeWidth="5" strokeLinecap="round" strokeOpacity={index === 1 ? ".86" : ".58"} />
          </g>
        ))}
        <path d="M38 28H58M38 142H58" stroke="#171717" strokeOpacity=".5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 360 170" className="h-full w-full" fill="none" aria-hidden="true">
      <circle cx="100" cy="85" r="50" stroke="#171717" strokeOpacity=".18" />
      <circle cx="100" cy="85" r="29" stroke={accent} strokeWidth="9" strokeOpacity=".92" />
      <circle cx="100" cy="85" r="6" fill="#171717" />
      <path d="M30 85H170M100 15V155" stroke="#171717" strokeOpacity=".2" />
      <rect x="186" y="35" width="144" height="100" rx="18" fill="#F8F4EC" fillOpacity=".68" stroke="#171717" strokeOpacity=".24" />
      <rect x="202" y="51" width="32" height="32" rx="8" fill={accent} fillOpacity=".9" />
      <path d="M248 58H310M248 73H289" stroke="#171717" strokeWidth="5" strokeLinecap="round" strokeOpacity=".68" />
      <path d="M202 101H310M202 116H274" stroke="#171717" strokeWidth="5" strokeLinecap="round" strokeOpacity=".34" />
      <path d="M170 85H186" stroke="#171717" strokeWidth="2" />
      <rect x="174" y="81" width="8" height="8" fill="#171717" />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-viasee-works-title"
      className="mx-auto mt-28 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      <Reveal className="grid gap-8 lg:grid-cols-[1.55fr_0.75fr] lg:items-end lg:gap-16">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/70 sm:text-[11px]">
            Cum funcționează
          </p>
          <h2
            id="how-viasee-works-title"
            className="mt-5 max-w-[58rem] font-heading text-[clamp(2.7rem,5.8vw,5.7rem)] font-extrabold leading-[0.94] tracking-[-0.065em] text-[#171717]"
          >
            De la ce cauți
            <span className="block">la unde poți merge.</span>
          </h2>
        </div>

        <div className="lg:pb-1">
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Ne spui, cu cuvintele tale, ce cauți. Îți punem câteva întrebări simple ca să înțelegem exact de ce ai nevoie, apoi îți arătăm cabinetele, clinicile și opticile din zona ta care se potrivesc. Este un ghid de orientare — nu un diagnostic și nu o consultație medicală.
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

      <div className="relative mt-14 sm:mt-16 lg:mt-24">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-[47%] hidden h-px bg-black/25 lg:block"
        />

        <div className="relative grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-4">
          {STEPS.map((step, index) => (
            <Reveal
              as="article"
              key={step.number}
              delay={index * 70}
              className={`relative ${step.placement}`}
            >
              {/* Halou: acelasi aspect ca vechiul blur-3xl pe -inset-5, desenat ca gradient
                  (vezi softGlow.js): 20px + 128px = 148px. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[148px] -z-10 opacity-70"
                style={{ backgroundImage: step.glow }}
              />
              <span
                aria-hidden="true"
                className="absolute -left-1.5 top-[47%] z-20 hidden h-3 w-3 bg-[#171717] lg:block"
              />

              <div className={`relative overflow-hidden border border-black/[0.11] ${step.shape} ${step.tone}`}>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage: "url('/images/home/viasee-technical-grain.svg')",
                    backgroundSize: "180px 180px",
                  }}
                />
                <div className="relative z-10 flex items-center justify-between border-b border-black/10 px-6 py-5">
                  <span className="font-mono text-xs font-semibold tracking-[0.18em] text-foreground/65">
                    {step.number}
                  </span>
                  <span className="h-3 w-3" style={{ backgroundColor: step.accent }} aria-hidden="true" />
                </div>

                <div className="relative z-10 h-48 border-b border-black/10 p-5 sm:h-52">
                  <StepGraphic kind={step.kind} accent={step.accent} />
                </div>

                <div className="relative z-10 min-h-[12.5rem] px-6 py-7">
                  <h3 className="font-heading text-2xl font-extrabold leading-[1.05] tracking-[-0.04em] text-[#171717] sm:text-[2rem]">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/65 sm:text-base">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal className="mt-24 border-y-[3px] border-[#171717] sm:mt-28">
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
