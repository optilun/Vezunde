import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { LEGAL_LAST_UPDATED, VIASEE_COMPANY } from "@/lib/legal";

export function LegalList({ children }) {
  return (
    <ul className="mt-4 space-y-2.5 pl-5 text-[0.95rem] leading-7 text-[#57534e] marker:text-[#171717]">
      {children}
    </ul>
  );
}

export function LegalNote({ children }) {
  return (
    <div className="mt-5 border-l-4 border-[#345bc8] bg-[#eaf0ff] px-5 py-4 text-sm leading-6 text-[#27365f]">
      {children}
    </div>
  );
}

export default function LegalPageLayout({ eyebrow = "LEGAL", title, intro, sections }) {
  useEffect(() => {
    document.title = `${title} — VIASEE`;
    return () => {
      document.title = "VIASEE";
    };
  }, [title]);

  return (
    <div
      className="min-h-screen bg-[#f8f4ec]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.14) 1px, transparent 1.2px)",
        backgroundSize: "21px 21px",
      }}
    >
      <header className="border-b-2 border-[#171717] bg-[#f8f4ec]/95">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#57534e] transition-colors hover:text-[#171717]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Înapoi la VIASEE
          </Link>
          <p className="mt-8 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#6b6863]">
            {eyebrow}
          </p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <h1 className="max-w-4xl font-heading text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-[#171717] sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-[#57534e] sm:text-lg sm:leading-8">
                {intro}
              </p>
            </div>
            <div className="border-t border-[#171717] pt-4 text-sm leading-6 text-[#57534e] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[#77736d]">
                Ultima actualizare
              </div>
              <div className="mt-2 font-semibold text-[#171717]">{LEGAL_LAST_UPDATED}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-10">
        <aside className="self-start lg:sticky lg:top-24">
          <nav aria-label="Cuprins" className="border-t-2 border-[#171717]">
            <div className="py-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#6b6863]">
              Cuprins
            </div>
            <ol className="border-t border-[#cfc8bc]">
              {sections.map((section, index) => (
                <li key={section.id} className="border-b border-[#d9d2c7]">
                  <a
                    href={`#${section.id}`}
                    className="grid min-h-12 grid-cols-[1.6rem_1fr] items-center py-2 text-sm text-[#57534e] transition-colors hover:text-[#171717]"
                  >
                    <span className="font-mono text-[0.62rem] text-[#89847c]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 bg-[#171717] p-5 text-[#f8f4ec]">
            <Mail className="h-5 w-5" aria-hidden="true" />
            <p className="mt-4 text-sm leading-6 text-[#d8d2c8]">
              Pentru întrebări sau solicitări privind datele tale:
            </p>
            <a
              href={`mailto:${VIASEE_COMPANY.contactEmail}`}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-white underline decoration-white/40 underline-offset-4"
            >
              {VIASEE_COMPANY.contactEmail}
            </a>
          </div>
        </aside>

        <article className="min-w-0 bg-[#fbf8f2] px-5 sm:px-8 lg:px-10">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 border-t-2 border-[#171717] py-9 first:mt-0 sm:py-11"
            >
              <div className="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
                <span className="font-mono text-[0.68rem] font-semibold text-[#77736d]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="font-heading text-2xl font-bold tracking-[-0.035em] text-[#171717] sm:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-5 space-y-4 text-[0.95rem] leading-7 text-[#57534e] sm:text-base sm:leading-7">
                    {section.content}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

