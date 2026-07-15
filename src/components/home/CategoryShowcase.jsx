import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const CATEGORIES = [
  {
    title: "Medici si clinici",
    to: "/cauta",
    artwork: "/images/home/viasee-artwork-medici-clinici.svg",
    tone: "border-[#d4c6d8] bg-[#e8e0ea]",
    featured: true,
  },
  {
    title: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    artwork: "/images/home/viasee-artwork-control-vedere.svg",
    tone: "border-[#c6d3da] bg-[#dce5e9]",
  },
  {
    title: "Investigatii",
    to: "/cerere?categorie=investigatii",
    artwork: "/images/home/viasee-artwork-investigatii.svg",
    tone: "border-[#ccd2ba] bg-[#dfe3d2]",
  },
  {
    title: "Ochelari si lentile",
    to: "/cerere?categorie=ochelari_lentile",
    artwork: "/images/home/viasee-artwork-ochelari-lentile.svg",
    tone: "border-[#e1bda8] bg-[#efd5c5]",
  },
  {
    title: "Reparatii si reglaje",
    to: "/cerere?categorie=reparatii_ochelari",
    artwork: "/images/home/viasee-artwork-reparatii-reglaje.svg",
    tone: "border-[#dac69b] bg-[#eadcba]",
  },
];

export default function CategoryShowcase() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="home-categories-title"
      className="relative isolate overflow-hidden pb-4 pt-20 sm:pb-8 sm:pt-28 lg:pt-32"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-19rem] z-0 h-[54rem] w-[min(92rem,155vw)] opacity-[0.55] sm:top-[-17rem]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(45, 42, 38, 0.28) 0 1px, transparent 1.2px)",
          backgroundSize: "18px 18px",
          maskImage:
            "radial-gradient(ellipse 62% 54% at 50% 54%, black 24%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 62% 54% at 50% 54%, black 24%, transparent 78%)",
          transform:
            "translateX(-50%) perspective(850px) rotateX(61deg) scale(1.08)",
          transformOrigin: "50% 100%",
        }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[32rem]"
        style={{
          background:
            "radial-gradient(ellipse 52% 70% at 50% 20%, rgba(255,255,255,0.72), rgba(247,242,232,0) 72%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55 }}
          className="grid gap-5 border-t border-black/[0.09] pt-5 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-12"
        >
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 sm:text-[11px]">
              Servicii si specialisti
            </p>
            <h2
              id="home-categories-title"
              className="mt-3 max-w-3xl font-heading text-3xl font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-4xl lg:text-5xl"
            >
              Ce poti gasi pe VIASEE
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg lg:justify-self-end lg:text-right">
            De la un medic sau un control de vedere pana la ochelari,
            investigatii si reparatii.
          </p>
        </motion.div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:h-[584px] lg:grid-cols-4 lg:grid-rows-2">
          {CATEGORIES.map((category, index) => (
            <motion.article
              key={category.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.5,
                delay: prefersReducedMotion ? 0 : index * 0.06,
              }}
              className={
                category.featured
                  ? "col-span-2 aspect-[7/5] min-w-0 lg:row-span-2 lg:aspect-auto"
                  : "aspect-[5/6] min-w-0 sm:aspect-square lg:aspect-auto"
              }
            >
              <Link
                to={category.to}
                aria-label={category.title}
                className={`group relative grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[1.35rem] border shadow-[0_12px_38px_rgba(20,20,20,0.04)] outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(20,20,20,0.075)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transform-none sm:rounded-[1.75rem] ${category.tone}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-50 mix-blend-multiply"
                  style={{
                    backgroundImage:
                      "url('/images/home/viasee-technical-grain.svg')",
                    backgroundSize: "180px 180px",
                  }}
                />

                <span
                  aria-hidden="true"
                  className={
                    category.featured
                      ? "relative z-10 min-h-0 overflow-hidden px-2 pt-3 sm:px-4 sm:pt-4 lg:px-5 lg:pt-5"
                      : "relative z-10 min-h-0 overflow-hidden px-1.5 pt-2 sm:px-3 sm:pt-3"
                  }
                >
                  <img
                    src={category.artwork}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.012] group-focus-visible:scale-[1.012] motion-reduce:transition-none"
                  />
                </span>

                <span
                  className={
                    category.featured
                      ? "relative z-20 flex items-end justify-between gap-5 p-5 pt-3 text-[#1c1c1c] sm:p-7 sm:pt-4 lg:p-8 lg:pt-5"
                      : "relative z-20 flex items-end justify-between gap-2.5 p-4 pt-2 text-[#1c1c1c] sm:p-5 sm:pt-3 lg:p-6 lg:pt-3"
                  }
                >
                  <span
                    className={
                      category.featured
                        ? "font-heading text-2xl font-bold leading-tight tracking-[-0.025em] sm:text-3xl"
                        : "font-heading text-[15px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-lg lg:text-xl"
                    }
                  >
                    {category.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className={
                      category.featured
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1c1c1c]/55 sm:h-12 sm:w-12"
                        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1c1c1c]/55 sm:h-9 sm:w-9"
                    }
                  >
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none sm:h-[18px] sm:w-[18px]" />
                  </span>
                </span>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
