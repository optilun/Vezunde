import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
    <section className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-center">
        Întrebări frecvente
      </h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">Profiluri, revendicare și acces, explicate pas cu pas.</p>
      <div className="mt-5 bg-card border border-border rounded-2xl px-5 sm:px-7">
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger className="min-h-14 text-left text-sm font-semibold hover:text-[#2E6666]">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                <div className="space-y-3 pb-1">
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
