import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const CATEGORIES = [
  {
    title: "Medici si clinici",
    to: "/cauta",
    image: "/images/home/viasee-category-medici-clinici.svg",
    alt: "Medic oftalmolog discutand cu un pacient intr-un cabinet",
    featured: true,
  },
  {
    title: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    image: "/images/home/viasee-category-control-vedere.svg",
    alt: "Optometrist realizand un control de vedere",
  },
  {
    title: "Investigatii",
    to: "/cerere?categorie=investigatii",
    image: "/images/home/viasee-category-investigatii.svg",
    alt: "Pacient in timpul unei investigatii OCT",
  },
  {
    title: "Ochelari si lentile",
    to: "/cerere?categorie=ochelari_lentile",
    image: "/images/home/viasee-category-ochelari-lentile.svg",
    alt: "Rame de ochelari expuse intr-o optica",
  },
  {
    title: "Reparatii si reglaje",
    to: "/cerere?categorie=reparatii_ochelari",
    image: "/images/home/viasee-category-reparatii-reglaje.svg",
    alt: "Optician reparand o rama de ochelari",
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
                : "aspect-square min-w-0 lg:aspect-auto"
            }
          >
            <Link
              to={category.to}
              aria-label={category.title}
              className="group relative block h-full overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-card shadow-[0_16px_45px_rgba(20,20,20,0.08)] outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_22px_58px_rgba(20,20,20,0.13)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transform-none sm:rounded-[1.75rem]"
            >
              <img
                src={category.image}
                alt={category.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] group-focus-visible:scale-[1.035] motion-reduce:transition-none"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"
              />
              <span
                className={
                  category.featured
                    ? "absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-7 lg:p-8"
                    : "absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white sm:p-5 lg:p-6"
                }
              >
                <span
                  className={
                    category.featured
                      ? "font-heading text-2xl font-bold leading-tight tracking-[-0.025em] drop-shadow-sm sm:text-3xl"
                      : "font-heading text-[15px] font-bold leading-tight tracking-[-0.02em] drop-shadow-sm sm:text-lg lg:text-xl"
                  }
                >
                  {category.title}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:h-6 sm:w-6"
                />
              </span>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
