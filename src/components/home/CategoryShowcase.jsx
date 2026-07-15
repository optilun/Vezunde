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
      className="mx-auto mt-24 max-w-6xl px-5 sm:mt-32"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.55 }}
        className="border-b border-border pb-8 sm:pb-10"
      >
        <h2
          id="home-categories-title"
          className="font-heading text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl lg:text-5xl"
        >
          Ce poti gasi pe VIASEE
        </h2>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Gaseste locul potrivit pentru nevoia ta.
        </p>
      </motion.div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-9 sm:gap-4 lg:h-[560px] lg:grid-cols-4 lg:grid-rows-2">
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
                ? "col-span-2 aspect-[4/3] min-w-0 lg:row-span-2 lg:aspect-auto"
                : "aspect-[4/5] min-w-0 sm:aspect-square lg:aspect-auto"
            }
          >
            <Link
              to={category.to}
              aria-label={category.title}
              className={`group relative block h-full overflow-hidden rounded-[1.35rem] border shadow-[0_12px_38px_rgba(20,20,20,0.045)] outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(20,20,20,0.08)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transform-none sm:rounded-[1.75rem] ${category.tone}`}
            >
              <span
                aria-hidden="true"
                className={
                  category.featured
                    ? "absolute inset-x-0 top-0 h-[82%]"
                    : "absolute inset-x-0 top-0 h-[69%]"
                }
              >
                <img
                  src={category.artwork}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none"
                />
              </span>

              <span
                className={
                  category.featured
                    ? "absolute inset-x-0 bottom-0 flex flex-col items-start gap-4 p-5 text-[#1c1c1c] sm:gap-5 sm:p-7 lg:p-8"
                    : "absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-4 text-[#1c1c1c] sm:p-5 lg:p-6"
                }
              >
                <span
                  className={
                    category.featured
                      ? "font-heading text-2xl font-bold leading-tight tracking-[-0.025em] sm:text-3xl"
                      : "font-heading text-[15px] font-bold leading-tight tracking-[-0.02em] sm:text-lg lg:text-xl"
                  }
                >
                  {category.title}
                </span>
                <span
                  aria-hidden="true"
                  className={
                    category.featured
                      ? "flex h-11 w-11 items-center justify-center rounded-full border border-current/65 sm:h-12 sm:w-12"
                      : "flex h-8 w-8 items-center justify-center rounded-full border border-current/65 sm:h-9 sm:w-9"
                  }
                >
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none sm:h-[18px] sm:w-[18px]" />
                </span>
              </span>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
