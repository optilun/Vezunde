import React from "react";
import { MessageSquareText, ListChecks, MapPin } from "lucide-react";

const STEPS = [
  { icon: MessageSquareText, title: "Descrie nevoia ta", text: "Scrie in cuvintele tale ce te preocupa: un control, ochelari noi, o reparatie sau un simptom care te ingrijoreaza." },
  { icon: ListChecks, title: "Raspunde la cateva intrebari", text: "Te ghidam pas cu pas ca sa intelegem exact ce cauti, pentru cine si in ce oras." },
  { icon: MapPin, title: "Vezi unde poti merge", text: "Iti aratam furnizorii potriviti, cu servicii relevante, profil verificat si date de contact publice." },
];

export default function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto px-5 mt-24 sm:mt-32">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-center">Cum functioneaza</h2>
      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="bg-card rounded-2xl border border-border p-7">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-heading text-sm font-bold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-heading font-bold text-lg">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}