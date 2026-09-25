import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { prefetchOnIntent } from "@/lib/routePrefetch";

const loadConversationalCard = () => import("@/components/intake2/ConversationalCard");
const ConversationalCard = lazy(loadConversationalCard);

// Formularul conversational se descarca de cum utilizatorul intra in caseta, nu abia la trimitere.
let conversationalCardRequested = false;
function preloadConversationalCard() {
  if (conversationalCardRequested) return;
  conversationalCardRequested = true;
  loadConversationalCard().catch(() => {
    conversationalCardRequested = false;
  });
}

const PROMPTS = [
  "Caut un medic oftalmolog aproape de mine",
  "Caut o clinică de oftalmologie",
  "Văd neclar la distanță",
  "Caut un control de vedere pentru copil",
  "Am recomandare pentru o investigație OCT",
  "Caut lentile progresive",
  "Mi s-au rupt ochelarii",
];

const EXAMPLES = [
  { label: "Caut un medic oftalmolog", to: "/cerere?categorie=consult_oftalmologic" },
  { label: "Control de vedere pentru copil", to: "/cerere?categorie=copii_miopie" },
  { label: "Reparație ochelari", to: "/cerere?categorie=reparatii" },
];

// Exemplele care "se scriu" in caseta. Textul se schimba direct in pagina (fara re-randarea
// componentei la fiecare litera) si animatia sta pe loc cand caseta nu e pe ecran sau fila nu e
// deschisa: altfel ar tine procesorul ocupat tot timpul cat pagina e deschisa.
function TypingPrompt({ active }) {
  const textRef = useRef(null);

  useEffect(() => {
    const node = textRef.current;
    if (!active || !node) return undefined;

    const state = { prompt: 0, char: 0, phase: "typing" };
    let timeout = 0;
    let running = false;
    let visible = true;

    const show = (value) => {
      node.textContent = value;
    };
    const schedule = (ms) => {
      timeout = window.setTimeout(tick, ms);
    };
    function tick() {
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      const full = PROMPTS[state.prompt];
      if (state.phase === "typing") {
        state.char += 1;
        show(full.slice(0, state.char));
        if (state.char >= full.length) {
          state.phase = "pausing";
          schedule(2000);
        } else {
          schedule(38 + Math.random() * 45);
        }
      } else if (state.phase === "pausing") {
        state.phase = "erasing";
        schedule(30);
      } else {
        state.char -= 2;
        if (state.char <= 0) {
          state.char = 0;
          show("");
          state.prompt = (state.prompt + 1) % PROMPTS.length;
          state.phase = "typing";
          schedule(500);
        } else {
          show(full.slice(0, state.char));
          schedule(18);
        }
      }
    }
    const start = (delay = 0) => {
      if (running || !visible || document.hidden) return;
      running = true;
      schedule(delay);
    };

    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
        });
    observer?.observe(node);
    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start(600);

    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  return <span ref={textRef} />;
}

// Mica insigna decorativa cu "ochi", desenata din forme simple (acelasi limbaj vizual ca
// pictogramele de la categorii): irisul respira usor, iar razele din jur se rotesc foarte lent.
function HeroOpticsMark() {
  return (
    <div
      aria-hidden="true"
      className="home-fade-up relative mx-auto mt-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center sm:mt-6 sm:h-[5.25rem] sm:w-[5.25rem]"
      style={{ "--home-delay": "90ms" }}
    >
      <span className="absolute inset-0 rounded-full border border-black/[0.06] bg-white/70 shadow-[0_10px_28px_rgba(20,20,20,0.08)]" />
      <svg viewBox="0 0 100 100" className="hero-optics-spin absolute h-[70%] w-[70%]" fill="none">
        <g stroke="#684d78" strokeWidth="5" strokeLinecap="round" opacity="0.5">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line key={angle} x1="50" y1="5" x2="50" y2="16" transform={`rotate(${angle} 50 50)`} />
          ))}
        </g>
      </svg>
      <svg viewBox="0 0 100 100" className="relative h-[42%] w-[42%]" fill="none">
        <circle cx="50" cy="50" r="34" fill="#684d78" className="hero-optics-pulse" />
        <circle cx="58" cy="42" r="7" fill="#F6F0E8" opacity="0.85" />
        <circle cx="50" cy="50" r="14" fill="#171717" />
      </svg>
    </div>
  );
}

