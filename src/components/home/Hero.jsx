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
    <section className="relative overflow-hidden min-h-[92vh] flex items-center justify-center">
      {/* Immersive gradient mesh background — warm Vezunde tones */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {/* light center so the text stays readable */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 55% at 50% 42%, #F4F1EA 0%, rgba(244,241,234,0.85) 45%, rgba(244,241,234,0) 100%)", zIndex: 2 }}
        />
        {/* top-left amber glow */}
        <div
          className="absolute top-[-20%] left-[-15%] w-[70vw] h-[70vh] rounded-full blur-[120px] opacity-60"
          style={{ background: "radial-gradient(circle, #E8B84B 0%, #D98E3F 50%, transparent 75%)" }}
        />
        {/* top-right soft rose glow */}
        <div
          className="absolute top-[-25%] right-[-15%] w-[65vw] h-[65vh] rounded-full blur-[120px] opacity-50"
          style={{ background: "radial-gradient(circle, #E09A7E 0%, #C7572E 55%, transparent 78%)" }}
        />
        {/* bottom full-width terracotta wave */}
        <div
          className="absolute bottom-[-35%] left-[-10%] w-[75vw] h-[80vh] rounded-full blur-[110px] opacity-75"
          style={{ background: "radial-gradient(circle, #C7572E 0%, #A8431F 55%, transparent 78%)" }}
        />
        <div
          className="absolute bottom-[-30%] right-[-10%] w-[70vw] h-[75vh] rounded-full blur-[110px] opacity-70"
          style={{ background: "radial-gradient(circle, #E0762E 0%, #C7572E 55%, transparent 78%)" }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-24 sm:py-28 w-full flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-sm font-semibold tracking-wide uppercase"
          style={{ color: "#C7572E" }}
        >
          Pentru tot ce tine de vederea ta
        </motion.p>

        <motion.h1
          initial={{ filter: "blur(16px)", opacity: 0, y: 8 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
          className="mt-5 font-heading font-extrabold tracking-[-0.035em] leading-[1.02] text-[2.6rem] sm:text-[4.25rem]"
          style={{ color: "#111111" }}
        >
          Spune ce ai nevoie.
          <br />
          Vezi <span className="font-display italic font-medium" style={{ color: "#C7572E" }}>unde</span> poti merge.
        </motion.h1>

        {/* White floating input card */}
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
          className="mt-10 w-full max-w-xl"
        >
          <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_20px_60px_rgba(17,17,17,0.12)] border border-black/[0.04] focus-within:shadow-[0_24px_70px_rgba(199,87,46,0.18)] transition-shadow duration-500 text-left">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={PLACEHOLDERS[phIndex]}
              rows={2}
              className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none placeholder:text-[#746F68]/70"
              style={{ color: "#111111" }}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs hidden sm:block" style={{ color: "#746F68" }}>
                Scrie in cuvintele tale, ca intr-o conversatie
              </span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ml-auto"
                style={{ backgroundColor: "#C7572E", color: "#F4F1EA" }}
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2"
        >
          {EXAMPLES.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="text-sm underline underline-offset-4 transition-colors"
              style={{ color: "#5c5751", textDecorationColor: "rgba(92,87,81,0.35)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#C7572E";
                e.currentTarget.style.textDecorationColor = "#C7572E";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#5c5751";
                e.currentTarget.style.textDecorationColor = "rgba(92,87,81,0.35)";
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