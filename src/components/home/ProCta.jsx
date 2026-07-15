import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateLayout = (event) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateLayout);

    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  return isDesktop;
}

function ProfileBlueprint() {
  return (
    <div className="relative min-h-[23rem] overflow-hidden bg-[#dce5e9] sm:min-h-[27rem] lg:h-full lg:min-h-[34rem]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35 mix-blend-multiply"
        style={{
          backgroundImage: "url('/images/home/viasee-technical-grain.svg')",
          backgroundSize: "180px 180px",
        }}
      />

      <span
        aria-hidden="true"
        className="absolute -left-1.5 top-[29%] z-20 hidden h-3 w-3 bg-[#171717] lg:block"
      />
      <span
        aria-hidden="true"
        className="absolute -left-1.5 top-[72%] z-20 hidden h-3 w-3 bg-[#171717] lg:block"
      />

      <svg
        viewBox="0 0 520 440"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M34 45H486M34 395H486M46 33V407M474 33V407"
          stroke="#171717"
          strokeOpacity=".14"
        />
        <path
          d="M34 45H54M466 45H486M34 395H54M466 395H486"
          stroke="#171717"
          strokeOpacity=".48"
          strokeWidth="2"
        />
        <circle cx="46" cy="45" r="5" fill="#171717" />
        <circle cx="474" cy="395" r="5" fill="#171717" />

        <path d="M22 221H62" stroke="#171717" strokeWidth="2" strokeOpacity=".7" />
        <rect x="30" y="215" width="12" height="12" fill="#171717" />
        <path d="M458 221H498" stroke="#171717" strokeWidth="2" strokeOpacity=".7" />
        <rect x="478" y="215" width="12" height="12" fill="#171717" />

        <rect
          x="62"
          y="68"
          width="396"
          height="306"
          rx="28"
          fill="#F8F4EC"
          fillOpacity=".9"
          stroke="#171717"
          strokeOpacity=".28"
        />

        <rect x="88" y="94" width="30" height="30" rx="7" fill="#345bc8" />
        <path
          d="M103 100V118M94 109H112M97 103L109 115M109 103L97 115"
          stroke="#F8F4EC"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <text
          x="132"
          y="107"
          fill="#171717"
          fontFamily="monospace"
          fontSize="11"
          fontWeight="700"
          letterSpacing="2"
        >
          PROFIL VIASEE
        </text>
        <path d="M132 119H238" stroke="#171717" strokeWidth="5" strokeLinecap="round" strokeOpacity=".72" />

        <rect x="348" y="96" width="84" height="25" rx="12.5" fill="#dfe8d8" />
        <circle cx="363" cy="108.5" r="4" fill="#58744f" />
        <path d="M374 108.5H415" stroke="#58744f" strokeWidth="4" strokeLinecap="round" strokeOpacity=".72" />

        <path d="M88 147H432" stroke="#171717" strokeOpacity=".2" />

        <rect x="88" y="170" width="156" height="76" rx="17" fill="#d8e3ec" stroke="#171717" strokeOpacity=".16" />
        <text
          x="104"
          y="193"
          fill="#345bc8"
          fontFamily="monospace"
          fontSize="9"
          fontWeight="700"
          letterSpacing="1.5"
        >
          SERVICII
        </text>
        <path d="M104 210H219M104 226H185" stroke="#171717" strokeWidth="5" strokeLinecap="round" strokeOpacity=".55" />

        <rect x="258" y="170" width="174" height="76" rx="17" fill="#eadcba" stroke="#171717" strokeOpacity=".16" />
        <text
          x="274"
          y="193"
          fill="#8b641f"
          fontFamily="monospace"
          fontSize="9"
          fontWeight="700"
          letterSpacing="1.5"
        >
          ECHIPĂ
        </text>
        <circle cx="284" cy="220" r="10" fill="#a97825" fillOpacity=".8" />
        <circle cx="309" cy="220" r="10" fill="#a97825" fillOpacity=".5" />
        <circle cx="334" cy="220" r="10" fill="#a97825" fillOpacity=".3" />
        <path d="M354 213H414M354 228H393" stroke="#171717" strokeWidth="4" strokeLinecap="round" strokeOpacity=".48" />

        <rect x="88" y="260" width="344" height="88" rx="17" fill="#e8e0ea" stroke="#171717" strokeOpacity=".16" />
        <text
          x="104"
          y="284"
          fill="#735c80"
          fontFamily="monospace"
          fontSize="9"
          fontWeight="700"
          letterSpacing="1.5"
        >
          LOCAȚII
        </text>
        <circle cx="119" cy="317" r="16" stroke="#735c80" strokeWidth="5" />
        <circle cx="119" cy="317" r="4" fill="#171717" />
        <path d="M151 305H402M151 323H352" stroke="#171717" strokeWidth="5" strokeLinecap="round" strokeOpacity=".5" />
      </svg>
    </div>
  );
}

