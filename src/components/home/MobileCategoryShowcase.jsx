import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const MOBILE_CATEGORIES = [
  {
    title: "Medici și clinici",
    description: "Consultații și specialiști pentru sănătatea ochilor.",
    to: "/cauta",
    artwork: "/images/home/viasee-artwork-medici-clinici.svg",
    tone: "border-[#d4c6d8]/80 bg-[#e8e0ea]/90",
    featured: true,
  },
  {
    title: "Control de vedere",
    description: "Evaluarea vederii și a corecției optice.",
    to: "/cerere?categorie=control_vedere",
    artwork: "/images/home/viasee-artwork-control-vedere.svg",
    tone: "border-[#c6d3da]/80 bg-[#dce5e9]/90",
  },
  {
    title: "Investigații",
    description: "Investigații recomandate de specialist.",
    to: "/cerere?categorie=investigatii",
    artwork: "/images/home/viasee-artwork-investigatii.svg",
    tone: "border-[#ccd2ba]/80 bg-[#dfe3d2]/90",
  },
  {
    title: "Ochelari și lentile",
    description: "Soluții optice potrivite nevoilor tale.",
    to: "/cerere?categorie=ochelari_lentile",
    artwork: "/images/home/viasee-artwork-ochelari-lentile.svg",
    tone: "border-[#e1bda8]/80 bg-[#efd5c5]/90",
  },
  {
    title: "Reparații și reglaje",
    description: "Ajutor pentru rame, lentile și ajustări.",
    to: "/cerere?categorie=reparatii_ochelari",
    artwork: "/images/home/viasee-artwork-reparatii-reglaje.svg",
    tone: "border-[#dac69b]/80 bg-[#eadcba]/90",
    wide: true,
  },
];

export default function MobileCategoryShowcase({ preview = false }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:hidden">
      {MOBILE_CATEGORIES.map((category, index) => (
        <motion.article
          key={category.title}
          initial={preview || prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.42, delay: index * 0.04 }}
          className={`${category.featured || category.wide ? "col-span-2" : ""}`}
        >
          <Link
            to={category.to}
            className={`group relative grid min-h-[9.5rem] overflow-hidden rounded-[1.25rem] border p-4 shadow-[0_10px_28px_rgba(34,30,24,0.035)] outline-none transition-transform active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-3 focus-visible:ring-offset-[#F8F4EC] ${category.tone} ${
              category.featured
                ? "grid-cols-[minmax(0,1fr)_8.5rem] items-center min-[390px]:grid-cols-[minmax(0,1fr)_10rem]"
                : category.wide
                  ? "grid-cols-[minmax(0,1fr)_7rem] items-center"
                  : "grid-rows-[6.5rem_auto]"
            }`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-25 mix-blend-multiply"
              style={{
                backgroundImage: "url('/images/home/viasee-technical-grain.svg')",
                backgroundSize: "180px 180px",
              }}
            />

            <span
              className={`relative z-10 ${
                category.featured || category.wide ? "pr-2" : "order-2 mt-2"
              }`}
            >
              <span className="block font-heading text-[1.15rem] font-bold leading-[1.05] tracking-[-0.03em] text-[#1c1c1c] min-[390px]:text-[1.3rem]">
                {category.title}
              </span>
              <span className="mt-2 block text-[0.78rem] leading-[1.35] text-[#5f5a53]">
                {category.description}
              </span>
            </span>

            <span
              aria-hidden="true"
              className={`relative z-10 overflow-hidden ${
                category.featured
                  ? "h-[8.5rem]"
                  : category.wide
                    ? "h-[6.8rem]"
                    : "order-1 h-[6.5rem]"
              }`}
            >
              <img
                src={category.artwork}
                width="214"
                height="150"
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain object-center"
              />
            </span>

            <span className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/45 text-[#171717] backdrop-blur-sm">
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </motion.article>
      ))}
    </div>
  );
}
