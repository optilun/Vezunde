import React from "react";
import { FileCheck2, UserCheck, Settings } from "lucide-react";

const STEPS = [
  { icon: FileCheck2, label: "Completezi datele profesionale", text: "Adaugi numele profesional, profesia, localitatea si contactele publice de baza." },
  { icon: UserCheck, label: "Confirmi identitatea", text: "Te autentifici si trimiti datele private necesare verificarii profilului." },
  { icon: Settings, label: "Configurezi profilul", text: "Dupa aprobarea solicitarii, completezi descrierea, fotografia si asocierile cu locatii." },
];

export default function StepsExplanation() {
  return (
    <section id="cum-functioneaza" className="max-w-4xl mx-auto px-5 pt-6 pb-4 sm:pt-8 sm:pb-6 border-t border-border/60">
      <div className="relative grid sm:grid-cols-3 gap-6 sm:gap-6">
        <div aria-hidden className="hidden sm:block absolute top-5 left-[16.5%] right-[16.5%] h-px bg-border" />
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative text-center">
              <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center mx-auto relative z-10 text-xs font-bold">{index + 1}</div>
              <div className="mt-4 w-9 h-9 rounded-xl bg-secondary flex items-center justify-center mx-auto"><Icon className="w-4.5 h-4.5 text-foreground" /></div>
              <h3 className="mt-3 font-heading font-bold">{step.label}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto">{step.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
