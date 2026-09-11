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
    <section className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-center">
        Întrebări frecvente
      </h2>
      <div className="mt-5 bg-card border border-border rounded-2xl px-5 sm:px-7">
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
