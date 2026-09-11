import React from "react";
import { Building2, Clock3, MapPinned, ShieldCheck, Stethoscope, Users } from "lucide-react";

const ITEMS = [
  {
    icon: Building2,
    title: "Organizație și locații",
    text: "Păstrezi separat identitatea organizației și informațiile fiecărei locații.",
  },
  {
    icon: Clock3,
    title: "Program și informații publice",
    text: "Actualizezi datele practice pe care pacienții le folosesc când aleg o locație.",
  },
  {
    icon: MapPinned,
    title: "Servicii pe locație",
    text: "Configurezi serviciile acolo unde sunt oferite, fără să le presupunem pentru întreaga organizație.",
  },
  {
    icon: Users,
    title: "Echipă și acces",
    text: "Organizațiile pot administra accesul membrilor și legătura specialiștilor cu locațiile.",
  },
  {
    icon: Stethoscope,
    title: "Profil profesional",
    text: "Specialistul are un profil propriu, separat de organizații și reutilizabil în mai multe locații.",
  },
  {
    icon: ShieldCheck,
    title: "Informații analizate",
    text: "Anumite informații și modificări sunt analizate înainte să devină publice.",
  },
];

export default function SpecialistsCapabilities() {
  return (
    <section className="max-w-5xl mx-auto px-5 py-8 sm:py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Ce poți administra
        </p>
        <h2 className="mt-2 font-heading text-2xl sm:text-3xl font-bold tracking-tight">
          Un singur cont, roluri și informații separate corect
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-sm sm:text-base leading-relaxed text-muted-foreground">
          VIASEE separă organizația, locația și profilul profesional, astfel încât fiecare informație să rămână legată de entitatea corectă.
        </p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-4 font-heading text-sm font-bold">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
