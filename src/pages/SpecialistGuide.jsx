import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import {
  Breadcrumbs,
  GuideCanvas,
  GuideNote,
  PrimaryCta,
  TechnicalMark,
} from "@/components/guides/GuideCanvas";
import { getGuide, SPECIALIST_GUIDES } from "@/data/specialistGuides";

export default function SpecialistGuide() {
  const { slug } = useParams();
  const guide = getGuide(slug);

  if (!guide) return <Navigate to="/ghid" replace />;

  return (
    <GuideCanvas>
      <Breadcrumbs current={guide.name} />

      <article>
        <header className="mt-10 grid gap-10 border-t-[3px] border-[#171717] pt-7 lg:grid-cols-[1fr_19rem] lg:items-end lg:gap-20">
          <div>
            <div className="flex items-center gap-4">
              <span
                className="grid h-9 w-9 place-items-center rounded-[0.4rem] font-mono text-xs font-semibold text-white"
                style={{ backgroundColor: guide.accent }}
              >
                {guide.number}
              </span>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63] sm:text-xs">
                Ghid VIASEE · {guide.eyebrow}
              </p>
            </div>
            <h1 className="mt-7 max-w-6xl font-heading text-[clamp(3.2rem,7.6vw,7.5rem)] font-extrabold leading-[0.88] tracking-[-0.072em]">
              {guide.title}
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-[#514d47] sm:text-xl">
              {guide.definition}
            </p>
          </div>
          <TechnicalMark accent={guide.accent} className="hidden w-full lg:block" />
        </header>

        <section aria-labelledby="pe-scurt" className="mt-16 grid border-y-[3px] border-[#171717] lg:grid-cols-[0.42fr_1.58fr]">
          <div className="flex items-start justify-between gap-4 py-7 lg:border-r lg:border-[#171717] lg:pr-9">
            <h2 id="pe-scurt" className="font-mono text-xs font-semibold uppercase tracking-[0.22em]">
              Pe scurt
            </h2>
            <span className="h-3 w-3 bg-[#171717]" aria-hidden="true" />
          </div>
          <p
            className="py-8 font-heading text-[clamp(2rem,4.4vw,4.5rem)] font-bold leading-[1.03] tracking-[-0.055em] lg:px-10 lg:py-11"
            style={{ backgroundColor: guide.tint }}
          >
            {guide.shortAnswer}
          </p>
        </section>

        <div className="mt-20 grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <section aria-labelledby="cu-ce-ajuta">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
              01 · Rol
            </p>
            <h2 id="cu-ce-ajuta" className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">
              Cu ce te poate ajuta
            </h2>
          </section>
          <ul className="border-t-[3px] border-[#171717]">
            {guide.helpsWith.map((item) => (
              <li key={item} className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[#171717]/35 py-6 text-lg font-semibold leading-7 sm:text-xl">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-white"
                  style={{ backgroundColor: guide.accent }}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="cand-mergi" className="mt-20 sm:mt-28">
          <div className="border-b-[3px] border-[#171717] pb-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
              02 · Situații frecvente
            </p>
            <h2 id="cand-mergi" className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">
              Când mergi
            </h2>
          </div>
          <div className="grid lg:grid-cols-3">
            {guide.goWhen.map((item, index) => (
              <div key={item} className={`min-h-64 border-b border-[#171717] p-6 sm:p-8 lg:border-b-0 ${index ? "lg:border-l" : ""}`}>
                <span className="font-mono text-xs tracking-[0.18em]">0{index + 1}</span>
                <p className="mt-16 text-xl font-bold leading-7 tracking-[-0.025em] sm:text-2xl">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 overflow-hidden rounded-[2rem] bg-[#171717] text-[#f8f4ec] sm:mt-28 lg:grid lg:grid-cols-[0.38fr_1.62fr]">
          <div className="border-b border-white/25 p-7 lg:border-b-0 lg:border-r lg:p-10">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Diferența importantă
            </p>
          </div>
          <div className="p-7 sm:p-10 lg:p-14">
            <p className="font-heading text-[clamp(2rem,4.2vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.05em]">
              {guide.boundary}
            </p>
          </div>
        </section>

        <section aria-labelledby="intrebari" className="mt-20 sm:mt-28">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
            03 · Întrebări clare
          </p>
          <h2 id="intrebari" className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">
            Întrebări frecvente
          </h2>
          <div className="mt-8 border-t-[3px] border-[#171717]">
            {guide.questions.map((item) => (
              <div key={item.question} className="grid gap-4 border-b border-[#171717]/35 py-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
                <h3 className="text-lg font-bold tracking-[-0.025em] sm:text-xl">{item.question}</h3>
                <p className="leading-7 text-[#5f5a53]">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 flex flex-col gap-8 border-y-[3px] border-[#171717] py-9 sm:mt-28 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
              Următorul pas
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              Găsește ajutorul potrivit.
            </h2>
          </div>
          <PrimaryCta to={guide.ctaTo}>{guide.cta}</PrimaryCta>
        </section>

        <section aria-labelledby="ghiduri-legate" className="mt-16">
          <h2 id="ghiduri-legate" className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
            Citește și despre
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {guide.related.map((relatedSlug) => {
              const related = SPECIALIST_GUIDES[relatedSlug];
              return (
                <Link key={relatedSlug} to={`/ghid/${relatedSlug}`} className="group flex min-h-28 items-center justify-between gap-6 rounded-2xl border border-[#171717]/30 bg-[#f8f4ec] p-6 transition-colors hover:bg-white/50">
                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em]">{related.number}</span>
                    <h3 className="mt-2 text-xl font-extrabold tracking-[-0.035em]">{related.name}</h3>
                  </div>
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-5 border-t border-[#171717]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <GuideNote />
          <Link to="/cum-verificam-informatiile" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
            Metodologia editorială
          </Link>
        </footer>
      </article>
    </GuideCanvas>
  );
}
