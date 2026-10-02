import React from "react";
import { ArrowUpRight, Building2, Clock3, Glasses } from "lucide-react";
import SpecialistsPortrait from "./SpecialistsPortrait";

function CollageTile({ className = "", children }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -left-1 -top-1 h-2 w-2 bg-[#192E2B]" />
      <span className="absolute -right-1 -top-1 h-2 w-2 bg-[#192E2B]" />
      {children}
    </div>
  );
}

export default function SpecialistsVisualInvitation() {
  return (
    <section aria-labelledby="specialists-invitation-title" className="relative mt-8 overflow-hidden bg-[#285F5F] text-[#FFFDF7] sm:mt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(rgba(255,253,247,.22) .7px, transparent .9px)", backgroundSize: "4px 4px" }} />
      <div className="relative mx-auto max-w-6xl px-5 py-12 text-center sm:px-8 sm:py-20">
        <h2 id="specialists-invitation-title" className="font-heading text-[clamp(2rem,6.5vw,5.25rem)] font-bold leading-[1.02] tracking-[-.045em]">
          Un profil clar.<br />Mai aproape de pacienți.
        </h2>

        <div aria-hidden="true" className="mx-auto mt-9 grid max-w-3xl grid-cols-[1.15fr_.65fr_1fr] items-start gap-2.5 text-left sm:mt-12 sm:grid-cols-[1.3fr_.5fr_1fr_.55fr_1fr] sm:gap-3">
          <CollageTile className="bg-[#FFFDF7] p-3 text-[#263B37] sm:p-4">
            <div className="flex items-center gap-1.5 border-b border-[#DCE6DF] pb-2 sm:gap-2 sm:pb-3">
              <Building2 className="h-4 w-4 shrink-0 text-[#2E6666] sm:h-5 sm:w-5" />
              <span className="text-[9px] font-bold sm:text-xs">Profil public</span>
            </div>
            <div className="mt-3 h-8 bg-[#E4EFEB] sm:h-14" />
            <p className="mt-3 text-[9px] font-semibold sm:text-sm">Optică · Clinică</p>
            <p className="mt-1 text-[8px] leading-relaxed text-[#596D64] sm:text-[10px]">Adresă · Program · Servicii</p>
            <div className="mt-3 h-1.5 w-4/5 bg-[#DCE6DF] sm:mt-4" />
            <div className="mt-2 h-1.5 w-3/5 bg-[#E8ECE5]" />
          </CollageTile>

          <CollageTile className="hidden aspect-square items-center justify-center bg-[#D0E2DC] text-[#285F5F] sm:flex">
            <Glasses className="h-11 w-11" strokeWidth={1.8} />
          </CollageTile>

          <CollageTile className="bg-[#ACC8BC]">
            <svg viewBox="0 0 160 240" className="w-full" fill="none">
              <path d="M0 77L160 163M25 240L114 0M0 177L160 46" stroke="#EFF5F1" strokeWidth="11" />
              <path d="M42 172C57 124 82 146 104 80" stroke="#285F5F" strokeWidth="2" strokeDasharray="3 4" />
              <circle cx="42" cy="172" r="6" fill="#FFFDF7" stroke="#285F5F" strokeWidth="2" />
              <path d="M105 112C105 112 86 91 86 79C86 67 94 58 105 58C116 58 124 67 124 79C124 91 105 112 105 112Z" fill="#285F5F" />
              <circle cx="105" cy="79" r="6" fill="#FFFDF7" />
              <rect x="10" y="205" width="140" height="23" rx="2" fill="#FFFDF7" />
              <text x="80" y="220" textAnchor="middle" fontFamily="inherit" fontSize="9" fill="#285F5F">Locațiile tale</text>
            </svg>
          </CollageTile>

          <CollageTile className="hidden bg-[#EEE6D4] px-2 pb-4 pt-3 text-[#285F5F] sm:block">
            <Clock3 className="mx-auto h-8 w-8" strokeWidth={1.8} />
            {[75, 55, 90, 65].map((width, i) => (
              <div key={width} className="mt-4 h-1.5 bg-[#B3C7BB]" style={{ width: `${width}%`, marginLeft: i % 2 ? "auto" : undefined }} />
            ))}
            <p className="mt-5 text-center text-[9px] font-medium">Program</p>
          </CollageTile>

          <CollageTile className="overflow-visible bg-[#E8DECA]">
            <SpecialistsPortrait className="w-full" />
            <div className="bg-[#FFFDF7] px-2 py-2 text-center text-[8px] font-semibold text-[#285F5F] sm:text-[10px]">Profil profesional</div>
          </CollageTile>
        </div>

        <a href="#profilul-tau" className="mt-10 inline-flex max-w-full items-center justify-center gap-3 rounded-sm py-2 text-xl font-semibold tracking-tight underline decoration-2 underline-offset-[10px] transition-colors hover:text-[#D2E5DD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF7] focus-visible:ring-offset-4 focus-visible:ring-offset-[#285F5F] sm:mt-12 sm:gap-4 sm:text-4xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current sm:h-11 sm:w-11">
            <ArrowUpRight className="h-5 w-5 sm:h-7 sm:w-7" />
          </span>
          Începe cu profilul tău
        </a>
      </div>
    </section>
  );
}
