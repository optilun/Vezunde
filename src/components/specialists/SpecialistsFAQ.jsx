import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Cine isi poate crea profil profesional?",
    a: "Medicii oftalmologi, optometristii si opticienii isi pot trimite profilul profesional pentru verificare.",
  },
  {
    q: "Profilul profesional imi da acces la o clinica sau optica?",
    a: "Nu. Profilul profesional si accesul administrativ la o organizatie sunt separate. Accesul la o locatie este acordat de owner sau printr-o solicitare verificata.",
  },
  {
    q: "Pot fi asociat cu mai multe locatii?",
    a: "Da. Asocierile cu locatii se confirma separat si nu transfera controlul asupra profilului organizatiei.",
  },
  {
    q: "Profilul devine public imediat?",
    a: "Nu. Solicitarea este analizata, iar profilul ramane draft pana la completare si aprobare.",
  },
  {
    q: "Ce date sunt publice?",
    a: "Numele profesional, descrierea, fotografia si contactele pe care alegi sa le publici. Datele folosite pentru verificare raman private.",
  },
];

export default function SpecialistsFAQ() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-6 sm:py-8">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-center">Intrebari frecvente</h2>
      <div className="mt-5 bg-card border border-border rounded-2xl px-5 sm:px-7">
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
