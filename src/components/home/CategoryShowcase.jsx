import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const artworkMotion =
  "h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.018] group-focus-visible:scale-[1.018] motion-reduce:transition-none";

function DirectoryArtwork() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid meet"
      className={artworkMotion}
    >
      <defs>
        <pattern id="directory-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#6f5c79" opacity="0.2" />
        </pattern>
        <linearGradient id="directory-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a994b3" stopOpacity="0.52" />
          <stop offset="1" stopColor="#d8cbdc" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="directory-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8c7398" />
          <stop offset="1" stopColor="#6d5579" />
        </linearGradient>
      </defs>

      <rect width="800" height="600" fill="url(#directory-dots)" opacity="0.55" />

      <g fill="none" stroke="#796584" strokeWidth="1.2" opacity="0.23">
        <path d="M52 42 222 145 373 58 536 156 746 44" />
        <path d="M31 235 173 187 329 272 482 189 768 259" />
        <path d="M109 369 244 310 387 386 541 316 754 412" />
        <path d="M176 21 246 178 192 325 307 461" />
        <path d="M516 24 465 156 546 285 489 463" />
        <circle cx="222" cy="145" r="4" fill="#796584" />
        <circle cx="373" cy="58" r="4" fill="#796584" />
        <circle cx="482" cy="189" r="4" fill="#796584" />
        <circle cx="244" cy="310" r="4" fill="#796584" />
      </g>

      <g className="origin-[76%_42%] transition-transform duration-700 ease-out group-hover:rotate-[2deg] group-focus-visible:rotate-[2deg] motion-reduce:transition-none">
        <circle cx="620" cy="248" r="150" fill="none" stroke="#75617f" strokeWidth="2" opacity="0.24" />
        <circle cx="620" cy="248" r="137" fill="url(#directory-lens)" stroke="#806b89" strokeWidth="2" opacity="0.9" />
        <circle cx="620" cy="248" r="117" fill="none" stroke="#f8f4f2" strokeWidth="5" opacity="0.76" />
        <g transform="translate(620 248)" fill="#f7f2ef" opacity="0.72">
          <path d="M0 0 0-112A112 112 0 0 1 79-79Z" />
          <path d="M0 0 79-79A112 112 0 0 1 112 0Z" opacity="0.72" />
          <path d="M0 0 112 0A112 112 0 0 1 79 79Z" opacity="0.5" />
          <path d="M0 0 79 79A112 112 0 0 1 0 112Z" opacity="0.32" />
          <path d="M0 0 0 112A112 112 0 0 1-79 79Z" opacity="0.44" />
          <path d="M0 0-79 79A112 112 0 0 1-112 0Z" opacity="0.58" />
          <path d="M0 0-112 0A112 112 0 0 1-79-79Z" opacity="0.72" />
          <path d="M0 0-79-79A112 112 0 0 1 0-112Z" opacity="0.88" />
        </g>
        <circle cx="620" cy="248" r="48" fill="#ebe3e8" stroke="#7a6484" strokeWidth="2" opacity="0.96" />
      </g>

      <g className="transition-transform duration-500 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none">
        <g transform="translate(58 72)">
          <rect width="268" height="94" rx="18" fill="#fffaf6" fillOpacity="0.82" stroke="#8a748f" strokeOpacity="0.3" />
          <circle cx="48" cy="47" r="27" fill="#b19eb8" />
          <path d="M34 61V38l14-9 14 9v23M42 61V45h12v16M38 40h20" fill="none" stroke="#fffaf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M91 35h102M91 51h76" stroke="#806b89" strokeWidth="6" strokeLinecap="round" opacity="0.58" />
          <g fill="#8a7392" opacity="0.65">
            <circle cx="205" cy="69" r="4" /><circle cx="219" cy="69" r="4" /><circle cx="233" cy="69" r="4" /><circle cx="247" cy="69" r="4" />
          </g>
        </g>

        <g transform="translate(38 184)">
          <rect width="252" height="94" rx="18" fill="#fffaf6" fillOpacity="0.84" stroke="#8a748f" strokeOpacity="0.3" />
          <circle cx="48" cy="47" r="27" fill="#97a59c" />
          <path d="M43 31h10v11h11v10H53v11H43V52H32V42h11Z" fill="none" stroke="#fffaf6" strokeWidth="2.1" strokeLinejoin="round" />
          <path d="M91 35h90M91 51h64M91 66h47" stroke="#806b89" strokeWidth="5.5" strokeLinecap="round" opacity="0.54" />
          <g fill="#8a7392" opacity="0.62">
            <circle cx="190" cy="69" r="4" /><circle cx="204" cy="69" r="4" /><circle cx="218" cy="69" r="4" /><circle cx="232" cy="69" r="4" />
          </g>
        </g>

        <g transform="translate(70 296)">
          <rect width="242" height="94" rx="18" fill="#fffaf6" fillOpacity="0.84" stroke="#8a748f" strokeOpacity="0.3" />
          <circle cx="48" cy="47" r="27" fill="#cb866f" />
          <g fill="none" stroke="#fffaf6" strokeWidth="2.3" strokeLinecap="round">
            <circle cx="39" cy="47" r="10" /><circle cx="59" cy="47" r="10" /><path d="M49 45h1M29 43l-5-3M69 43l5-3" />
          </g>
          <path d="M91 35h92M91 51h68M91 66h45" stroke="#806b89" strokeWidth="5.5" strokeLinecap="round" opacity="0.54" />
          <g fill="#8a7392" opacity="0.62">
            <circle cx="180" cy="69" r="4" /><circle cx="194" cy="69" r="4" /><circle cx="208" cy="69" r="4" /><circle cx="222" cy="69" r="4" />
          </g>
        </g>
      </g>

      <g className="transition-transform duration-700 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none">
        <path d="M414 414c83-64 42-119 95-157" fill="none" stroke="#745d80" strokeWidth="4" strokeLinecap="round" />
        <path d="M344 472c39-48 89-46 100-94 8-34-16-54-15-84" fill="none" stroke="#8a7195" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
        <circle cx="414" cy="414" r="8" fill="#927da0" />
        <circle cx="509" cy="257" r="8" fill="#927da0" />
        <path d="M409 250c0-39 30-69 68-69s68 30 68 69c0 53-68 116-68 116s-68-63-68-116Z" fill="url(#directory-pin)" stroke="#60486d" strokeWidth="2" />
        <circle cx="477" cy="249" r="24" fill="#eee7eb" stroke="#60486d" strokeWidth="2" />
      </g>
    </svg>
  );
}

