import React from "react";
import { Search, UserCheck, Settings } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    label: "Găsești profilul",
    text: "Cauți locația sau alegi profilul profesional.",
  },
  {
    icon: UserCheck,
    label: "Confirmi legătura",
    text: "Ne spui cine ești și ce vrei să administrezi.",
  },
  {
    icon: Settings,
    label: "Actualizezi datele",
    text: "După aprobare, completezi informațiile publice.",
  },
];

export default function StepsExplanation() {
  return (
    <section
      id="cum-functioneaza" style={{ scrollMarginTop: "5rem" }}
      className="max-w-4xl mx-auto px-5 pt-6 pb-4 sm:pt-8 sm:pb-6 border-t border-border/60"
    >
      <ol className="relative grid gap-5 sm:grid-cols-3 sm:gap-6">
        <li aria-hidden="true" className="pointer-events-none absolute bottom-9 left-[17px] top-5 w-px bg-border sm:bottom-auto sm:left-[16.5%] sm:right-[16.5%] sm:h-px sm:w-auto" />
        {STEPS.map((step, index) => {
          const Icon = step.icon;

          return (
            <li key={step.label} className="relative flex items-start gap-4 sm:block sm:text-center">
              <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background sm:mx-auto sm:h-10 sm:w-10">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:mt-4 sm:justify-center">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#405AE9]" />
                  <h3 className="font-heading font-bold">{step.label}</h3>
                </div>
                <p className="mt-1.5 max-w-[260px] text-sm leading-relaxed text-[#657087] sm:mx-auto">
                  {step.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
