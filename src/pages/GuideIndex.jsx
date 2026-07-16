import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  Breadcrumbs,
  GuideCanvas,
  GuideNote,
  TechnicalMark,
} from "@/components/guides/GuideCanvas";
import { GUIDE_ORDER, SPECIALIST_GUIDES } from "@/data/specialistGuides";

export default function GuideIndex() {
  return (
    <GuideCanvas>
      <Breadcrumbs />

      <header className="mt-10 grid gap-10 border-t-[3px] border-[#171717] pt-7 lg:grid-cols-[1fr_18rem] lg:items-end lg:gap-20">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6f6a63] sm:text-xs">
            Ghid VIASEE · Înțelege înainte să alegi
          </p>
          <h1 className="mt-6 max-w-5xl font-heading text-[clamp(3.4rem,8.8vw,8.5rem)] font-extrabold leading-[0.84] tracking-[-0.075em]">
            Vederea ta,
            <span className="block font-display font-medium italic text-[#735c80]">
              explicată clar.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[#514d47] sm:text-xl">
            Află cine te poate ajuta, ce face fiecare specialist și cum alegi serviciul potrivit situației tale.
          </p>
        </div>
        <TechnicalMark accent="#735c80" className="hidden w-full lg:block" />
      </header>

      <section aria-labelledby="guide-specialists" className="mt-20 sm:mt-28">
        <div className="flex items-end justify-between gap-6 border-b-[3px] border-[#171717] pb-5">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
              01 · Specialiști
            </p>
            <h2 id="guide-specialists" className="mt-3 text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              De cine ai nevoie?
            </h2>
          </div>
          <Link
            to="/ghid/optometrist-optician-oftalmolog"
            className="hidden min-h-11 items-center gap-2 text-sm font-semibold underline decoration-[#171717]/30 underline-offset-4 sm:flex"
          >
            Compară rolurile <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-3">
          {GUIDE_ORDER.map((slug, index) => {
            const guide = SPECIALIST_GUIDES[slug];
            return (
              <Link
                key={slug}
                to={`/ghid/${slug}`}
                className={`group relative min-h-[25rem] border-b border-[#171717] p-6 transition-[background-color,color] hover:text-[#171717] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] sm:p-8 lg:border-b-0 ${
                  index ? "lg:border-l" : ""
                }`}
                style={{ "--guide-tint": guide.tint }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = guide.tint;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.18em]">{guide.number}</span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 bg-[#171717] transition-transform group-hover:rotate-45"
                  />
                </div>
                <p className="mt-20 text-xs font-semibold uppercase tracking-[0.16em] text-[#6f6a63]">
                  {guide.eyebrow}
                </p>
                <h3 className="mt-4 text-[clamp(2.2rem,4vw,4.2rem)] font-extrabold leading-[0.92] tracking-[-0.06em]">
                  {guide.name}
                </h3>
                <p className="mt-6 max-w-sm text-sm leading-6 text-[#5f5a53]">
                  {guide.shortAnswer}
                </p>
                <span className="absolute bottom-7 right-7 grid h-12 w-12 place-items-center rounded-full border-2 border-[#171717] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">
                  <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-20 grid overflow-hidden rounded-[2rem] border-2 border-[#171717] bg-[#171717] text-[#f8f4ec] sm:mt-28 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="p-7 sm:p-12 lg:p-16">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">
            Ghid comparativ
          </p>
          <h2 className="mt-6 max-w-3xl text-[clamp(2.8rem,5.8vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.065em]">
            Nu știi la cine să mergi?
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Vezi diferențele esențiale dintre opticianul medical, optometrist și medicul oftalmolog într-o singură pagină.
          </p>
          <Link
            to="/ghid/optometrist-optician-oftalmolog"
            className="mt-9 inline-flex min-h-14 items-center gap-5 rounded-full bg-[#f8f4ec] px-7 text-sm font-semibold text-[#171717] sm:text-base"
          >
            Compară specialiștii <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative min-h-72 overflow-hidden border-t border-white/25 bg-[#dce8f2] lg:min-h-0 lg:border-l lg:border-t-0">
          <span className="absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#171717]" />
          <span className="absolute left-1/2 top-1/2 h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#171717]" />
          <span className="absolute left-0 top-1/2 h-px w-full bg-[#171717]" />
          <span className="absolute left-1/2 top-0 h-full w-px bg-[#171717]" />
          <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 bg-[#171717]" />
        </div>
      </section>

      <div className="mt-12 flex flex-col gap-5 border-t border-[#171717]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <GuideNote />
        <Link to="/cum-verificam-informatiile" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
          Cum verificăm informațiile
        </Link>
      </div>
    </GuideCanvas>
  );
}
