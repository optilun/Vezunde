import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Hero from "@/components/home/Hero";
import CategoryShowcase from "@/components/home/CategoryShowcase";
import SituationExplainer from "@/components/home/SituationExplainer";
import ServicesEditorial from "@/components/home/ServicesEditorial";
import ProvidersShowcase from "@/components/home/ProvidersShowcase";
import ProCta from "@/components/home/ProCta";

export default function Home() {
  const transitionTrackRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: transitionTrackRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 0.55, 1], [1, 0.99, 0.965]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.52, 0.88, 1], [1, 1, 0.58, 0.22]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -18]);

  const heroMotionStyle = prefersReducedMotion
    ? undefined
    : { scale: heroScale, opacity: heroOpacity, y: heroY };

  return (
    <div className="home-scroll-takeover relative">
      <div
        ref={transitionTrackRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[calc(100svh-4rem)] w-px"
      />

      <div
        className={
          prefersReducedMotion
            ? "relative z-0 min-h-[calc(100svh-4rem)] bg-[#F7F2E8] sm:min-h-[92vh]"
            : "sticky top-16 z-0 min-h-[calc(100svh-4rem)] bg-[#F7F2E8] sm:min-h-[92vh]"
        }
      >
        <motion.div
          style={heroMotionStyle}
          className="origin-top will-change-transform motion-reduce:transform-none"
        >
          <Hero />
        </motion.div>
      </div>

      <div className="relative z-20 -mt-20 isolate overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#F8F4EC] pb-16 shadow-[0_-18px_65px_rgba(28,24,18,0.13)] sm:-mt-24 sm:rounded-t-[2.75rem] lg:-mt-28 lg:rounded-t-[3.25rem]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.58]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(52, 48, 43, 0.16) 0 0.8px, transparent 1.05px)",
            backgroundSize: "20px 20px",
          }}
        />

        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-20rem] z-0 h-[58rem] w-[min(96rem,165vw)] opacity-[0.52]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45, 42, 38, 0.25) 0 1px, transparent 1.25px)",
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

        <div className="relative z-10">
          <CategoryShowcase />
          <SituationExplainer />
          <ServicesEditorial />
          <ProvidersShowcase />
          <ProCta />
        </div>
      </div>
    </div>
  );
}
