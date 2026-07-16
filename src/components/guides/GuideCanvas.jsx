import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";

export function GuideCanvas({ children }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f8f4ec] text-[#171717]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.14) 0.8px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem]"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 0%, rgba(220,232,242,0.82), rgba(248,244,236,0) 72%)",
        }}
      />
      <div className="relative mx-auto max-w-[84rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-20">
        {children}
      </div>
    </div>
  );
}

export function Breadcrumbs({ current }) {
  return (
    <nav aria-label="Navigare ierarhică" className="flex flex-wrap items-center gap-1 text-xs font-semibold text-[#6f6a63]">
      <Link to="/" className="inline-flex min-h-11 items-center hover:text-[#171717]">
        Acasă
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      <Link to="/ghid" className="inline-flex min-h-11 items-center hover:text-[#171717]">
        Ghid
      </Link>
      {current && (
        <>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-current="page" className="text-[#171717]">
            {current}
          </span>
        </>
      )}
    </nav>
  );
}

export function TechnicalMark({ accent = "#345bc8", className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`relative aspect-square min-h-32 overflow-hidden rounded-full border border-[#171717]/25 ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px bg-[#171717]/25" />
      <span className="absolute left-0 top-1/2 h-px w-full bg-[#171717]/25" />
      <span className="absolute inset-[18%] rounded-full border-2 border-[#171717]" />
      <span
        className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-[#f8f4ec]"
        style={{ backgroundColor: accent, boxShadow: `0 0 0 2px ${accent}` }}
      />
      <span className="absolute right-[11%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 bg-[#171717]" />
    </div>
  );
}

export function PrimaryCta({ to, children }) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-14 items-center gap-6 rounded-full bg-[#171717] py-2 pl-7 pr-2 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,23,23,0.14)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f8f4ec] motion-reduce:transform-none sm:text-base"
    >
      {children}
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f8f4ec] text-[#171717]">
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function GuideNote() {
  return (
    <p className="max-w-3xl text-xs leading-5 text-[#6f6a63] sm:text-sm">
      Competențele pot varia în funcție de calificare și autorizare. VIASEE oferă orientare și informații generale, nu diagnostic medical.
    </p>
  );
}
