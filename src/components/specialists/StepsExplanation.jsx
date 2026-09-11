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
    label: "Confirmi legatura",
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
    <section
      id="cum-functioneaza"
      className="max-w-4xl mx-auto px-5 pt-6 pb-4 sm:pt-8 sm:pb-6 border-t border-border/60"
    >
      <div className="relative grid sm:grid-cols-3 gap-6 sm:gap-6">
        <div
          aria-hidden
          className="hidden sm:block absolute top-5 left-[16.5%] right-[16.5%] h-px bg-border"
        />
        {STEPS.map((step, index) => {
          const Icon = step.icon;

          return (
            <div key={step.label} className="relative text-center">
              <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center mx-auto relative z-10 text-xs font-bold">
                {index + 1}
              </div>
              <div className="mt-4 w-9 h-9 rounded-xl bg-secondary flex items-center justify-center mx-auto">
                <Icon className="w-4.5 h-4.5 text-foreground" />
              </div>
              <h3 className="mt-3 font-heading font-bold">{step.label}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-[235px] mx-auto">
                {step.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