export default function Hero({ onStartedChange } = {}) {
  const [text, setText] = useState("");
  const [animating, setAnimating] = useState(true);
  const [started, setStarted] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    onStartedChange?.(started);
  }, [started, onStartedChange]);

  const submit = (event) => {
    event.preventDefault();
    setStarted(true);
  };

  const stopAnimation = () => setAnimating(false);

  return (
    <section
      className={`relative flex items-center justify-center ${
        started
          ? "min-h-[calc(100svh-4rem)] items-start overflow-visible py-6 sm:min-h-[92vh]"
          : "min-h-[calc(100svh-4rem)] overflow-hidden sm:min-h-[92vh]"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #DCE4F2 0%, #E9ECF4 22%, #F5F3EE 55%, #F7F2E8 100%)",
        }}
      />
      {/* Doua pete de culoare din paleta categoriilor (lavanda + teracota), foarte estompate, ca
          fundalul sa nu mai fie doar alb-albastrui. Stau sub grila de puncte si sub petele albe. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 46% 38% at 14% 18%, rgba(190,169,200,0.32) 0%, transparent 68%), " +
            "radial-gradient(ellipse 42% 34% at 87% 82%, rgba(228,167,134,0.26) 0%, transparent 68%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.56]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(52,48,43,0.16) 0 0.75px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 58% 48% at 50% 40%, transparent 0%, transparent 42%, rgba(0,0,0,0.16) 62%, rgba(0,0,0,0.74) 84%, black 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 58% 48% at 50% 40%, transparent 0%, transparent 42%, rgba(0,0,0,0.16) 62%, rgba(0,0,0,0.74) 84%, black 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-[0.47]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(52,48,43,0.15) 0 0.7px, transparent 0.95px)",
          backgroundSize: "20px 20px",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.12) 28%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.12) 28%, black 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div
        className={`relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-5 ${
          started ? "py-6 sm:py-10" : "py-16 sm:py-28"
        }`}
      >
        {started ? (
          <div className="w-full max-w-2xl text-left">
            <Suspense
              fallback={
                <div
                  className="min-h-[20rem] rounded-[1.5rem] border border-black/[0.06] bg-white/70"
                  role="status"
                  aria-label="Se încarcă formularul"
                />
              }
            >
              <ConversationalCard initialMessage={text.trim()} />
            </Suspense>
          </div>
        ) : (
          <>
            <h1
              className="home-rise font-heading text-balance text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.04em] min-[390px]:text-[2.65rem] sm:text-[4.25rem]"
              style={{ color: "#141414" }}
            >
              Găsește îngrijirea potrivită pentru ochi.
            </h1>

            <p
              className="home-fade-up mt-4 max-w-2xl text-[0.95rem] leading-relaxed sm:mt-5 sm:text-lg"
              style={{ color: "#5F5A53", "--home-delay": "60ms" }}
            >
              Cauți un medic oftalmolog, o clinică sau o optică? VIASEE te ajută să găsești specialistul potrivit, aproape de tine.
            </p>

            <HeroOpticsMark />

            <form
              onSubmit={submit}
              onPointerEnter={preloadConversationalCard}
              onFocus={preloadConversationalCard}
              onTouchStart={preloadConversationalCard}
              className="home-fade-up mt-7 w-full max-w-xl sm:mt-10"
              style={{ "--home-delay": "120ms" }}
            >
              <div className="relative rounded-[1.35rem] border border-black/[0.05] bg-white p-3.5 text-left shadow-[0_18px_55px_rgba(20,20,20,0.10)] transition-shadow duration-500 focus-within:shadow-[0_22px_65px_rgba(20,20,20,0.16)] sm:rounded-[1.5rem] sm:p-4">
                {animating && !text && (
                  <div className="pointer-events-none absolute left-5 right-14 top-4.5 truncate text-[15px] sm:left-6 sm:right-16 sm:top-5 sm:text-base" style={{ color: "#6F6A63" }}>
                    {prefersReducedMotion ? PROMPTS[0] : <TypingPrompt active={animating && !started} />}
                    {!prefersReducedMotion && (
                      <span className="ml-[1px] inline-block h-[1.1em] w-[1.5px] animate-pulse align-[-0.15em]" style={{ backgroundColor: "#6F6A63" }} />
                    )}
                  </div>
                )}
                <textarea
                  value={text}
                  onChange={(event) => { stopAnimation(); setText(event.target.value); }}
                  onFocus={stopAnimation}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) submit(event); }}
                  placeholder={animating ? "" : "Scrie aici ce cauți..."}
                  aria-label="Descrie ce cauți"
                  rows={2}
                  className="w-full resize-none bg-transparent px-1.5 pt-1 text-base outline-none placeholder:text-[#6F6A63] sm:px-2"
                  style={{ color: "#141414" }}
                />
                <div className="mt-2 flex items-center justify-between px-0.5 sm:px-1">
                  <span className="hidden text-xs sm:block" style={{ color: "#6F6A63" }}>
                    Descrie pe scurt ce cauți
                  </span>
                  <button
                    type="submit"
                    aria-label="Trimite"
                    className="ml-auto flex h-11 w-11 touch-manipulation items-center justify-center rounded-full shadow-[0_6px_18px_rgba(20,20,20,0.25)] transition-transform duration-150 hover:scale-105 active:scale-95"
                    style={{ backgroundColor: "#171717", color: "#FFFFFF" }}
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>

            <div
              className="home-fade-up mt-6 grid w-full max-w-xl gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2"
              style={{ "--home-delay": "200ms" }}
            >
              {EXAMPLES.map((example) => (
                <Link
                  key={example.label}
                  to={example.to}
                  {...prefetchOnIntent(example.to)}
                  className="flex min-h-11 items-center justify-center rounded-full border border-black/[0.07] bg-white/50 px-4 text-sm transition-[color,transform] active:scale-[0.98] sm:min-h-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:underline sm:underline-offset-4 sm:active:scale-100"
                  style={{ color: "#5F5A53", textDecorationColor: "#B8B2A9" }}
                >
                  {example.label}
                </Link>
              ))}
            </div>

            <p
              className="home-fade-up mt-5 text-xs sm:mt-6"
              style={{ color: "#6A655E", "--home-delay": "260ms" }}
            >
              Textul este interpretat automat pentru orientare. Nu include date personale. VIASEE nu oferă diagnostic medical.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
