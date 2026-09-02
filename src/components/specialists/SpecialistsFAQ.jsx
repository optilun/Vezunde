import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Cine poate revendica o locație?",
    a: "Orice persoană care reprezintă locația — proprietar, reprezentant al organizației, manager de locație sau personal autorizat — poate iniția o revendicare.",
  },
  {
    q: "Cât durează analiza unei revendicări?",
    a: "Revendicările sunt analizate manual înainte de acordarea accesului. Durata poate varia în funcție de informațiile furnizate.",
  },
  {
    q: "Pot administra mai multe locații?",
    a: "Da. O organizație poate avea mai multe locații, iar un profesionist poate fi asociat cu mai multe locații în același timp.",
  },
  {
    q: "Ce se întâmplă dacă informațiile profilului sunt greșite?",
    a: "Poți propune actualizări după ce revendicarea este aprobată. Anumite modificări pot necesita o nouă analiză înainte de a deveni publice.",
  },
  {
    q: "De ce anumite modificări necesită analiză?",
    a: "Analiza informațiilor publice ajută la menținerea acurateței și încrederii pacienților care folosesc platforma.",
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