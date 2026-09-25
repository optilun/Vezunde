import React, { useEffect, useRef, useState } from "react";
import Hero from "@/components/home/Hero";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import SituationExplainer from "@/components/home/SituationExplainer";
import HowItWorks from "@/components/home/HowItWorks";
import ProCta from "@/components/home/ProCta";
import { useMediaQuery, usePrefersReducedMotion } from "@/lib/motion";

// 2026-09-25. Bannerul „Versiune în dezvoltare” de deasupra primului ecran a fost scos, la cererea
// lui Alex (verify-home-development-banner.mjs verifica acum ca nu revine).

function HomeCanvasBackground() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.68]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(52, 48, 43, 0.20) 0 0.8px, transparent 1.05px)",
          backgroundSize: "20px 20px",
        }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-20rem] z-0 h-[58rem] w-[min(96rem,165vw)] opacity-[0.62]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(45, 42, 38, 0.30) 0 1px, transparent 1.25px)",
          backgroundSize: "17px 17px",
          maskImage:
            "radial-gradient(ellipse 62% 56% at 50% 54%, black 22%, transparent 79%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 62% 56% at 50% 54%, black 22%, transparent 79%)",
          transform:
            "translateX(-50%) perspective(900px) rotateX(61deg) scale(1.08)",
          transformOrigin: "50% 100%",
        }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[34rem]"
        style={{
          background:
            "radial-gradient(ellipse 58% 72% at 50% 0%, rgba(255,255,255,0.76), rgba(248,244,236,0) 74%)",
        }}
      />
    </>
  );
}

function HomeCanvas() {
  return (
    <>
      <HomeCanvasBackground />
      <div className="relative z-10">
        <CategoryShowcase />
        <SituationExplainer />
        <HowItWorks />
        <ProCta />
      </div>
    </>
  );
}

// Efectul de pe desktop: primul ecran ramane pe loc cat timp foaia cu sectiuni urca peste el, apoi
// pagina se deruleaza normal. Totul e derulare nativa (CSS sticky): foaia urca exact cat derulezi,
// fara JavaScript pe fiecare cadru si fara o a doua copie a sectiunilor. Singurul lucru calculat
// la derulare e estomparea usoara a primului ecran (opacity, fara redesenare).
const PIN_DISTANCE = "45svh";
const HEADER_OFFSET_PX = 80;

function useHeroCoverFade(stageRef, heroRef, enabled) {
  useEffect(() => {
    const stage = stageRef.current;
    const hero = heroRef.current;
    if (!enabled || !stage || !hero) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const pinPx = hero.offsetHeight ? stage.offsetHeight - hero.offsetHeight : 0;
      if (pinPx <= 0) return;
      const progress = Math.min(1, Math.max(0, (HEADER_OFFSET_PX - stage.getBoundingClientRect().top) / pinPx));
      hero.style.opacity = String(1 - 0.45 * progress);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      hero.style.opacity = "";
    };
  }, [stageRef, heroRef, enabled]);
}

export default function Home() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const supportsPinnedTakeover = useMediaQuery("(min-width: 1024px) and (min-height: 600px)");
  const pinned = supportsPinnedTakeover && !prefersReducedMotion;
  const [started, setStarted] = useState(false);
  const stageRef = useRef(null);
  const heroRef = useRef(null);
  const pinActive = pinned && !started;
  // Dupa trimiterea cererii din primul ecran, pe desktop ramane doar conversatia.
  const showCanvas = !(pinned && started);

  useHeroCoverFade(stageRef, heroRef, pinActive);

  // Aceeasi structura in toate cazurile: Hero nu se remonteaza (si nu-si pierde textul sau
  // conversatia) cand se schimba dimensiunea ferestrei sau cand incepe cererea.
  return (
    <div className="home-scroll-takeover relative">
      <div ref={stageRef} className="relative">
        <div
          ref={heroRef}
          className={pinActive ? "sticky top-20 z-0 will-change-[opacity]" : "relative"}
        >
          <Hero onStartedChange={setStarted} />
        </div>
        {/* Drumul pe care primul ecran ramane fixat. Trebuie sa fie continut, nu padding: sticky
            se opreste la marginea continutului parintelui. */}
        {pinActive && <div aria-hidden="true" data-home-pin-track="" style={{ height: PIN_DISTANCE }} />}
      </div>

      {showCanvas && (
        <div
          className="relative z-20 -mt-20 isolate overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#F8F4EC] pb-16 shadow-[0_-18px_65px_rgba(28,24,18,0.13)] sm:-mt-24 sm:rounded-t-[2.75rem] lg:-mt-28 lg:rounded-t-[3.25rem]"
          style={pinActive ? { marginTop: `calc(-1 * (${PIN_DISTANCE} + 7rem))` } : undefined}
        >
          <HomeCanvas />
        </div>
      )}
    </div>
  );
}
