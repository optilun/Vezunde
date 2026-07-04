import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

const PLACEHOLDERS = [
  "Mi s-a rupt bratul ochelarilor...",
  "Copilul meu vede greu la tabla...",
  "Vreau un control de vedere saptamana asta...",
  "Ma ustura ochii cand lucrez la calculator...",
];

const SITUATIONS = [
  { label: "Ochelari rupti", to: "/cerere?categorie=reparatii" },
  { label: "Control de vedere", to: "/cerere?categorie=control_vedere" },
  { label: "Copii si miopie", to: "/cerere?categorie=copii_miopie" },
  { label: "Ochi obositi sau uscati", to: "/cerere?categorie=ochi_uscat" },
  { label: "Un simptom care te ingrijoreaza", to: "/cerere?categorie=consult_oftalmologic" },
];

export default function Hero() {
  const [text, setText] = useState("");
  const [phIndex, setPhIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/cerere${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  };

  return (
    <section className="relative overflow-hidden">
      {/* Abstract lens motif */}
      <div aria-hidden className="absolute -top-32 -right-40 w-[480px] h-[480px] rounded-full border border-foreground/[0.07] pointer-events-none" />
      <div aria-hidden className="absolute top-24 -right-16 w-64 h-64 rounded-full border border-foreground/[0.07] pointer-events-none" />
      <div aria-hidden className="absolute top-52 right-40 w-3 h-3 rounded-full bg-primary pointer-events-none hidden sm:block" />

      <div className="max-w-5xl mx-auto px-5 pt-20 sm:pt-32">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Optica, fara ghicit</p>
          <motion.h1
            initial={{ filter: "blur(14px)", opacity: 0 }}
            animate={{ filter: "blur(0px)", opacity: 1 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="mt-5 font-heading font-extrabold tracking-[-0.035em] leading-[0.98] text-[3rem] sm:text-[5.5rem] max-w-4xl"
          >
            Spune ce ai nevoie.
            <br />
            Vezi <span className="font-display italic font-medium text-primary">unde</span> poti merge.
          </motion.h1>
          <p className="mt-7 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
            Nu trebuie sa stii ce specialist iti trebuie. Descrie ce s-a intamplat, iar Vezunde te indruma catre locul potrivit.
          </p>
        </motion.div>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="mt-12 max-w-2xl"
        >
          <div className="bg-foreground rounded-[1.75rem] p-4 shadow-[0_20px_60px_rgba(17,17,17,0.18)] focus-within:shadow-[0_20px_60px_rgba(17,17,17,0.28)] transition-shadow">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={PLACEHOLDERS[phIndex]}
              rows={2}
              className="w-full bg-transparent outline-none text-base text-background px-2 pt-1 resize-none placeholder:text-background/40"
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-background/50">Scrie in cuvintele tale, ca intr-o conversatie</span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-7 flex flex-wrap gap-x-5 gap-y-2 max-w-2xl"
        >
          {SITUATIONS.map((s) => (
            <Link key={s.label} to={s.to} className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary transition-colors">
              {s.label}
            </Link>
          ))}
        </motion.div>

        <p className="mt-10 text-xs text-muted-foreground/70">Vezunde nu ofera diagnostic medical. Te ghidam catre specialistii potriviti.</p>
      </div>
    </section>
  );
}