import React from "react";
import { ArrowRight } from "lucide-react";
import SpecialistsPortrait from "./SpecialistsPortrait";
import {
  OpticalPracticeIllustration,
  LocationMapIllustration,
  GlassesIllustration,
  ScheduleIllustration,
} from "./SpecialistsArtworks";

function CollageTile({ className = "", children }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -left-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      <span className="absolute -right-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      {children}
    </div>
  );
}

export default function SpecialistsVisualInvitation() {
  return (
    <section aria-labelledby="specialists-invitation-title" className="relative mt-8 overflow-hidden bg-[#405AE9] text-[#FFFDF7] sm:mt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(#182D9C .65px, transparent .85px)", backgroundSize: "3px 3px" }} />
      <div className="relative mx-auto max-w-7xl px-5 py-14 text-center sm:px-8 sm:py-20">
        <h2 id="specialists-invitation-title" className="font-heading text-[clamp(2rem,6.5vw,5.5rem)] font-bold leading-[1.02] tracking-[-.045em]">
          Un profil clar.<br />Mai aproape de pacienți.
        </h2>

        <div aria-hidden="true" className="mx-auto mt-10 grid max-w-5xl grid-cols-[1.15fr_.8fr_1fr] items-start gap-2.5 text-left sm:mt-14 sm:grid-cols-[1.4fr_.55fr_1fr_.6fr_1.05fr] sm:gap-4">
          <CollageTile className="bg-[#FFFDF7] text-[#242733]">
            <div className="flex items-center justify-between px-2.5 py-2 text-[8px] font-bold sm:px-4 sm:py-3 sm:text-xs">
              <span>Profil public</span>
              <span className="text-[#405AE9]">VIASEE</span>
            </div>
            <OpticalPracticeIllustration className="w-full" />
            <div className="p-2.5 sm:p-4">
              <p className="text-[9px] font-bold sm:text-sm">Optică · Clinică</p>
              <p className="mt-1 text-[8px] text-[#657087] sm:text-[11px]">Locația ta, ușor de găsit.</p>
              <div className="mt-2 flex gap-1.5 border-t border-[#DCE3F6] pt-2 text-[7px] text-[#405AE9] sm:mt-3 sm:gap-2 sm:pt-3 sm:text-[10px]">
                <span>Adresă</span><span>·</span><span>Program</span><span>·</span><span>Servicii</span>
              </div>
            </div>
          </CollageTile>
          <CollageTile className="hidden sm:block">
            <GlassesIllustration className="w-full" />
          </CollageTile>
          <CollageTile>
            <LocationMapIllustration className="w-full" />
          </CollageTile>
          <CollageTile className="hidden sm:block">
            <ScheduleIllustration className="w-full" />
          </CollageTile>
          <CollageTile>
            <SpecialistsPortrait className="w-full" />
            <div className="bg-[#FFFDF7] px-2 py-2 text-center text-[8px] font-semibold text-[#242733] sm:py-3 sm:text-xs">Profil profesional</div>
          </CollageTile>
        </div>

        <a href="#profilul-tau" className="mt-10 inline-flex max-w-full items-center justify-center gap-3 rounded-sm py-2 text-xl font-semibold tracking-tight underline decoration-2 underline-offset-[10px] transition-colors hover:text-[#DCE4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF7] focus-visible:ring-offset-4 focus-visible:ring-offset-[#405AE9] sm:mt-14 sm:gap-4 sm:text-5xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current sm:h-12 sm:w-12">
            <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8" />
          </span>
          Începe cu profilul tău
        </a>
      </div>
    </section>
  );
}

