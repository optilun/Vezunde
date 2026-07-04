import React from "react";
import { Link } from "react-router-dom";
import { Scale, ShieldCheck, EyeOff, ArrowRight, Users } from "lucide-react";

const BENEFITS = [
  { icon: Scale, title: "Potrivire corecta", text: "Ordinea rezultatelor se bazeaza pe relevanta serviciilor tale, specializare, disponibilitate si calitatea profilului. Nu pe bugete de publicitate, marimea lantului sau cel mai mic pret." },
  { icon: Users, title: "Pacienti cu nevoi reale", text: "Utilizatorii descriu exact ce cauta: un control, managementul miopiei la copii, o reparatie. Tu apari cand serviciile tale se potrivesc." },
  { icon: ShieldCheck, title: "Profil verificat", text: "Un profil complet si verificat creste increderea pacientilor si relevanta in rezultate." },
  { icon: EyeOff, title: "Respect pentru pacienti", text: "Datele de contact ale pacientilor nu sunt transmise automat. Numarul tau de telefon este public, iar pacientii aleg cand te contacteaza." },
];

export default function ForSpecialists() {
  return (
    <div className="max-w-6xl mx-auto px-5 pt-16 pb-8">
      <div className="max-w-2xl">
        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Fii gasit pentru ceea ce stii sa faci.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Vezunde conecteaza pacientii cu opticieni, optometristi si medici oftalmologi pe baza nevoii descrise — nu pe baza marimii afacerii. Furnizorii mici si independenti au aceeasi sansa ca lanturile mari.
        </p>
        <Link to="/revendica-profil" className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-7 py-3.5 font-medium hover:opacity-90 transition-opacity">
          Revendica-ti profilul <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="mt-16 grid sm:grid-cols-2 gap-4">
        {BENEFITS.map((b, i) => {
          const Icon = b.icon;
          return (
            <div key={i} className="bg-card border border-border rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="mt-4 font-heading font-bold text-lg">{b.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.text}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-12 bg-secondary rounded-2xl p-7 text-sm text-muted-foreground max-w-3xl">
        <span className="font-medium text-foreground">Nota:</span> Vezunde este o platforma de potrivire, nu de licitatii. Nu exista promovare platita, comparatii de pret sau clasamente dupa dimensiunea companiei.
      </div>
    </div>
  );
}