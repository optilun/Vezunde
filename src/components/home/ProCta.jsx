import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ProCta() {
  return (
    <section className="max-w-6xl mx-auto px-5 mt-32 sm:mt-44">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden bg-foreground text-background rounded-[2.5rem] px-8 py-14 sm:px-16 sm:py-20"
      >
        <div aria-hidden className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full border border-background/10 pointer-events-none" />
        <div aria-hidden className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full border border-background/10 pointer-events-none" />
        <p className="text-xs font-semibold uppercase tracking-widest text-background/50">Pentru specialisti</p>
        <h2 className="mt-4 font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05] max-w-2xl">
          Fii gasit pentru <span className="font-display italic font-medium">ceea ce stii sa faci</span>.
        </h2>
        <p className="mt-5 text-background/60 max-w-xl leading-relaxed">
          Optica, cabinet sau clinica — pe Vezunde apari cand serviciile tale se potrivesc cu nevoia pacientului. Fara licitatii, fara bugete de promovare.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <Link to="/pentru-specialisti" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-7 py-3.5 font-semibold hover:gap-3 transition-all">
            Afla cum functioneaza <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/revendica-profil" className="text-sm font-medium text-background/70 underline underline-offset-4 decoration-background/30 hover:text-background transition-colors">
            Revendica un profil existent
          </Link>
        </div>
      </motion.div>
    </section>
  );
}