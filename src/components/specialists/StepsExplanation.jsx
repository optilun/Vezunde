import React from "react";
import { Search, UserCheck, Settings } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    label: "Găsești profilul potrivit",
    text: "Cauți organizația sau locația existentă ori alegi fluxul pentru profilul profesional.",
  },
  {
    icon: UserCheck,
    label: "Confirmi legătura",
    text: "Ne spui cine ești și ce relație ai cu organizația, locația sau activitatea profesională.",
  },
  {
    icon: Settings,
    label: "Administrezi prezența",
    text: "După aprobarea necesară, completezi informațiile pe care pacienții le văd pe VIASEE.",
  },
];

export default function StepsExplanation() {
  return (
    <section id="cum-functioneaza" aria-labelledby="specialists-steps-title" className="scroll-mt-24 border-y border-[#d9d2dc] bg-[#ede5f1]/65">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#684d78] sm:text-xs">Cum funcționează</p>
          <h2 id="specialists-steps-title" className="mt-4 max-w-sm font-heading text-3xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl">Trei pași.<br />Un profil care te reprezintă.</h2>
        </div>
        <ol className="grid gap-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return <li key={step.label} className="flex items-start gap-4">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#684d78]/25 bg-[#fffdf9] font-mono text-sm text-[#684d78]">0{index + 1}</span>
              <div className="flex-1 border-b border-[#684d78]/20 pb-5">
                <h3 className="flex items-center justify-between gap-3 font-heading text-base font-semibold sm:text-lg">{step.label}<Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#684d78]" /></h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#665f69]">{step.text}</p>
              </div>
            </li>;
          })}
        </ol>
      </div>
    </section>
  );
}