function FocusArtwork() {
  const dots = Array.from({ length: 42 }, (_, index) => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    return (
      <circle
        key={index}
        cx={235 + column * 19}
        cy={66 + row * 18}
        r={1.5 + column * 0.23}
        fill="#547185"
        opacity={0.18 + column * 0.1}
      />
    );
  });

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 400 320" className={artworkMotion}>
      <defs>
        <pattern id="focus-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#4f6878" opacity="0.16" />
        </pattern>
        <radialGradient id="focus-lens-a" cx="42%" cy="38%" r="65%">
          <stop offset="0" stopColor="#f6fafb" stopOpacity="0.82" />
          <stop offset="0.68" stopColor="#aec0cc" stopOpacity="0.3" />
          <stop offset="1" stopColor="#6f8a9c" stopOpacity="0.14" />
        </radialGradient>
        <radialGradient id="focus-lens-b" cx="45%" cy="35%" r="68%">
          <stop offset="0" stopColor="#f8fbfc" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7894a6" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      <rect width="400" height="320" fill="url(#focus-dots)" opacity="0.55" />
      <g fill="none" stroke="#577286" strokeWidth="1.5" opacity="0.72">
        <path d="M30 63V29h34M336 29h34v34M30 163v34h34M336 197h34v-34" />
      </g>
      <g className="origin-[45%_36%] transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none">
        <circle cx="137" cy="111" r="83" fill="url(#focus-lens-a)" stroke="#5f7b8d" strokeWidth="2" />
        <circle cx="215" cy="111" r="83" fill="url(#focus-lens-b)" stroke="#506f83" strokeWidth="2" />
        <path d="M161 34a83 83 0 0 1 0 154" fill="none" stroke="#f8fbfc" strokeWidth="1.2" opacity="0.7" />
        <path d="M192 33a83 83 0 0 0 0 156" fill="none" stroke="#6c8799" strokeWidth="1.2" opacity="0.55" />
      </g>
      <g className="transition-transform duration-500 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none">
        {dots}
      </g>
      <path d="M49 223h302" stroke="#718895" strokeWidth="1" strokeDasharray="3 8" opacity="0.35" />
    </svg>
  );
}

