import React from "react";
import { Scale, ShieldCheck, HeartHandshake, EyeOff } from "lucide-react";

const PRINCIPLES = [
  { icon: Scale, title: "Potrivire, nu licitatie", text: "Nu exista licitatii de pret, promovari platite sau clasamente dupa marimea companiei." },
  { icon: ShieldCheck, title: "Profiluri verificate", text: "Prioritizam relevanta serviciilor, specializarea, disponibilitatea si calitatea profilului." },
  { icon: HeartHandshake, title: "Sansa egala", text: "Furnizorii mici si independenti au aceeasi sansa ca lanturile mari. Conteaza ce stiu sa faca." },
  { icon: EyeOff, title: "Datele tale raman ale tale", text: "Numarul tau de telefon si emailul nu sunt transmise automat furnizorilor. Tu alegi pe cine contactezi." },
];

export default function FairMatching() {
  return (
    <section className="max-w-6xl mx-auto px-5 mt-24 sm:mt-32">
      <div className="bg-primary rounded-3xl p-8 sm:p-12 text-primary-foreground">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Conteaza potrivirea, nu marimea.</h2>
        <p className="mt-3 text-primary-foreground/75 max-w-2xl">Vezunde este o platforma de potrivire corecta. Ordinea rezultatelor se bazeaza pe relevanta pentru nevoia ta, niciodata pe bugete de publicitate sau dimensiunea afacerii.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i}>
                <Icon className="w-5 h-5 text-primary-foreground/80" />
                <h3 className="mt-3 font-heading font-bold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-primary-foreground/70 leading-relaxed">{p.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}