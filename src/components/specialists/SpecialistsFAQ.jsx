import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Profilul sau locația există deja. Ce fac?",
    a: "Caută mai întâi profilul existent și revendică-l sau solicită acces. Crearea unei înregistrări noi este destinată cazurilor în care locația nu există deja în VIASEE.",
  },
  {
    q: "Cine poate revendica o locație?",
    a: "Proprietarul, reprezentantul organizației, managerul locației sau o altă persoană autorizată poate iniția revendicarea. Accesul este acordat numai după verificarea relației declarate.",
  },
  {
    q: "Sunt specialist și lucrez într-o clinică. Am nevoie de organizație proprie?",
    a: "Nu. Profilul profesional este separat de organizație. După creare și verificare, el poate fi asociat cu una sau mai multe locații unde lucrezi.",
  },
  {
    q: "Pot administra mai multe locații?",
    a: "Da. O organizație poate avea mai multe locații, iar accesul poate fi gestionat pe organizație și pe locație, în funcție de rol.",
  },
  {
    q: "Ce înseamnă că VIASEE verifică informațiile?",
    a: "Verificarea nu înseamnă automat același lucru pentru toate datele. VIASEE poate analiza existența locației, legătura persoanei cu profilul, informații profesionale sau anumite modificări, în funcție de tipul profilului și de informația publicată.",
  },
  {
    q: "Cât durează analiza unei revendicări?",
    a: "Revendicările sunt analizate înainte de acordarea accesului. Durata poate varia în funcție de informațiile și dovezile disponibile; VIASEE nu afișează un termen fix dacă acesta nu poate fi respectat în mod real.",
  },
  {
    q: "Ce se întâmplă dacă informațiile publice sunt greșite?",
    a: "După ce ai acces, poți propune actualizări. Unele modificări pot necesita analiză înainte să devină publice, pentru a păstra acuratețea directorului.",
  },
];

export default function SpecialistsFAQ() {
  return (
    <section id="intrebari" aria-labelledby="specialists-faq-title" className="border-t border-[#d9d2dc] bg-[#fffdf9]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#684d78] sm:text-xs">Bine de știut</p>
          <h2 id="specialists-faq-title" className="mt-4 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Întrebări frecvente.</h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#665f69]">Despre revendicare, verificare și gestionarea profilului tău.</p>
          <a href="mailto:contact@viasee.ro" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#684d78] underline underline-offset-4">Ai nevoie de ajutor? Scrie-ne.</a>
        </div>
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`} className="border-[#e5dfe8]">
              <AccordionTrigger className="min-h-14 gap-4 text-left text-sm font-medium hover:text-[#684d78]">{item.q}</AccordionTrigger>
              <AccordionContent className="pr-6 text-sm leading-relaxed text-[#665f69]">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
