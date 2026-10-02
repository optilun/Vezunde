import React from "react";
import { ArrowRight } from "lucide-react";

const artworkPath = "/images/specialists";

function CollageTile({ className = "", src, aspect, width, height }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="absolute -left-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      <span className="absolute -right-1 -top-1 z-10 h-2 w-2 bg-[#20242D]" />
      <img
        src={`${artworkPath}/${src}.webp`}
        alt=""
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`block w-full object-cover ${aspect}`}
      />
    </div>
  );
}

export default function SpecialistsVisualInvitation() {
  return (
    <section aria-labelledby="specialists-invitation-title" className="relative mt-8 overflow-hidden bg-[#4C5AF4] text-[#FFFDF7] sm:mt-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url('${artworkPath}/cobalt-woven-v2.webp')`,
          backgroundSize: "720px auto",
          backgroundRepeat: "repeat",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 py-12 text-center sm:px-8 sm:py-16">
        <h2 id="specialists-invitation-title" className="font-heading text-[clamp(2rem,6.5vw,5.5rem)] font-bold leading-[1.02] tracking-[-.045em]">
          Un profil clar.<br />Mai aproape de pacienți.
        </h2>

        <div aria-hidden="true" className="mx-auto mt-9 grid w-full max-w-[340px] grid-cols-[1.05fr_1fr_1fr] items-start gap-3 text-left sm:mt-12 sm:max-w-[580px] sm:grid-cols-[1.35fr_.5fr_1fr_.52fr_1fr] lg:w-[56%] lg:max-w-[680px]">
          <CollageTile src="optical-stilllife-v2" aspect="aspect-[4/3]" width={1448} height={1086} />
          <CollageTile src="iris-lens-flower-v2" aspect="aspect-square" width={1254} height={1254} className="hidden sm:block" />
          <CollageTile src="eyewear-portrait-v2" aspect="aspect-[3/4]" width={1086} height={1448} />
          <CollageTile src="optical-light-study-v2" aspect="aspect-[1/2.3]" width={827} height={1902} className="hidden sm:block" />
          <CollageTile src="eyewear-connection-v2" aspect="aspect-[3/4]" width={1086} height={1448} />
        </div>

        <a href="#profilul-tau" className="mt-9 inline-flex max-w-full items-center justify-center gap-3 rounded-sm py-2 text-xl font-semibold tracking-tight underline decoration-2 underline-offset-[10px] transition-colors hover:text-[#DCE4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF7] focus-visible:ring-offset-4 focus-visible:ring-offset-[#4C5AF4] sm:mt-12 sm:gap-4 sm:text-5xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current sm:h-12 sm:w-12">
            <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8" />
          </span>
          Începe cu profilul tău
        </a>
      </div>
    </section>
  );
}

