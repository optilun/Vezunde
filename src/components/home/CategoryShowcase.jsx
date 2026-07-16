import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const CATEGORIES = [
  {
    title: "Medici și clinici",
    to: "/cauta",
    artwork: "/images/home/viasee-artwork-medici-clinici.svg",
    tone: "border-[#d4c6d8]/80 bg-[#e8e0ea]/90",
    ambient: "bg-[#bea9c8]/32",
    artworkScale: "scale-[1.01] group-hover:scale-[1.025] group-focus-visible:scale-[1.025] lg:scale-[1.18] lg:group-hover:scale-[1.21] lg:group-focus-visible:scale-[1.21]",
    desktopPlacement: "lg:col-[1/4] lg:row-[1/4]",
    desktopLabel: "lg:text-xl",
  },
  {
    title: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    artwork: "/images/home/viasee-artwork-control-vedere.svg",
    tone: "border-[#c6d3da]/80 bg-[#dce5e9]/90",
    ambient: "bg-[#a9c6d7]/30",
    artworkScale: "scale-[1.06] group-hover:scale-[1.08] group-focus-visible:scale-[1.08] lg:scale-[1.12] lg:group-hover:scale-[1.15] lg:group-focus-visible:scale-[1.15]",
    desktopPlacement: "lg:col-[4/6] lg:row-[2/4]",
    desktopLabel: "lg:text-[1.05rem]",
  },
  {
    title: "Investigații",
    to: "/cerere?categorie=investigatii",
    artwork: "/images/home/viasee-artwork-investigatii.svg",
    tone: "border-[#ccd2ba]/80 bg-[#dfe3d2]/90",
    ambient: "bg-[#bdc8a4]/28",
    artworkScale: "scale-[1.04] group-hover:scale-[1.06] group-focus-visible:scale-[1.06] lg:scale-[1.18] lg:group-hover:scale-[1.21] lg:group-focus-visible:scale-[1.21]",
    desktopPlacement: "lg:col-[6/8] lg:row-[1/4]",
    desktopLabel: "lg:text-lg",
  },
  {
    title: "Ochelari și lentile",
    to: "/cerere?categorie=ochelari_lentile",
    artwork: "/images/home/viasee-artwork-ochelari-lentile.svg",
    tone: "border-[#e1bda8]/80 bg-[#efd5c5]/90",
    ambient: "bg-[#e4a786]/28",
    artworkScale: "scale-[1.03] group-hover:scale-[1.05] group-focus-visible:scale-[1.05] lg:scale-[1.18] lg:group-hover:scale-[1.21] lg:group-focus-visible:scale-[1.21]",
    desktopPlacement: "lg:col-[8/11] lg:row-[1/4]",
    desktopLabel: "lg:text-lg",
  },
  {
    title: "Reparații și reglaje",
    to: "/cerere?categorie=reparatii_ochelari",
    artwork: "/images/home/viasee-artwork-reparatii-reglaje.svg",
    tone: "border-[#dac69b]/80 bg-[#eadcba]/90",
    ambient: "bg-[#d3b565]/28",
    artworkScale: "scale-[1.08] group-hover:scale-[1.1] group-focus-visible:scale-[1.1] lg:scale-[1.12] lg:group-hover:scale-[1.15] lg:group-focus-visible:scale-[1.15]",
    desktopPlacement: "lg:col-[11/13] lg:row-[2/4]",
    desktopLabel: "lg:text-base xl:text-[1.05rem]",
  },
];

function ShapeTile({ type, className = "", preview, reducedMotion }) {
  const palette = {
    gear: "border-[#274bac] bg-[#345bc8] text-[#f6f1e8]",
    flower: "border-[#cc5522] bg-[#e86827] text-[#f8e7d5]",
    pupil: "border-[#584266] bg-[#684d78] text-[#f6f0e8]",
  };

  return (
    <motion.div
      aria-hidden="true"
      initial={preview || reducedMotion ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.65 }}
      transition={{ duration: 0.45, delay: 0.12 }}
      className={`relative hidden overflow-hidden rounded-[1.25rem] border shadow-[0_12px_32px_rgba(20,20,20,0.06)] lg:grid lg:place-items-center ${palette[type]} ${className}`}
    >
      <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-current opacity-35" />
      <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-current opacity-35" />
      <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-current opacity-35" />
      <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-current opacity-35" />

      {type === "gear" && (
        <svg viewBox="0 0 100 100" className="h-[68%] w-[68%]" fill="none">
          <g fill="currentColor">
            {[0, 45, 90, 135].map((rotation) => (
              <rect
                key={rotation}
                x="43"
                y="7"
                width="14"
                height="86"
                rx="5"
                transform={`rotate(${rotation} 50 50)`}
              />
            ))}
            <circle cx="50" cy="50" r="31" />
          </g>
          <rect x="40" y="40" width="20" height="20" rx="3" fill="#345bc8" />
        </svg>
      )}

      {type === "flower" && (
        <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" fill="currentColor">
          <circle cx="50" cy="25" r="20" />
          <circle cx="75" cy="50" r="20" />
          <circle cx="50" cy="75" r="20" />
          <circle cx="25" cy="50" r="20" />
          <rect x="42" y="42" width="16" height="16" rx="2" fill="#e86827" />
        </svg>
      )}

      {type === "pupil" && (
        <svg viewBox="0 0 180 90" className="h-[72%] w-[72%]" fill="none">
          <circle cx="90" cy="45" r="31" stroke="currentColor" strokeWidth="12" />
          <circle cx="100" cy="52" r="9" fill="currentColor" />
          <path d="M20 45H50M130 45H160" stroke="currentColor" strokeWidth="2" opacity="0.45" />
        </svg>
      )}
    </motion.div>
  );
}

