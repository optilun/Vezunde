import React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ArrowDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Locația există deja pe VIASEE. Cum primesc acces?",
    a: [
      "Caută locația după nume sau adresă și verifică dacă ai ales profilul corect. Dacă nu este încă administrată, alege „Revendică această locație”. Dacă are deja un administrator, alege „Solicită acces”.",
      "În formular precizezi relația ta cu locația, confirmi că ești autorizat și alegi locațiile pentru care soliciți acces. VIASEE analizează cererea înainte de acordarea rolului.",
    ],
  },
  {
    q: "Cine poate revendica o locație?",
    a: [
      "Poate solicita acces proprietarul, reprezentantul organizației, managerul locației sau un membru autorizat al echipei.",
      "Rolul acordat depinde de relația declarată și de verificare. Administrarea unei locații nu oferă automat control asupra întregii organizații.",
    ],
  },
  {
    q: "Pot revendica mai multe locații într-o singură cerere?",
    a: [
      "Da. După ce alegi o locație existentă, poți solicita acces pentru o singură locație, pentru mai multe locații sau pentru organizație, în funcție de relația ta cu aceasta.",
      "Verifici și confirmi explicit locațiile incluse înainte de trimitere. VIASEE le analizează separat, iar aprobarea poate acoperi doar o parte dintre ele. Locațiile excluse sau adăugate ulterior nu primesc automat acces.",
    ],
  },
  {
    q: "Care este diferența dintre organizație, locație și specialist?",
    a: [
      "Organizația reprezintă afacerea sau clinica. Locația este punctul de lucru, cu adresa, programul, contactul și serviciile sale. O organizație poate avea mai multe locații.",
      "Profilul profesional reprezintă persoana: medic oftalmolog, optometrist sau optician. Rămâne separat de organizație și poate fi asociat cu locațiile unde specialistul lucrează.",
    ],
  },
  {
    q: "Sunt specialist într-o clinică. Ce opțiune aleg?",
    a: [
      "Alege „Sunt specialist”, apoi „Continuă cu profilul tău”. Nu ai nevoie de o organizație proprie pentru a avea un profil profesional.",
      "După verificare, profilul poate fi asociat cu una sau mai multe locații unde lucrezi. Dacă ai deja un profil legat de cont, îl regăsești după autentificare.",
    ],
  },
  {
    q: "Nu găsesc locația. Cum adaug una nouă?",
    a: [
      "Încearcă mai întâi numele și adresa locației, pentru a evita o înregistrare duplicată. Dacă lipsește, alege „Adaugă o locație nouă” și completează informațiile cerute.",
      "Locația este analizată înainte de publicare. Organizația și punctul de lucru sunt înregistrate separat, iar serviciile se completează pentru locul în care sunt oferite.",
    ],
  },
  {
    q: "Ce verifică VIASEE și cât durează?",
    a: [
      "În funcție de solicitare, verificarea poate privi existența locației, dreptul tău de a o administra, informațiile profesionale sau modificările propuse. Verificarea unei informații nu înseamnă că toate datele profilului au fost verificate.",
      "Durata depinde de informațiile disponibile și de clarificările necesare. Accesul este acordat după analiză; o locație nouă nu devine publică doar prin trimiterea formularului.",
    ],
  },
  {
    q: "Cum corectez informațiile publice?",
    a: [
      "După ce primești acces, poți actualiza informațiile pentru profilurile și locațiile incluse în rolul tău: de exemplu adresa, programul, contactul sau serviciile.",
      "Unele modificări necesită analiză înainte de publicare. Dacă datele unei locații existente sunt greșite, folosește profilul respectiv și solicită acces, fără să creezi o copie.",
    ],
  },
];

export default function SpecialistsFAQ() {
  return (
    <section aria-labelledby="specialists-faq-title" className="bg-white px-5 py-14 sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-9 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <h2 id="specialists-faq-title" className="font-heading text-[clamp(2.5rem,5.3vw,5rem)] font-bold leading-[1.03] tracking-[-.045em]">
          Întrebări<br />frecvente
        </h2>
        <Accordion type="single" collapsible defaultValue="item-0" className="min-w-0 border-t-2 border-[#242733]">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`} className="border-b-2 border-[#242733]">
              <AccordionPrimitive.Header>
                <AccordionPrimitive.Trigger className="group flex w-full items-start justify-between gap-5 py-6 text-left font-heading text-lg font-semibold leading-snug text-[#242733] transition-colors hover:text-[#405AE9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#405AE9] focus-visible:ring-offset-4 sm:gap-8 sm:py-8 sm:text-2xl">
                  <span>{item.q}</span>
                  <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current sm:h-9 sm:w-9">
                    <ArrowDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none sm:h-6 sm:w-6" strokeWidth={2.5} />
                  </span>
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="pb-7 pr-1 text-base leading-[1.65] text-[#424958] sm:pb-10 sm:pr-12 sm:text-lg">
                <div className="space-y-5">
                  {item.a.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

