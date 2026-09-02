import React from "react";
import { Search, UserCheck, Settings } from "lucide-react";

const STEPS = [
  { icon: Search, label: "Găsești sau adaugi locația", text: "Cauți un profil existent sau adaugi o locație nouă." },
  { icon: UserCheck, label: "Trimiți câteva informații despre tine", text: "Ne spui cine ești și cum ești legat de locație sau de activitatea profesională." },
  { icon: Settings, label: "Te faci cunoscut prin profilul tău", text: "După aprobare, completezi informațiile care îi ajută pe pacienți să înțeleagă ce faci și unde te pot găsi." },
];

// A connected onboarding journey rather than three isolated cards — a thin
// line links the step markers to read left-to-right as a single process.
export default function StepsExplanation() {
  return (
    <section id="cum-functioneaza" className="max-w-4xl mx-auto px-5 pt-6 pb-4 sm:pt-8 sm:pb-6 border-t border-border/60">
      <div className="relative grid sm:grid-cols-3 gap-6 sm:gap-6">
        <div aria-hidden className="hidden sm:block absolute top-5 left-[16.5%] right-[16.5%] h-px bg-border" />
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="relative text-center">
              <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center mx-auto relative z-10 text-xs font-bold">
                {i + 1}
              </div>
              <div className="mt-4 w-9 h-9 rounded-xl bg-secondary flex items-center justify-center mx-auto">
                <Icon className="w-4.5 h-4.5 text-foreground" />
              </div>
              <h3 className="mt-3 font-heading font-bold">{s.label}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto">{s.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}