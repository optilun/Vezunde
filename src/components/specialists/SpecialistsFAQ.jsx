import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Profilul sau locatia exista deja. Ce fac?",
    a: "Cauta mai intai profilul existent si revendica-l sau solicita acces. Crearea unei inregistrari noi este destinata cazurilor in care locatia nu exista deja in VIASEE.",
  },
  {
    q: "Cine poate revendica o locatie?",
    a: "Proprietarul, reprezentantul organizatiei, managerul locatiei sau o alta persoana autorizata poate initia revendicarea. Accesul este acordat numai dupa verificarea relatiei declarate.",
  },
  {
    q: "Sunt specialist si lucrez intr-o clinica. Am nevoie de organizatie proprie?",
    a: "Nu. Profilul profesional este separat de organizatie. Dupa creare si verificare, el poate fi asociat cu una sau mai multe locatii unde lucrezi.",
  },
  {
    q: "Pot administra mai multe locatii?",
    a: "Da. O organizatie poate avea mai multe locatii, iar accesul poate fi gestionat pe organizatie si pe locatie, in functie de rol.",
  },
  {
    q: "Ce inseamna ca VIASEE verifica informatiile?",
    a: "Verificarea nu inseamna automat acelasi lucru pentru toate datele. VIASEE poate analiza existenta locatiei, legatura persoanei cu profilul, informatii profesionale sau anumite modificari, in functie de tipul profilului si de informatia publicata.",
  },
  {
    q: "Cat dureaza analiza unei revendicari?",
    a: "Revendicarile sunt analizate inainte de acordarea accesului. Durata poate varia in functie de informatiile si dovezile disponibile; VIASEE nu afiseaza un termen fix daca acesta nu poate fi respectat in mod real.",
  },
  {
    q: "Ce se intampla daca informatiile publice sunt gresite?",
    a: "Dupa ce ai acces, poti propune actualizari. Unele modificari pot necesita analiza inainte sa devina publice, pentru a pastra acuratetea directorului.",
  },
];

export default function SpecialistsFAQ() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-center">
        Intrebari frecvente
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
