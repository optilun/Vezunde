import React from "react";
import { Building2, Clock3, MapPinned, ShieldCheck, Stethoscope, Users } from "lucide-react";

const ITEMS = [
  {
    icon: Building2,
    title: "Organizație și locații",
    text: "Toate locațiile, cu datele fiecăreia.",
  },
  {
    icon: Clock3,
    title: "Program și contact",
    text: "Orele de lucru, adresa și datele de contact.",
  },
  {
    icon: MapPinned,
    title: "Servicii pe locație",
    text: "Serviciile oferite în fiecare locație.",
  },
  {
    icon: Users,
    title: "Echipă și acces",
    text: "Roluri și acces pentru oamenii din echipă.",
  },
  {
    icon: Stethoscope,
    title: "Profil profesional",
    text: "Un singur profil, asociat cu locațiile unde lucrezi.",
  },
  {
    icon: ShieldCheck,
    title: "Verificarea informațiilor",
    text: "Date analizate înainte de publicare, când este necesar.",
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
          Totul la îndemână, într-un singur cont
        </h2>
        <p className="mt-3 mx-auto max-w-2xl text-sm sm:text-base leading-relaxed text-muted-foreground">
          Locațiile, echipa și profilul profesional, fiecare cu informațiile sale.
        </p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-[#C4B5CE] hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1EBF5] text-[#6A5078]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-4 font-heading text-sm font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
