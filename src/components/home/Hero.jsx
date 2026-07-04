import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

const PLACEHOLDERS = [
  "Vad neclar la distanta...",
  "Caut control pentru copil...",
  "Mi s-au rupt ochelarii...",
];

const EXAMPLES = [
  { label: "Vad neclar la distanta", to: "/cerere?categorie=control_vedere" },
  { label: "Caut control pentru copil", to: "/cerere?categorie=copii_miopie" },
  { label: "Mi s-au rupt ochelarii", to: "/cerere?categorie=reparatii" },
];

export default function Hero() {
  const [text, setText] = useState("");
  const [phIndex, setPhIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 3800);
    return () => clearInterval(t);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/cerere${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  };

  return (
    <section className="relative overflow-hidden min-h-[88vh] flex items-center">
      {/* Abstract focus rings — right side */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 1.08, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.6, ease: "easeOut", delay: 0.1 }}
        className="absolute right-[-180px] top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block"
      >
        <div className="relative w-[640px] h-[640px]">
          <div className="absolute inset-0 rounded-full border border-[#111111]/[0.06]" />
          <div className="absolute inset-[60px] rounded-full border border-[#111111]/[0.07]" />
          <div className="absolute inset-[130px] rounded-full border border-[#111111]/[0.08]" />
          <div className="absolute inset-[210px] rounded-full border border-[#111111]/[0.09]" />
          <div className="absolute inset-[280px] rounded-full border border-[#C7572E]/[0.18]" />
          {/* Focus point */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#C7572E]" />
        </div>
      </motion.div>

      {/* Mobile rings — smaller, centered behind content */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="absolute right-[-200px] bottom-[-100px] pointer-events-none sm:hidden"
      >
        <div className="relative w-[400px] h-[400px]">
          <div className="absolute inset-0 rounded-full border border-[#111111]/[0.05]" />
          <div className="absolute inset-[50px] rounded-full border border-[#111111]/[0.06]" />
          <div className="absolute inset-[110px] rounded-full border border-[#111111]/[0.07]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#C7572E]" />
        </div>
      </motion.div>

      <div className="relative max-w-5xl mx-auto px-5 py-24 sm:py-32 w-full">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm font-semibold tracking-wide text-[#C7572E] uppercase"
        >
          Pentru tot ce tine de vederea ta
        </motion.p>

        {/* Headline with blur-to-sharp */}
        <motion.h1
          initial={{ filter: "blur(16px)", opacity: 0, y: 8 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          className="mt-6 font-heading font-extrabold tracking-[-0.035em] leading-[0.98] text-[2.75rem] sm:text-[5rem] max-w-2xl"
          style={{ color: "#111111" }}
        >
          Spune ce ai nevoie.
          <br />
          Vezi <span className="font-display italic font-medium text-[#C7572E]">unde</span> poti merge.
        </motion.h1>

        {/* Conversational input bar */}
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9, ease: "easeOut" }}
          className="mt-12 max-w-xl"
        >
          <div
            className="rounded-[1.5rem] p-4 shadow-[0_24px_70px_rgba(17,17,17,0.14)] focus-within:shadow-[0_24px_70px_rgba(199,87,46,0.22)] transition-shadow duration-500"
            style={{ backgroundColor: "#16140F" }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={PLACEHOLDERS[phIndex]}
              rows={2}
              className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none placeholder:transition-opacity placeholder:duration-500"
              style={{ color: "#F4F1EA" }}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs" style={{ color: "rgba(244,241,234,0.4)" }}>
                Scrie in cuvintele tale, ca intr-o conversatie
              </span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                style={{ backgroundColor: "#C7572E", color: "#F4F1EA" }}
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.form>

        {/* Minimal examples */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.15 }}
          className="mt-7 flex flex-wrap gap-x-6 gap-y-2 max-w-xl"
        >
          {EXAMPLES.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="text-sm underline underline-offset-4 transition-colors"
              style={{ color: "#746F68", textDecorationColor: "rgba(116,111,104,0.3)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#C7572E";
                e.currentTarget.style.textDecorationColor = "#C7572E";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#746F68";
                e.currentTarget.style.textDecorationColor = "rgba(116,111,104,0.3)";
              }}
            >
              {s.label}
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}