function ScanArtwork() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 400 320" className={artworkMotion}>
      <defs>
        <pattern id="scan-dots" width="15" height="15" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#657051" opacity="0.15" />
        </pattern>
        <radialGradient id="scan-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fffdf1" stopOpacity="0.8" />
          <stop offset="0.16" stopColor="#dfe4cc" stopOpacity="0.34" />
          <stop offset="1" stopColor="#9da889" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="320" fill="url(#scan-dots)" opacity="0.6" />
      <g fill="none" stroke="#737c61" strokeWidth="1.2" opacity="0.62">
        <path d="M46 46v137M39 55h14M39 68h9M39 81h14M39 94h9M39 107h14M39 120h9M39 133h14M39 146h9M39 159h14M39 172h9" />
        <path d="M354 46v137M347 55h14M352 68h9M347 81h14M352 94h9M347 107h14M352 120h9M347 133h14M352 146h9M347 159h14M352 172h9" />
      </g>

      <g className="origin-[52%_38%] transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none" transform="translate(4 -3)">
        <ellipse cx="205" cy="121" rx="116" ry="99" fill="url(#scan-glow)" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M205 22c59 0 106 34 112 90 7 62-35 108-112 108-67 0-110-39-110-99 0-58 48-99 110-99Z" stroke="#f9faef" strokeWidth="2.2" opacity="0.9" />
          <path d="M205 33c54 0 96 31 101 82 6 56-31 96-101 96-61 0-99-35-99-90 0-52 43-88 99-88Z" stroke="#758062" strokeWidth="1.3" opacity="0.76" />
          <path d="M205 44c48 0 86 27 90 72 5 49-28 84-90 84-54 0-87-31-87-79 0-45 38-77 87-77Z" stroke="#8b9477" strokeWidth="1.1" opacity="0.7" />
          <path d="M205 56c41 0 74 23 77 61 5 42-24 72-77 72-46 0-75-26-75-68 0-39 33-65 75-65Z" stroke="#768163" strokeWidth="1.1" opacity="0.62" />
          <path d="M205 69c35 0 62 18 65 50 4 35-20 59-65 59-39 0-63-21-63-57 0-32 27-52 63-52Z" stroke="#909a7f" strokeWidth="1" opacity="0.58" />
          <circle cx="205" cy="121" r="8" fill="#f7f6e8" stroke="#6b7658" strokeWidth="1.2" />
          <path d="M205 121c-27-31-47-42-68-52M205 121c28-28 48-41 70-50M205 121c-34 4-60 14-83 31M205 121c35 5 61 15 82 33M205 121c-22 24-34 45-39 65M205 121c24 24 38 44 44 64" stroke="#778164" strokeWidth="1.2" opacity="0.68" />
          <path d="M168 85c-6-12-6-21-4-30M160 91c-13-5-22-5-31-3M245 86c8-11 10-20 9-29M252 93c13-4 23-3 31 0M168 155c-9 8-16 18-19 27M247 154c10 9 17 18 20 29" stroke="#7a8567" strokeWidth="0.9" opacity="0.58" />
        </g>
      </g>

      <g className="transition-transform duration-700 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none">
        <path d="M35 121h330" stroke="#fbfae8" strokeWidth="5" opacity="0.76" />
        <path d="M35 121h330" stroke="#8f9a73" strokeWidth="1" opacity="0.72" />
      </g>
    </svg>
  );
}

