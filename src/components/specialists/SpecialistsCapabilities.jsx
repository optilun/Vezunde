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
    <section aria-labelledby="specialists-capabilities-title" className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20">
      <div className="max-w-xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#684d78] sm:text-xs">Ce poți administra</p>
        <h2 id="specialists-capabilities-title" className="mt-4 font-heading text-3xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl">Totul, în același loc.</h2>
        <p className="mt-4 text-sm leading-relaxed text-[#665f69] sm:text-base">Organizația, locațiile și profilul profesional au fiecare spațiul lor. Tu le gestionezi din același cont.</p>
      </div>
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[#d9d2dc] bg-[#d9d2dc] sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item, index) => {
          const Icon = item.icon;
          return <div key={item.title} className="bg-[#fffdf9] p-5 sm:min-h-[190px] sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ede5f1] text-[#684d78]"><Icon aria-hidden="true" className="h-5 w-5" /></div>
              <span aria-hidden="true" className="font-mono text-xs text-[#aaa0af]">0{index + 1}</span>
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#665f69]">{item.text}</p>
          </div>;
        })}
      </div>
    </section>
  );
}
