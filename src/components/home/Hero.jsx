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
      {/* Soft glow mesh background, in-palette (ivory / terracotta / amber) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-[0.35] blur-[110px]"
          style={{ background: "radial-gradient(circle, #C7572E 0%, #E0A226 45%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-25%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.25] blur-[100px]"
          style={{ background: "radial-gradient(circle, #E0A226 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto px-5 py-24 sm:py-28 w-full flex flex-col items-center text-center">
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
          className="mt-6 font-heading font-extrabold tracking-[-0.035em] leading-[0.98] text-[2.75rem] sm:text-[4.75rem]"
          style={{ color: "#111111" }}
        >
          Spune ce ai nevoie.
          <br />
          Vezi <span className="font-display italic font-medium" style={{ color: "#C7572E" }}>unde</span> poti merge.
        </motion.h1>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75, ease: "easeOut" }}
          className="mt-11 w-full max-w-xl"
        >
          <div
            className="rounded-[1.75rem] p-4 shadow-[0_24px_70px_rgba(17,17,17,0.14)] focus-within:shadow-[0_24px_70px_rgba(199,87,46,0.22)] transition-shadow duration-500"
            style={{ backgroundColor: "#16140F" }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={PLACEHOLDERS[phIndex]}
              rows={2}
              className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none text-center sm:text-left"
              style={{ color: "#F4F1EA" }}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs hidden sm:block" style={{ color: "rgba(244,241,234,0.4)" }}>
                Scrie in cuvintele tale, ca intr-o conversatie
              </span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ml-auto"
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
          transition={{ duration: 0.7, delay: 1.05 }}
          className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2"
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