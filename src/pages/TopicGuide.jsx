import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, Check, ExternalLink } from "lucide-react";
import {
  Breadcrumbs,
  GuideCanvas,
  GuideNote,
  PrimaryCta,
  TechnicalMark,
} from "@/components/guides/GuideCanvas";
import {
  getTopicGroup,
  getTopicGuide,
  getTopicPath,
  TOPIC_GUIDES,
} from "@/data/topicGuides";

export default function TopicGuide() {
  const { category, slug } = useParams();
  const guide = getTopicGuide(category, slug);

  if (!guide) return <Navigate to="/ghid" replace />;

  const group = getTopicGroup(guide.category);

  return (
    <GuideCanvas>
      <Breadcrumbs current={guide.shortTitle} />

      <article>
        <header className="mt-10 grid gap-10 border-t-[3px] border-[#171717] pt-7 lg:grid-cols-[1fr_19rem] lg:items-end lg:gap-20">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="grid h-9 min-w-9 place-items-center rounded-[0.4rem] px-2 font-mono text-[10px] font-semibold text-white"
                style={{ backgroundColor: guide.accent }}
              >
                {guide.number}
              </span>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63] sm:text-xs">
                Ghid VIASEE · {guide.eyebrow}
              </p>
            </div>
            <h1 className="mt-7 max-w-6xl font-heading text-[clamp(3rem,7vw,7rem)] font-extrabold leading-[0.9] tracking-[-0.068em]">
              {guide.title}
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-[#514d47] sm:text-xl">
              {guide.intro}
            </p>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.17em] text-[#777169]">
              Actualizat editorial · 17 iulie 2026
            </p>
          </div>
          <TechnicalMark accent={guide.accent} className="hidden w-full lg:block" />
        </header>

        <section
          aria-labelledby="pe-scurt"
          className="mt-16 grid border-y-[3px] border-[#171717] lg:grid-cols-[0.38fr_1.62fr]"
        >
          <div className="flex items-start justify-between gap-4 py-7 lg:border-r lg:border-[#171717] lg:pr-9">
            <h2 id="pe-scurt" className="font-mono text-xs font-semibold uppercase tracking-[0.22em]">
              Pe scurt
            </h2>
            <span className="h-3 w-3 bg-[#171717]" aria-hidden="true" />
          </div>
          <p
            className="py-8 font-heading text-[clamp(1.9rem,4vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.052em] lg:px-10 lg:py-11"
            style={{ backgroundColor: guide.tint }}
          >
            {guide.shortAnswer}
          </p>
        </section>

        <div className="mt-20 sm:mt-28">
          {guide.sections.map((section, sectionIndex) => (
            <section
              key={section.label}
              aria-labelledby={`sectiune-${sectionIndex}`}
              className="grid border-t-[3px] border-[#171717] lg:grid-cols-[0.72fr_1.28fr]"
            >
              <div className="py-7 lg:border-r lg:border-[#171717] lg:pr-12">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
                  0{sectionIndex + 1} · {section.label}
                </p>
                <h2
                  id={`sectiune-${sectionIndex}`}
                  className="mt-4 max-w-lg text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl"
                >
                  {section.title}
                </h2>
              </div>
              <ul className="lg:pl-10">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-[#171717]/35 py-6 text-lg font-semibold leading-7 sm:text-xl"
                  >
                    <span
                      className="mt-0.5 grid h-8 w-8 place-items-center rounded-full text-white"
                      style={{ backgroundColor: guide.accent }}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="relative mt-20 overflow-hidden rounded-[2rem] bg-[#171717] text-[#f8f4ec] sm:mt-28 lg:grid lg:grid-cols-[0.38fr_1.62fr]">
          <div className="border-b border-white/25 p-7 lg:border-b-0 lg:border-r lg:p-10">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              De reținut
            </p>
            <span
              aria-hidden="true"
              className="mt-8 hidden h-4 w-4 lg:block"
              style={{ backgroundColor: guide.accent }}
            />
          </div>
          <div className="relative p-7 sm:p-10 lg:p-14">
            <h2 className="font-heading text-[clamp(2rem,4vw,4.1rem)] font-semibold leading-[1.04] tracking-[-0.05em]">
              {guide.important.title}
            </h2>
            <p className="mt-6 max-w-3xl text-base leading-7 text-white/70 sm:text-lg">
              {guide.important.text}
            </p>
          </div>
        </section>

        <section aria-labelledby="intrebari" className="mt-20 sm:mt-28">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
            Întrebări clare
          </p>
          <h2 id="intrebari" className="mt-4 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">
            Întrebări frecvente
          </h2>
          <div className="mt-8 border-t-[3px] border-[#171717]">
            {guide.questions.map((item) => (
              <div
                key={item.question}
                className="grid gap-4 border-b border-[#171717]/35 py-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
              >
                <h3 className="text-lg font-bold tracking-[-0.025em] sm:text-xl">
                  {item.question}
                </h3>
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
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              Găsește serviciul potrivit situației tale.
            </h2>
          </div>
          <PrimaryCta to={guide.cta.to}>{guide.cta.label}</PrimaryCta>
        </section>

        <section aria-labelledby="surse" className="mt-16 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
              Documentare
            </p>
            <h2 id="surse" className="mt-3 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Surse consultate
            </h2>
          </div>
          <ul className="border-t border-[#171717]">
            {guide.sources.map((source) => (
              <li key={source.url} className="border-b border-[#171717]/30">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-16 items-center justify-between gap-5 py-3 text-sm font-semibold hover:underline hover:underline-offset-4"
                >
                  {source.label}
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ghiduri-legate" className="mt-16">
          <h2 id="ghiduri-legate" className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
            Continuă cu
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {guide.related.map((relatedKey) => {
              const related = TOPIC_GUIDES[relatedKey];
              return (
                <Link
                  key={relatedKey}
                  to={getTopicPath(related)}
                  className="group flex min-h-36 items-center justify-between gap-6 rounded-2xl border border-[#171717]/30 bg-[#f8f4ec] p-6 transition-colors hover:bg-white/50"
                >
                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em]">{related.number}</span>
                    <h3 className="mt-2 text-xl font-extrabold tracking-[-0.035em]">
                      {related.shortTitle}
                    </h3>
                  </div>
                  <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-5 border-t border-[#171717]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <GuideNote />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/ghid" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
              Toate ghidurile
            </Link>
            <Link to="/cum-verificam-informatiile" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
              Metodologia editorială
            </Link>
          </div>
        </footer>

        <p className="sr-only">Categorie editorială: {group?.label}</p>
      </article>
    </GuideCanvas>
  );
}

