import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import ConversationalCard from "@/components/intake2/ConversationalCard";

const PROMPTS = [
  "Vad neclar la distanta si vreau un control...",
  "Mi s-au rupt ochelarii. Se pot repara?",
  "Caut control de vedere pentru copilul meu...",
  "Am nevoie de un consult oftalmologic...",
  "Vreau lentile progresive...",
];

const EXAMPLES = [
  { label: "Vad neclar la distanta", to: "/cerere?categorie=control_vedere" },
  { label: "Caut control pentru copil", to: "/cerere?categorie=copii_miopie" },
  { label: "Mi s-au rupt ochelarii", to: "/cerere?categorie=reparatii" },
];

function useTypingPlaceholder(active) {
  const [display, setDisplay] = useState("");
  const stateRef = useRef({ prompt: 0, char: 0, phase: "typing" });

  useEffect(() => {
    if (!active) return;
    let timeout;
    const tick = () => {
      const s = stateRef.current;
      const full = PROMPTS[s.prompt];
      if (s.phase === "typing") {
        s.char += 1;
        setDisplay(full.slice(0, s.char));
        if (s.char >= full.length) {
          s.phase = "pausing";
          timeout = setTimeout(tick, 2000);
        } else {
          timeout = setTimeout(tick, 38 + Math.random() * 45);
        }
      } else if (s.phase === "pausing") {
        s.phase = "erasing";
        timeout = setTimeout(tick, 30);
      } else {
        s.char -= 2;
        if (s.char <= 0) {
          s.char = 0;
          setDisplay("");
          s.prompt = (s.prompt + 1) % PROMPTS.length;
          s.phase = "typing";
          timeout = setTimeout(tick, 500);
        } else {
          setDisplay(full.slice(0, s.char));
          timeout = setTimeout(tick, 18);
        }
      }
    };
    timeout = setTimeout(tick, 600);
    return () => clearTimeout(timeout);
  }, [active]);

  return display;
}

export default function Hero() {
  const [text, setText] = useState("");
  const [animating, setAnimating] = useState(true);
  const [started, setStarted] = useState(false);
  const typed = useTypingPlaceholder(animating && !started);

  const submit = (e) => {
    e.preventDefault();
    setStarted(true);
  };

  const stopAnimation = () => setAnimating(false);

  return (
    <section className="relative overflow-hidden min-h-[92vh] flex items-center justify-center">
      {/* Soft luminous atmosphere: pale sky/lavender above, warm ivory below */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, #DCE4F2 0%, #E9ECF4 22%, #F5F3EE 55%, #F7F2E8 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-24 sm:py-28 w-full flex flex-col items-center text-center">
        {started ? (
          <ConversationalCard initialMessage={text.trim()} />
        ) : (
        <>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className="font-heading font-extrabold tracking-[-0.035em] leading-[1.05] text-[2.6rem] sm:text-[4.25rem]"
          style={{ color: "#141414" }}
        >
          Spune ce ai nevoie.
          <br />
          Vezi unde poti merge.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-5 text-base sm:text-lg max-w-xl"
          style={{ color: "#6B675F" }}
        >
          Descrie simplu ce te preocupa, iar ViaSee te ajuta sa gasesti unde poti merge.
        </motion.p>

        {/* Conversational input card */}
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: "easeOut" }}
          className="mt-10 w-full max-w-xl"
        >
          <div className="relative bg-white rounded-[1.5rem] p-4 shadow-[0_18px_55px_rgba(20,20,20,0.10)] border border-black/[0.05] focus-within:shadow-[0_22px_65px_rgba(20,20,20,0.16)] transition-shadow duration-500 text-left">
            {/* Animated typing placeholder overlay */}
            {animating && !text && (
              <div className="absolute left-6 top-5 right-16 pointer-events-none text-base truncate" style={{ color: "#9B968D" }}>
                {typed}
                <span className="inline-block w-[1.5px] h-[1.1em] align-[-0.15em] ml-[1px] animate-pulse" style={{ backgroundColor: "#9B968D" }} />
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => { stopAnimation(); setText(e.target.value); }}
              onFocus={stopAnimation}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={animating ? "" : "Scrie aici ce ai nevoie..."}
              rows={2}
              className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none placeholder:text-[#9B968D]"
              style={{ color: "#141414" }}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs hidden sm:block" style={{ color: "#9B968D" }}>
                Descrie pe scurt ce cauti
              </span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all ml-auto shadow-[0_6px_18px_rgba(20,20,20,0.25)]"
                style={{ backgroundColor: "#171717", color: "#FFFFFF" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2B2B2B"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#171717"; }}
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2"
        >
          {EXAMPLES.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="text-sm underline underline-offset-4 transition-colors"
              style={{ color: "#8A857D", textDecorationColor: "#D8D4CC" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#171717";
                e.currentTarget.style.textDecorationColor = "#171717";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8A857D";
                e.currentTarget.style.textDecorationColor = "#D8D4CC";
              }}
            >
              {s.label}
            </Link>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="mt-6 text-xs"
          style={{ color: "#A5A099" }}
        >
          ViaSee nu ofera diagnostic medical.
        </motion.p>
        </>
        )}
      </div>
    </section>
  );
}