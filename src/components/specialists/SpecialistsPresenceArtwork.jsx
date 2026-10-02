import React from "react";
import { Building2, MapPin, Users, ArrowUpRight } from "lucide-react";

function ProfessionalDrawing() {
  return <svg viewBox="0 0 240 230" fill="none" className="h-full w-full">
    <path d="M31 223C34 166 72 148 120 148C168 148 206 166 209 223" fill="#FFFDF8" stroke="#211c25" strokeWidth="4" />
    <path d="M98 151L120 195L142 151" fill="#a9c6d7" stroke="#211c25" strokeWidth="4" strokeLinejoin="round" />
    <rect x="108" y="119" width="24" height="35" rx="9" fill="#e4a786" />
    <circle cx="120" cy="94" r="44" fill="#e4a786" stroke="#211c25" strokeWidth="4" />
    <path d="M76 91C75 32 160 30 164 91C140 65 97 70 76 91" fill="#211c25" />
    <circle cx="102" cy="97" r="17" fill="#F8F4EC" stroke="#211c25" strokeWidth="5" />
    <circle cx="139" cy="97" r="17" fill="#F8F4EC" stroke="#211c25" strokeWidth="5" />
    <path d="M119 96H122M111 123Q120 131 131 122" stroke="#211c25" strokeWidth="4" strokeLinecap="round" />
    <circle cx="104" cy="97" r="5" fill="#211c25" /><circle cx="141" cy="97" r="5" fill="#211c25" />
    <rect x="155" y="174" width="25" height="13" rx="3" fill="#684d78" />
    <path d="M88 156L78 182L101 220M152 156L162 182L139 220" stroke="#211c25" strokeWidth="4" strokeLinejoin="round" />
  </svg>;
}

export default function SpecialistsPresenceArtwork({ professional = false }) {
  return <div aria-hidden="true" className="relative mx-auto w-full max-w-[500px] select-none">
    <div className="mb-5 flex items-center justify-between border-b border-[#211c25]/25 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#665d6c] sm:text-xs">
      <span>{professional ? "Un profil profesional" : "O organizație"}</span>
      <ArrowUpRight className="h-4 w-4" />
    </div>
    <div className="relative grid grid-cols-[1.1fr_0.9fr] gap-3 sm:gap-4">
      <div className={`relative aspect-[0.9] overflow-hidden border border-[#211c25]/15 ${professional ? "bg-[#d9e5ed]" : "bg-[#d8c8e0]"}`}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(#684d78 1px, transparent 1px)", backgroundSize: "9px 9px" }} />
        <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[#4f405c]">{professional ? "Specialist" : "Organizație"}</span>
        {professional ? <div className="absolute inset-x-1 bottom-0"><ProfessionalDrawing /></div> :
          <div className="absolute inset-0 flex items-center justify-center"><Building2 className="h-28 w-28 text-[#513e61] sm:h-36 sm:w-36" strokeWidth={1.2} /></div>}
        <div className="absolute bottom-0 inset-x-0 bg-[#513e61] p-4 text-sm font-semibold text-white">{professional ? "Identitatea ta." : "Prezența ta."}</div>
      </div>
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative flex flex-1 flex-col justify-between border border-[#211c25]/15 bg-[#e3e9dc] p-4">
          <div className="flex justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4a604c]">Locații</span><MapPin className="h-5 w-5 text-[#4a604c]" /></div>
          <div className="mt-5 flex items-center gap-2">
            {[0,1,2].map(i => <React.Fragment key={i}>{i > 0 && <div className="h-px flex-1 bg-[#6e866e]/50" />}<div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#6e866e]/40 bg-white/70"><MapPin className="h-4 w-4 text-[#4a604c]" /></div></React.Fragment>)}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#3d503d]">Fiecare adresă, la locul ei.</p>
        </div>
        <div className="relative flex flex-1 flex-col justify-between border border-[#211c25]/15 bg-[#f0dfbe] p-4">
          <div className="flex justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6e5634]">Echipă</span><Users className="h-5 w-5 text-[#6e5634]" /></div>
          <div className="mt-4 flex -space-x-2">{["#684d78","#5e8077","#c77d64"].map(c=><div key={c} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#f0dfbe]" style={{background:c}}><Users className="h-4 w-4 text-white" /></div>)}</div>
          <p className="mt-3 text-xs font-semibold text-[#6e5634]">Roluri și acces distincte.</p>
        </div>
      </div>
      <span className="absolute -left-1.5 -top-1.5 h-3 w-3 bg-[#211c25]" />
      <span className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-[#211c25]" />
    </div>
    <p className="mt-5 font-heading text-2xl font-semibold tracking-tight text-[#513e61] sm:text-3xl">{professional ? "Profilul tău. Oriunde lucrezi." : "Mai multe locații. Un singur cont."}</p>
  </div>;
}
