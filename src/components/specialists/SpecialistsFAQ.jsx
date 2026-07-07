import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Cine poate revendica o locatie?",
    a: "Orice persoana care reprezinta locatia — proprietar, reprezentant al organizatiei, manager de locatie sau personal autorizat — poate initia o revendicare.",
  },
  {
    q: "Cat dureaza analiza unei revendicari?",
    a: "Revendicarile sunt analizate manual inainte de acordarea accesului. Durata poate varia in functie de informatiile furnizate.",
  },
  {
    q: "Pot administra mai multe locatii?",
    a: "Da. O organizatie poate avea mai multe locatii, iar un profesionist poate fi asociat cu mai multe locatii in acelasi timp.",
  },
  {
    q: "De ce anumite modificari necesita analiza?",
    a: "Analiza informatiilor publice ajuta la mentinerea acuratetei si increderii pacientilor care folosesc platforma.",
  },
];

export default function SpecialistsFAQ() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-6 sm:py-8">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-center">Intrebari frecvente</h2>
      <div className="mt-5 bg-card border border-border rounded-2xl px-5 sm:px-7">
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}