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
    artworkScale: "scale-[1.01] group-hover:scale-[1.025] group-focus-visible:scale-[1.025]",
    desktopLabel: "lg:text-xl",
  },
  {
    title: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    artwork: "/images/home/viasee-artwork-control-vedere.svg",
    tone: "border-[#c6d3da] bg-[#dce5e9]",
    artworkScale: "scale-[1.06] group-hover:scale-[1.08] group-focus-visible:scale-[1.08]",
    desktopLabel: "lg:text-[1.05rem]",
  },
  {
    title: "Investigatii",
    to: "/cerere?categorie=investigatii",
    artwork: "/images/home/viasee-artwork-investigatii.svg",
    tone: "border-[#ccd2ba] bg-[#dfe3d2]",
    artworkScale: "scale-[1.04] group-hover:scale-[1.06] group-focus-visible:scale-[1.06]",
    desktopLabel: "lg:text-lg",
  },
  {
    title: "Ochelari si lentile",
    to: "/cerere?categorie=ochelari_lentile",
    artwork: "/images/home/viasee-artwork-ochelari-lentile.svg",
    tone: "border-[#e1bda8] bg-[#efd5c5]",
    artworkScale: "scale-[1.03] group-hover:scale-[1.05] group-focus-visible:scale-[1.05]",
    desktopLabel: "lg:text-lg",
  },
  {
    title: "Reparatii si reglaje",
    to: "/cerere?categorie=reparatii_ochelari",
    artwork: "/images/home/viasee-artwork-reparatii-reglaje.svg",
    tone: "border-[#dac69b] bg-[#eadcba]",
    artworkScale: "scale-[1.08] group-hover:scale-[1.1] group-focus-visible:scale-[1.1]",
    desktopLabel: "lg:text-base xl:text-[1.05rem]",
  },
];

export default function CategoryShowcase({ preview = false }) {
  const prefersReducedMotion = useReducedMotion();
  const headingId = preview
    ? "home-categories-preview-title"
    : "home-categories-title";

  return (
    <section
      aria-labelledby={headingId}
      className="relative pb-8 pt-10 sm:pb-10 sm:pt-12 lg:pb-14 lg:pt-12"
    >
      <div className="relative z-10 mx-auto max-w-[78rem] px-5">
        <motion.div
          initial={preview || prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55 }}
          className="text-center"
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:text-[11px]">
            Servicii si specialisti
          </p>
          <h2
            id={headingId}
            className="mx-auto mt-4 max-w-[68rem] font-heading text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.055em] min-[390px]:text-[2.7rem] sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]"
          >
            <span className="block lg:whitespace-nowrap">
              Tot ce ai nevoie pentru vedere.
            </span>
            <span className="block">Intr-un singur loc.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Medici, clinici, controale, investigatii, ochelari si reparatii.
          </p>
        </motion.div>

        <div className="-mx-5 mt-9 flex snap-x snap-mandatory items-end gap-3 overflow-x-auto px-5 pb-4 scroll-px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-10 sm:gap-4 lg:mx-0 lg:grid lg:grid-cols-[1.8fr_1.15fr_1.25fr_1.5fr_1.15fr] lg:items-end lg:gap-3.5 lg:overflow-visible lg:px-0 lg:pb-0 xl:gap-4">
          {CATEGORIES.map((category, index) => (
            <motion.article
              key={category.title}
              initial={preview || prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.55,
                delay: preview || prefersReducedMotion ? 0 : index * 0.06,
              }}
              className="min-w-[78vw] shrink-0 snap-start sm:min-w-[46vw] lg:min-w-0"
            >
              <Link
                to={category.to}
                aria-label={category.title}
                className={`group relative grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[1.35rem] border shadow-[0_12px_38px_rgba(20,20,20,0.035)] outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(20,20,20,0.075)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:rounded-[1.65rem] ${category.tone}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-45 mix-blend-multiply"
                  style={{
                    backgroundImage:
                      "url('/images/home/viasee-technical-grain.svg')",
                    backgroundSize: "180px 180px",
                  }}
                />

                <span aria-hidden="true" className="relative z-10 aspect-[214/150] overflow-hidden p-1.5 sm:p-2">
                  <img
                    src={category.artwork}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-contain object-center transition-transform duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${category.artworkScale}`}
                  />
                </span>

                <span className="relative z-20 flex min-h-[4.25rem] items-center border-t border-black/[0.055] px-5 py-3 text-left text-[#1c1c1c] sm:min-h-[4.75rem] sm:px-6 lg:min-h-[4.25rem] lg:px-4 xl:min-h-[4.5rem] xl:px-5">
                  <span className={`font-heading text-xl font-bold leading-[1.08] tracking-[-0.025em] sm:text-2xl ${category.desktopLabel}`}>
                    {category.title}
                  </span>
                </span>
              </Link>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={preview || prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.65 }}
          transition={{ duration: 0.55, delay: preview || prefersReducedMotion ? 0 : 0.18 }}
          className="mt-8 flex justify-center sm:mt-10 lg:mt-12"
        >
          <Link
            to="/cerere"
            aria-label="Alege ce cauti si trimite o cerere"
            className="group inline-flex min-h-14 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-8 focus-visible:ring-offset-[#F8F4EC] sm:gap-5"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-foreground sm:h-14 sm:w-14 lg:h-[3.75rem] lg:w-[3.75rem]"
            >
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none sm:h-7 sm:w-7" />
            </span>
            <span className="border-b-[3px] border-foreground pb-1 font-heading text-[2.2rem] font-extrabold leading-none tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Alege ce cauti
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