function GlassesArtwork() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 400 320" className={artworkMotion}>
      <defs>
        <pattern id="glasses-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#9f573c" opacity="0.15" />
        </pattern>
        <linearGradient id="glasses-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff7ef" stopOpacity="0.72" />
          <stop offset="1" stopColor="#df9d78" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <rect width="400" height="320" fill="url(#glasses-dots)" opacity="0.7" />
      <g fill="none" stroke="#a76043" strokeWidth="1" strokeDasharray="3 6" opacity="0.55">
        <path d="M30 32h340M30 188h340M70 21v178M200 21v178M330 21v178" />
        <path d="M70 27v10M200 27v10M330 27v10M64 32h12M194 32h12M324 32h12" strokeDasharray="none" />
      </g>

      <g className="origin-[50%_36%] transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025] motion-reduce:transition-none">
        <path d="M56 68c28-15 76-16 104-4 16 7 24 16 40 16s24-9 40-16c28-12 76-11 104 4l-4 18c-5 34-23 69-69 69-42 0-60-32-62-62-4-5-14-8-19-8s-15 3-19 8c-2 30-20 62-62 62-46 0-64-35-69-69Z" fill="#b96949" fillOpacity="0.16" stroke="#a9583a" strokeWidth="5" strokeLinejoin="round" />
        <path d="M65 80c23-11 63-12 85-3 12 5 17 14 17 27 0 24-14 42-51 42-38 0-53-22-58-54ZM335 80c-23-11-63-12-85-3-12 5-17 14-17 27 0 24 14 42 51 42 38 0 53-22 58-54Z" fill="url(#glasses-lens)" stroke="#c77c5c" strokeWidth="1.5" />
        <path d="M169 85c17-12 45-12 62 0M55 74 29 85l-4 70c0 9 5 13 10 7l9-69M345 74l26 11 4 70c0 9-5 13-10 7l-9-69" fill="none" stroke="#9c5136" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="50" y="77" width="12" height="8" rx="2" fill="#f0c0a6" stroke="#9c5136" strokeWidth="2" />
        <rect x="338" y="77" width="12" height="8" rx="2" fill="#f0c0a6" stroke="#9c5136" strokeWidth="2" />
      </g>

      <g className="transition-transform duration-700 ease-out group-hover:translate-y-1 group-focus-visible:translate-y-1 motion-reduce:transition-none">
        <ellipse cx="122" cy="202" rx="50" ry="18" fill="url(#glasses-lens)" stroke="#b86647" strokeWidth="1.2" />
        <ellipse cx="278" cy="202" rx="50" ry="18" fill="url(#glasses-lens)" stroke="#b86647" strokeWidth="1.2" />
        <path d="M58 202h128M214 202h128" stroke="#a85b3e" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.5" />
      </g>
    </svg>
  );
}