function SageMark() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#a9b491] bg-[#cfd8ba] text-[#73825e] xl:grid"
    >
      <svg viewBox="0 0 48 48" className="h-7 w-7" fill="currentColor">
        <circle cx="24" cy="13" r="8" />
        <circle cx="35" cy="24" r="8" />
        <circle cx="24" cy="35" r="8" />
        <circle cx="13" cy="24" r="8" />
        <rect x="21" y="21" width="6" height="6" rx="1" fill="#cfd8ba" />
      </svg>
    </span>
  );
}

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
      <div className="relative z-10 mx-auto max-w-[84rem] px-5">
        <motion.div
          initial={preview || prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55 }}
          className="text-center"
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:text-[11px]">
            Servicii și specialiști
          </p>
          <h2
            id={headingId}
            className="mx-auto mt-4 max-w-[68rem] font-heading text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.055em] min-[390px]:text-[2.7rem] sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]"
          >
            <span className="block lg:whitespace-nowrap">
              Tot ce ai nevoie pentru vedere.
            </span>
            <span className="block">Într-un singur loc.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Medici, clinici, controale, investigații, ochelari și reparații.
          </p>
        </motion.div>

        <div className="relative -mx-5 mt-9 flex snap-x snap-mandatory items-end gap-3 overflow-x-auto px-5 pb-4 scroll-px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-10 sm:gap-4 lg:mx-0 lg:grid lg:grid-cols-12 lg:grid-rows-[6rem_10.5rem_4.5rem] lg:items-stretch lg:gap-3.5 lg:overflow-visible lg:px-0 lg:pb-0 xl:gap-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -right-8 top-[58%] z-0 hidden h-px bg-[#9a8668]/45 lg:block"
          />
          {[23.35, 39.35, 55.55, 79.2].map((position) => (
            <span
              key={position}
              aria-hidden="true"
              className="pointer-events-none absolute top-[calc(58%_-_4px)] z-20 hidden h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-[#8d7658] bg-[#f8f4ec] lg:block"
              style={{ left: `${position}%` }}
            />
          ))}

          <ShapeTile
            type="gear"
            className="lg:col-[4/5] lg:row-[1/2]"
            preview={preview}
            reducedMotion={prefersReducedMotion}
          />
          <ShapeTile
            type="flower"
            className="lg:col-[5/6] lg:row-[1/2]"
            preview={preview}
            reducedMotion={prefersReducedMotion}
          />
          <ShapeTile
            type="pupil"
            className="lg:col-[11/13] lg:row-[1/2]"
            preview={preview}
            reducedMotion={prefersReducedMotion}
          />

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
              className={`group relative z-10 min-w-[78vw] shrink-0 snap-start sm:min-w-[46vw] lg:min-w-0 ${category.desktopPlacement}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -inset-x-3 -inset-y-5 z-0 rounded-[2.5rem] opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${category.ambient}`}
              />
              <Link
                to={category.to}
                aria-label={category.title}
                className={`group relative z-10 grid h-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[1.35rem] border shadow-[0_10px_30px_rgba(34,30,24,0.028)] backdrop-blur-[2px] outline-none transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(34,30,24,0.06)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:rounded-[1.65rem] ${category.tone}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-35 mix-blend-multiply"
                  style={{
                    backgroundImage:
                      "url('/images/home/viasee-technical-grain.svg')",
                    backgroundSize: "180px 180px",
                  }}
                />

                <span aria-hidden="true" className="relative z-10 aspect-[214/150] overflow-hidden p-1.5 sm:p-2 lg:aspect-auto lg:min-h-0 lg:p-2">
                  <img
                    src={category.artwork}
                    width="214"
                    height="150"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-contain object-center transition-transform duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none ${category.artworkScale}`}
                  />
                </span>

                <span className="relative z-20 flex min-h-[4.25rem] items-center gap-3 border-t border-black/[0.07] bg-white/[0.045] px-5 py-3 text-left text-[#1c1c1c] sm:min-h-[4.75rem] sm:px-6 lg:min-h-[4.5rem] lg:px-4 xl:px-5">
                  {index === 4 && <SageMark />}
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
          className="mt-8 flex justify-center sm:mt-10 lg:mt-11"
        >
          <Link
            to="/cerere"
            aria-label="Alege ce cauți și trimite o cerere"
            className="group inline-flex min-h-14 items-center gap-5 rounded-full bg-[#171717] py-2 pl-7 pr-2 text-white shadow-[0_16px_38px_rgba(18,18,18,0.15)] outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(18,18,18,0.2)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-8 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none sm:min-h-[4.5rem] sm:gap-8 sm:pl-10"
          >
            <span
              aria-hidden="true"
              className="order-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f8f4ec] text-[#171717] sm:h-14 sm:w-14"
            >
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none sm:h-7 sm:w-7" />
            </span>
            <span className="font-heading text-2xl font-bold leading-none tracking-[-0.035em] sm:text-[2rem]">
              Alege ce cauți
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
