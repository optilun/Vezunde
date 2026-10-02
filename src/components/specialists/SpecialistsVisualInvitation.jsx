import React from "react";
import { ArrowRight, Clock3, Glasses, MapPin } from "lucide-react";
import { GlassesIllustration, ScheduleIllustration } from "./SpecialistsArtworks";

function CollageTile({ className = "", children }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="absolute -left-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      <span className="absolute -right-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      {children}
    </div>
  );
}

export default function SpecialistsVisualInvitation() {
  return (
    <section aria-labelledby="specialists-invitation-title" className="relative mt-8 overflow-hidden bg-[#405AE9] text-[#FFFDF7] sm:mt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/specialists/blue-organic-print-v1.svg')" }} />
      <div className="relative mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <h2 id="specialists-invitation-title" className="font-heading text-[clamp(2rem,6.5vw,5.5rem)] font-bold leading-[1.02] tracking-[-.045em]">
          Un profil clar.<br />Mai aproape de pacienți.
        </h2>

        <div aria-hidden="true" className="mx-auto mt-12 grid w-full max-w-[340px] grid-cols-[1.05fr_1fr_1fr] items-start gap-3 text-left sm:mt-16 sm:max-w-[600px] lg:w-[58%] lg:max-w-[720px] sm:grid-cols-[1.35fr_.5fr_1fr_.52fr_1fr] sm:gap-3">
          <CollageTile className="bg-[#FFFDF7] p-2.5 text-[#242733] sm:p-3">
            <div className="flex items-center justify-between border-b border-[#DCE3F6] pb-2 text-[8px] font-bold sm:pb-2 sm:text-[10px]">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#405AE9]" />VIASEE</span>
              <ArrowRight className="h-2.5 w-2.5 text-[#405AE9] sm:h-3.5 sm:w-3.5" />
            </div>
            <p className="mt-3 text-[10px] font-bold leading-tight sm:mt-3 sm:text-sm">Optică · Clinică</p>
            <div className="mt-3 space-y-2.5 text-[7px] text-[#657087] sm:mt-3 sm:space-y-2 sm:text-[10px]">
              {[[MapPin, "Adresă și contact"], [Clock3, "Program"], [Glasses, "Servicii"]].map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-1.5 sm:gap-2">
                  <Icon className="h-2.5 w-2.5 shrink-0 text-[#405AE9] sm:h-3.5 sm:w-3.5" strokeWidth={1.8} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-[#DCE3F6] pt-2 text-[7px] font-semibold text-[#405AE9] sm:mt-3 sm:pt-2 sm:text-[9px]">Profilul locației</p>
          </CollageTile>
          <CollageTile className="hidden sm:block">
            <GlassesIllustration className="w-full" />
          </CollageTile>
          <CollageTile>
            <img src="/images/specialists/specialist-editorial-v1.webp" alt="" width="1086" height="1448" loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" />
          </CollageTile>
          <CollageTile className="hidden sm:block">
            <ScheduleIllustration className="w-full" />
          </CollageTile>
          <CollageTile>
            <img src="/images/specialists/optician-client-editorial-v1.webp" alt="" width="1086" height="1448" loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" />
          </CollageTile>
        </div>

        <a href="#profilul-tau" className="mt-12 inline-flex max-w-full items-center justify-center gap-3 rounded-sm py-2 text-xl font-semibold tracking-tight underline decoration-2 underline-offset-[10px] transition-colors hover:text-[#DCE4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF7] focus-visible:ring-offset-4 focus-visible:ring-offset-[#405AE9] sm:mt-16 sm:gap-4 sm:text-5xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current sm:h-12 sm:w-12">
            <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8" />
          </span>
          Începe cu profilul tău
        </a>
      </div>
    </section>
  );
}