function RepairArtwork() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 400 320" className={artworkMotion}>
      <defs>
        <pattern id="repair-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#8c661d" opacity="0.15" />
        </pattern>
        <linearGradient id="repair-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8edce" />
          <stop offset="0.48" stopColor="#bf9143" />
          <stop offset="1" stopColor="#87601f" />
        </linearGradient>
      </defs>

      <rect width="400" height="320" fill="url(#repair-dots)" opacity="0.72" />
      <g fill="none" stroke="#8c6724" strokeWidth="1" strokeDasharray="4 6" opacity="0.55">
        <path d="M47 179h306M164 43v150M235 43v150" />
        <path d="M164 174v12M235 174v12M158 179h12M229 179h12" strokeDasharray="none" />
      </g>

      <g className="transition-transform duration-700 ease-out group-hover:-translate-x-1 group-focus-visible:-translate-x-1 motion-reduce:transition-none">
        <path d="M-8 42 132 94l32 34-19 33-41-18L-8 76Z" fill="#ad7d2e" fillOpacity="0.78" stroke="#805b1f" strokeWidth="2" />
        <rect x="115" y="100" width="49" height="54" rx="12" fill="url(#repair-metal)" stroke="#7e5b20" strokeWidth="2" transform="rotate(-13 139.5 127)" />
        <circle cx="137" cy="126" r="9" fill="#edd59c" stroke="#7e5b20" strokeWidth="2" />
        <circle cx="137" cy="126" r="2.5" fill="#7e5b20" />
      </g>

      <g className="transition-transform duration-700 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none">
        <path d="M408 42 268 94l-32 34 19 33 41-18 112-67Z" fill="#ad7d2e" fillOpacity="0.78" stroke="#805b1f" strokeWidth="2" />
        <rect x="236" y="100" width="49" height="54" rx="12" fill="url(#repair-metal)" stroke="#7e5b20" strokeWidth="2" transform="rotate(13 260.5 127)" />
        <circle cx="263" cy="126" r="9" fill="#edd59c" stroke="#7e5b20" strokeWidth="2" />
        <circle cx="263" cy="126" r="2.5" fill="#7e5b20" />
      </g>

      <g className="origin-[50%_46%] transition-transform duration-700 ease-out group-hover:rotate-[2deg] group-focus-visible:rotate-[2deg] motion-reduce:transition-none">
        <path d="M177 115h46v20h18v31h-30v-14h-22v14h-30v-31h18Z" fill="#c79c52" stroke="#76531b" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="177" cy="143" r="5" fill="#f4e6bd" stroke="#76531b" strokeWidth="1.5" />
        <circle cx="223" cy="143" r="5" fill="#f4e6bd" stroke="#76531b" strokeWidth="1.5" />
        <path d="M200 84v31M192 88h16M194 96h12M194 104h12" stroke="#76531b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="200" cy="80" r="7" fill="url(#repair-metal)" stroke="#76531b" strokeWidth="1.5" />
      </g>

      <g transform="translate(318 184)" fill="none" stroke="#7e5b20">
        <circle cx="0" cy="0" r="31" strokeWidth="1.3" opacity="0.78" />
        <path d="m-13 17 30-34M-7 10l7 7M8-8l7 7" strokeWidth="4" strokeLinecap="round" />
        <path d="m17-17 6-6" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const CATEGORIES = [
  {
    title: "Medici si clinici",
    to: "/cauta",
    Artwork: DirectoryArtwork,
    tone: "border-[#d4c6d8] bg-[#e8e0ea]",
    featured: true,
  },
  {
    title: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    Artwork: FocusArtwork,
    tone: "border-[#c6d3da] bg-[#dce5e9]",
  },
  {
    title: "Investigatii",
    to: "/cerere?categorie=investigatii",
    Artwork: ScanArtwork,
    tone: "border-[#ccd2ba] bg-[#dfe3d2]",
  },
  {
    title: "Ochelari si lentile",
    to: "/cerere?categorie=ochelari_lentile",
    Artwork: GlassesArtwork,
    tone: "border-[#e1bda8] bg-[#efd5c5]",
  },
  {
    title: "Reparatii si reglaje",
    to: "/cerere?categorie=reparatii_ochelari",
    Artwork: RepairArtwork,
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
        {CATEGORIES.map((category, index) => {
          const { Artwork } = category;

          return (
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
                  <Artwork />
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
                        ? "flex h-11 w-11 items-center justify-center rounded-full border border-foreground/65 sm:h-12 sm:w-12"
                        : "flex h-8 w-8 items-center justify-center rounded-full border border-foreground/65 sm:h-9 sm:w-9"
                    }
                  >
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none sm:h-[18px] sm:w-[18px]" />
                  </span>
                </span>
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
