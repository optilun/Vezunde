import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import Hero from "@/components/home/Hero";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import SituationExplainer from "@/components/home/SituationExplainer";
import HowItWorks from "@/components/home/HowItWorks";
import ProCta from "@/components/home/ProCta";

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

function HomeCanvas({ preview = false }) {
  return (
    <>
      <HomeCanvasBackground />
      <div className="relative z-10">
        <CategoryShowcase preview={preview} />
        {!preview && (
          <>
            <SituationExplainer />
            <HowItWorks />
            <ProCta />
          </>
        )}
      </div>
    </>
  );
}

function PinnedTakeover() {
  const sceneRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start 64px", "end end"],
  });

  const sheetY = useTransform(
    scrollYProgress,
    [0, 1],
    ["calc(100% - 5rem)", "0%"],
  );
  const previewContentOpacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.22],
    [0, 0, 1],
  );
  const heroScale = useTransform(
    scrollYProgress,
    [0, 0.55, 1],
    [1, 0.99, 0.965],
  );
  const heroOpacity = useTransform(
    scrollYProgress,
    [0, 0.45, 0.9, 1],
    [1, 1, 0.5, 0],
  );
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -18]);
  const heroPointerEvents = useTransform(scrollYProgress, (value) =>
    value > 0.96 ? "none" : "auto",
  );
  const stageVisibility = useTransform(scrollYProgress, (value) =>
    value >= 0.999 ? "hidden" : "visible",
  );

  return (
    <>
      <section
        ref={sceneRef}
        aria-label="Tranziție către conținutul homepage-ului"
        className="pointer-events-none relative z-30 h-[calc(170svh-4rem)]"
      >
        <motion.div
          style={{ visibility: stageVisibility }}
          className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 origin-top will-change-transform"
            style={{
              scale: heroScale,
              opacity: heroOpacity,
              y: heroY,
              pointerEvents: heroPointerEvents,
            }}
          >
            <Hero />
          </motion.div>

          <motion.div
            style={{ y: sheetY }}
            className="pointer-events-none absolute inset-0 z-20 isolate overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#F8F4EC] shadow-[0_-18px_65px_rgba(28,24,18,0.13)] will-change-transform sm:rounded-t-[2.75rem] lg:rounded-t-[3.25rem]"
          >
            <motion.div
              aria-hidden="true"
              inert=""
              style={{ opacity: previewContentOpacity }}
              className="pointer-events-none min-h-full"
            >
              <HomeCanvas preview />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <div className="relative z-20 mt-[calc(-100svh+4rem)] isolate overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#F8F4EC] pb-16 shadow-[0_-18px_65px_rgba(28,24,18,0.13)] sm:rounded-t-[2.75rem] lg:rounded-t-[3.25rem]">
        <HomeCanvas />
      </div>
    </>
  );
}

function StaticTakeover() {
  return (
    <>
      <Hero />
      <div className="relative z-20 -mt-20 isolate overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#F8F4EC] pb-16 shadow-[0_-18px_65px_rgba(28,24,18,0.13)] sm:-mt-24 sm:rounded-t-[2.75rem] lg:-mt-28 lg:rounded-t-[3.25rem]">
        <HomeCanvas />
      </div>
    </>
  );
}

function usePinnedTakeoverSupport() {
  const mediaQuery = "(min-width: 768px) and (min-height: 600px)";
  const [supported, setSupported] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(mediaQuery).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const onChange = (event) => setSupported(event.matches);
    setSupported(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return supported;
}

export default function Home() {
  const prefersReducedMotion = useReducedMotion();
  const supportsPinnedTakeover = usePinnedTakeoverSupport();

  return (
    <div className="home-scroll-takeover relative">
      {prefersReducedMotion || !supportsPinnedTakeover ? (
        <StaticTakeover />
      ) : (
        <PinnedTakeover />
      )}
    </div>
  );
}
