import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SITUATIONS = [
  {
    situation: "Ochelarii mei s-au rupt sau strambat",
    specialist: "Optician",
    detail: "Opticianul repara rame, inlocuieste suruburi si placute, regleaza si monteaza lentile. De multe ori rezolva pe loc.",
    services: "Reparatii ochelari · Reglaj rame · Montaj lentile",
    to: "/cerere?categorie=reparatii",
  },
  {
    situation: "Vad tot mai greu si vreau un control",
    specialist: "Optometrist",
    detail: "Optometristul iti verifica vederea, stabileste dioptriile si iti recomanda ochelarii sau lentilele potrivite.",
    services: "Control vedere · Lentile de contact · Lentile progresive",
    to: "/cerere?categorie=control_vedere",
  },
  {
    situation: "Copilul meu se apropie prea mult de carte sau ecran",
    specialist: "Optometrist",
    detail: "Un optometrist specializat in copii verifica vederea adaptat varstei si poate incepe un program de management al miopiei.",
    services: "Control vedere copii · Managementul miopiei",
    to: "/cerere?categorie=copii_miopie",
  },
  {
    situation: "Ma ustura si mi se usuca ochii",
    specialist: "Medic oftalmolog",
    detail: "Medicul oftalmolog evalueaza suprafata oculara si iti recomanda tratamentul potrivit pentru ochiul uscat.",
    services: "Consult oftalmologic · Ochi uscat",
    to: "/cerere?categorie=ochi_uscat",
  },
  {
    situation: "Am un simptom care ma ingrijoreaza",
    specialist: "Medic oftalmolog",
    detail: "Pentru simptome, doar un medic oftalmolog poate consulta, investiga si trata. ViaSee te ajuta sa gasesti unul potrivit, fara sa puna diagnostice.",
    services: "Consult oftalmologic · OCT · Camp vizual · Tonometrie",
    to: "/cerere?categorie=consult_oftalmologic",
  },
];

export default function SituationExplainer() {
  const [active, setActive] = useState(0);
  const current = SITUATIONS[active];

  return (
    <section className="max-w-6xl mx-auto px-5 mt-32 sm:mt-44">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <h2 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] max-w-2xl leading-[1.05]">
          Nu stii la cine sa mergi?
          <br />
          <span className="font-display italic font-medium text-muted-foreground/60">Nu trebuie sa stii.</span>
        </h2>
      </motion.div>

      <div className="mt-14 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-20 items-start">
        <div>
          {SITUATIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`group w-full text-left py-5 border-b border-border flex items-baseline gap-4 transition-colors ${
                active === i ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 translate-y-[-1px] transition-colors ${active === i ? "bg-primary" : "bg-border group-hover:bg-muted-foreground/40"}`} />
              <span className="font-heading text-lg sm:text-xl font-bold tracking-tight leading-snug">"{s.situation}"</span>
            </button>
          ))}
        </div>

        <div className="lg:sticky lg:top-28">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="bg-foreground text-background rounded-[2rem] p-8 sm:p-10"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-background/50">La cine mergi</p>
              <h3 className="mt-3 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-primary-foreground">
                <span className="text-primary brightness-150">{current.specialist}</span>
              </h3>
              <p className="mt-4 text-background/70 leading-relaxed">{current.detail}</p>
              <p className="mt-5 text-sm text-background/50">{current.services}</p>
              <Link
                to={current.to}
                className="mt-8 inline-flex items-center gap-2 bg-background text-foreground rounded-full px-6 py-3 text-sm font-semibold hover:gap-3 transition-all"
              >
                Incepe de aici <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}