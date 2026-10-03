import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/common/Reveal";
import { prefetchOnIntent } from "@/lib/routePrefetch";
import ClientJourneyVideo from "./ClientJourneyVideo";

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

export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-viasee-works-title"
      className="mx-auto mt-16 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      <Reveal className="text-center">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/65 sm:text-[11px]">
          Cum funcționează
        </p>
        <h2
          id="how-viasee-works-title"
          className="mx-auto mt-4 max-w-4xl font-heading text-[2rem] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#171717] sm:text-[clamp(2.7rem,5vw,4.5rem)]"
        >
          Vezi cum găsești<br />îngrijirea potrivită.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
          De la ce cauți la opțiunile din zona ta.
        </p>
      </Reveal>

      <ClientJourneyVideo />

      <div className="mt-7 flex justify-center sm:mt-8">
        <Link
          to="/cerere"
          {...prefetchOnIntent("/cerere")}
          className="inline-flex min-h-12 items-center gap-4 rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#333] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] sm:text-base"
        >
          Începe căutarea
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
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
