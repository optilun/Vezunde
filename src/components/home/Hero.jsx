import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import ConversationalCard from "@/components/intake2/ConversationalCard";

const PROMPTS = [
  "Caut un medic oftalmolog aproape de mine",
  "Caut o clinica de oftalmologie",
  "Vad neclar la distanta",
  "Caut un control de vedere pentru copil",
  "Am recomandare pentru o investigatie OCT",
  "Caut lentile progresive",
  "Mi s-au rupt ochelarii",
];

const EXAMPLES = [
  { label: "Caut un medic oftalmolog", to: "/cerere?categorie=consult_oftalmologic" },
  { label: "Control de vedere pentru copil", to: "/cerere?categorie=copii_miopie" },
  { label: "Reparatie ochelari", to: "/cerere?categorie=reparatii" },
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
  const prefersReducedMotion = useReducedMotion();
  const typed = useTypingPlaceholder(animating && !started && !prefersReducedMotion);
  const promptPreview = prefersReducedMotion ? PROMPTS[0] : typed;

  const submit = (event) => {
    event.preventDefault();
    setStarted(true);
  };

  const stopAnimation = () => setAnimating(false);

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden sm:min-h-[92vh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #DCE4F2 0%, #E9ECF4 22%, #F5F3EE 55%, #F7F2E8 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-5 sm:py-28">
        {started ? (
          <div className="w-full max-w-2xl text-left">
            <ConversationalCard initialMessage={text.trim()} />
          </div>
        ) : (
          <>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="font-heading text-[2.25rem] font-extrabold leading-[1.02] tracking-[-0.04em] min-[390px]:text-[2.65rem] sm:text-[4.25rem]"
              style={{ color: "#141414" }}
            >
              Spune ce cauti.
              <br />
              Vezi unde poti merge.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed sm:mt-5 sm:text-lg"
              style={{ color: "#6B675F" }}
            >
              VIASEE te ajuta sa gasesti medici oftalmologi, clinici si optici pentru controale, investigatii, ochelari sau reparatii.
            </motion.p>

            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: "easeOut" }}
              className="mt-7 w-full max-w-xl sm:mt-10"
            >
              <div className="relative rounded-[1.35rem] border border-black/[0.05] bg-white p-3.5 text-left shadow-[0_18px_55px_rgba(20,20,20,0.10)] transition-shadow duration-500 focus-within:shadow-[0_22px_65px_rgba(20,20,20,0.16)] sm:rounded-[1.5rem] sm:p-4">
                {animating && !text && (
                  <div className="pointer-events-none absolute left-5 right-14 top-4.5 truncate text-[15px] sm:left-6 sm:right-16 sm:top-5 sm:text-base" style={{ color: "#9B968D" }}>
                    {promptPreview}
                    {!prefersReducedMotion && (
                      <span className="ml-[1px] inline-block h-[1.1em] w-[1.5px] animate-pulse align-[-0.15em]" style={{ backgroundColor: "#9B968D" }} />
                    )}
                  </div>
                )}
                <textarea
                  value={text}
                  onChange={(event) => { stopAnimation(); setText(event.target.value); }}
                  onFocus={stopAnimation}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) submit(event); }}
                  placeholder={animating ? "" : "Scrie aici ce cauti..."}
                  rows={2}
                  className="w-full resize-none bg-transparent px-1.5 pt-1 text-base outline-none placeholder:text-[#9B968D] sm:px-2"
                  style={{ color: "#141414" }}
                />
                <div className="mt-2 flex items-center justify-between px-0.5 sm:px-1">
                  <span className="hidden text-xs sm:block" style={{ color: "#9B968D" }}>
                    Descrie pe scurt ce cauti
                  </span>
                  <button
                    type="submit"
                    aria-label="Trimite"
                    className="ml-auto flex h-11 w-11 touch-manipulation items-center justify-center rounded-full shadow-[0_6px_18px_rgba(20,20,20,0.25)] transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: "#171717", color: "#FFFFFF" }}
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </motion.form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.85 }}
              className="mt-6 grid w-full max-w-xl gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2"
            >
              {EXAMPLES.map((example) => (
                <Link
                  key={example.label}
                  to={example.to}
                  className="flex min-h-11 items-center justify-center rounded-full border border-black/[0.07] bg-white/50 px-4 text-sm transition-colors sm:min-h-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:underline sm:underline-offset-4"
                  style={{ color: "#8A857D", textDecorationColor: "#D8D4CC" }}
                >
                  {example.label}
                </Link>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.0 }}
              className="mt-5 text-xs sm:mt-6"
              style={{ color: "#A5A099" }}
            >
              VIASEE nu ofera diagnostic medical.
            </motion.p>
          </>
        )}
      </div>
    </section>
  );
}
