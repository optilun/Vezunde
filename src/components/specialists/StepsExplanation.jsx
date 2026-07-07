import React from "react";
import { Search, UserCheck, Settings } from "lucide-react";

const STEPS = [
  { icon: Search, label: "Gasesti locatia" },
  { icon: UserCheck, label: "Confirmi relatia" },
  { icon: Settings, label: "Iti gestionezi profilul" },
];

// Simple monochrome line icons, subtle neutral backgrounds — no marketing gloss.
export default function StepsExplanation() {
  return (
    <section id="cum-functioneaza" className="max-w-4xl mx-auto px-5 py-14 sm:py-20">
      <div className="grid sm:grid-cols-3 gap-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-7 text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mx-auto">
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Pasul {i + 1}</div>
              <h3 className="mt-1 font-heading font-bold">{s.label}</h3>
            </div>
          );
        })}
      </div>
    </section>
  );
}