export default function ProCta() {
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useDesktopLayout();

  return (
    <section
      aria-labelledby="professional-profile-title"
      className="mx-auto mt-28 max-w-[84rem] px-5 sm:mt-36 lg:mt-44"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.55 }}
        className="relative grid overflow-hidden rounded-[2.25rem_2.25rem_0.75rem_2.25rem] border border-black/20 bg-[#171717] shadow-[0_22px_60px_rgba(23,23,23,0.12)] lg:grid-cols-[1.3fr_0.9fr]"
      >
        <div className="relative z-20 flex flex-col justify-center bg-[#171717] px-7 py-12 text-[#F8F4EC] sm:px-12 sm:py-16 lg:min-h-[34rem] lg:px-16 lg:py-20">
          <span
            aria-hidden="true"
            className="absolute left-0 top-14 h-px w-8 bg-[#F8F4EC]/35 sm:w-12"
          />

          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#F8F4EC]/58 sm:text-[11px]">
            Pentru specialiști și locații
          </p>

          <h2
            id="professional-profile-title"
            className="mt-5 max-w-[45rem] font-heading text-[clamp(2.75rem,5vw,5.35rem)] font-extrabold leading-[0.95] tracking-[-0.06em]"
          >
            Arată clar
            <span className="mt-1 block font-display font-medium italic tracking-[-0.045em]">
              cu ce îi poți ajuta.
            </span>
          </h2>

          <p className="mt-7 max-w-[43rem] text-base leading-relaxed text-[#F8F4EC]/68 sm:text-lg">
            Adaugă sau revendică profilul tău profesional ori profilul unei optici, al unui cabinet sau al unei clinici. Prezintă clar serviciile, specializările, echipa și locațiile.
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/adauga-sau-revendica"
              className="group inline-flex min-h-14 items-center justify-between gap-5 rounded-full bg-[#F8F4EC] py-2 pl-6 pr-2 text-sm font-semibold text-[#171717] outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.24)] focus-visible:ring-2 focus-visible:ring-[#F8F4EC] focus-visible:ring-offset-4 focus-visible:ring-offset-[#171717] motion-reduce:transform-none sm:w-auto sm:pl-7 sm:text-base"
            >
              Adaugă sau revendică un profil
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#171717] text-[#F8F4EC]">
                <ArrowRight
                  className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </span>
            </Link>

            <Link
              to="/pentru-specialisti"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#F8F4EC]/25 px-6 text-sm font-semibold text-[#F8F4EC]/80 outline-none transition-[border-color,color,transform] hover:-translate-y-0.5 hover:border-[#F8F4EC]/55 hover:text-[#F8F4EC] focus-visible:ring-2 focus-visible:ring-[#F8F4EC] focus-visible:ring-offset-4 focus-visible:ring-offset-[#171717] motion-reduce:transform-none sm:px-7 sm:text-base"
            >
              Vezi cum funcționează
            </Link>
          </div>
        </div>

        <motion.div
          initial={
            prefersReducedMotion
              ? false
              : isDesktop
                ? { x: -56 }
                : { opacity: 0, y: 12 }
          }
          whileInView={
            isDesktop
              ? { x: 0 }
              : { opacity: 1, y: 0 }
          }
          viewport={{ once: true, amount: 0.35 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: isDesktop ? 0.82 : 0.35,
                  delay: isDesktop ? 0.12 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }
          }
          className="relative z-10 border-t border-black/25 lg:border-l lg:border-t-0 lg:shadow-[inset_18px_0_28px_-24px_rgba(0,0,0,0.68)]"
        >
          <ProfileBlueprint />
        </motion.div>
      </motion.div>
    </section>
  );
}
