import React from "react";
import { Aperture, ArrowRight, Check, Eye, Glasses, MapPin, Wrench } from "lucide-react";

// Editorial photographs are decorative illustrations, not real provider profiles.
const SPECIALISTS = "/images/specialists/";
const HOME = "/images/home/";

export const SPECIALIST_CARDS = [
  { kind: "doctor", title: "Medic oftalmolog", description: "Consult și îngrijirea ochilor", src: SPECIALISTS + "specialist-editorial-v1.webp", position: "50% 28%" },
  { kind: "optometrist", title: "Optometrist", description: "Vedere, dioptrii și lentile", src: HOME + "eye-consultation-v1.jpg", position: "39% 42%" },
  { kind: "optician", title: "Optician", description: "Rame, montaj și ajustări", src: SPECIALISTS + "optical-team-hero-v1.webp", position: "50% 30%" },
];

function Photo({ src, position = "center", label, number }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#EAE4D8]">
      <img src={src} alt="" width="960" height="640" loading="lazy" decoding="async"
        className="h-full w-full object-cover" style={{ objectPosition: position }} />
      {label && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
            <span className="font-heading text-[15px] font-semibold leading-tight">{label}</span>
            <span className="font-mono text-[10px] opacity-70">{number}</span>
          </div>
        </>
      )}
    </div>
  );
}

function MaterialTile({ icon: Icon }) {
  return (
    <div className="grid h-full w-full place-items-center bg-[#4C5AF4]"
      style={{ backgroundImage: "url('/images/specialists/cobalt-woven-v2.webp')", backgroundSize: "480px auto" }}>
      <Icon className="h-[63%] w-[63%] text-[#182359]" strokeWidth={1.6} aria-hidden="true" />
    </div>
  );
}

export function DoctorTile({ specialistIndex = 0 }) {
  const specialist = SPECIALIST_CARDS[specialistIndex];
  return (
    <div className="flex h-full w-full flex-col bg-[#182359] text-[#FFFDF7]">
      <div key={specialist.kind} className="specialist-card-swap relative h-[63%] shrink-0 overflow-hidden">
        <Photo src={specialist.src} position={specialist.position} />
        <span className="absolute bottom-2 left-3 rounded-full bg-[#FFFDF7]/95 px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] text-[#182359]">Specialiști pentru vedere</span>
      </div>
      <div key={specialist.title} className="specialist-card-swap flex min-h-0 flex-1 flex-col p-3.5">
        <p className="font-heading text-[1.05rem] font-bold leading-tight">{specialist.title}</p>
        <p className="mt-1 text-[11px] text-white/70">{specialist.description}</p>
        <div className="mt-auto flex items-center justify-between border-t border-white/20 pt-2 text-[11px]">
          <span>Trimite o cerere</span><ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function PinTile() { return <MaterialTile icon={MapPin} />; }
export function EyeTile() { return <MaterialTile icon={Eye} />; }
export function ApertureTile() { return <MaterialTile icon={Aperture} />; }
export function GlassesTile() { return <MaterialTile icon={Glasses} />; }
export function WrenchTile() { return <MaterialTile icon={Wrench} />; }

export function NearbyTile() {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#E9EDDF] p-5 text-[#182359]">
      <div className="flex items-start justify-between">
        <div><p className="font-heading text-[18px] font-bold">Lângă tine.</p><p className="mt-1 text-[11px] text-[#182359]/65">Clinici, cabinete și optici</p></div>
        <MapPin className="h-5 w-5" />
      </div>
      <svg viewBox="0 0 320 175" className="my-2 min-h-0 w-full flex-1" aria-hidden="true">
        <g fill="#D5DBC9">
          <path d="M10 8H83V55H10zM109 5H174V49H109zM199 10H306V57H199zM5 91H60V163H5zM83 90H175V163H83zM200 90H249V163H200zM266 91H315V163H266z" />
        </g>
        <g fill="none" stroke="#FFFDF7" strokeWidth="9">
          <path d="M-5 70L328 74M97-10L69 189M189-10L185 188M258 87L261 189" />
        </g>
        <path d="M77 126L96 72L186 72L186 122" stroke="#4C5AF4" strokeWidth="2" strokeDasharray="5 5" fill="none" />
        <circle cx="96" cy="72" r="20" fill="#4C5AF4" opacity=".13" />
        <circle cx="96" cy="72" r="7" fill="#4C5AF4" stroke="#FFFDF7" strokeWidth="3" />
        {[[77,126],[186,122],[244,40]].map(([x,y], index) => (
          <g key={index} transform={`translate(${x} ${y})`}>
            <circle r="10" fill="#182359" stroke="#FFFDF7" strokeWidth="2" />
            <circle r="3" fill="#FFFDF7" />
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between border-t border-[#182359]/15 pt-3 text-[11px]">
        <span>Caută în zona ta</span><span className="rounded-full bg-[#FFFDF7] p-1.5"><ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}

export function FiltersTile() {
  return (
    <div className="flex h-full w-full flex-col bg-[#182359] p-5 text-[#FFFDF7]">
      <p className="font-heading text-[18px] font-semibold">Alege ce ai nevoie.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Oftalmologie", "Optometrie", "Optică medicală"].map((chip, index) => (
          <span key={chip} className={`rounded-full px-2.5 py-1 text-[11px] ${index === 0 ? "bg-[#FFFDF7] text-[#182359]" : "border border-white/25 text-white/80"}`}>{chip}</span>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <p className="mb-2 flex justify-between text-[10px] text-white/70"><span>În apropierea ta</span><span>5 km</span></p>
        <div className="relative h-[2px] bg-white/20"><div className="h-full w-[38%] bg-[#FFBC7F]" /><span className="absolute left-[38%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#FFFDF7]" /></div>
        <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-3 text-[11px]"><span>Vezi opțiunile</span><ArrowRight className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

function Note({ eyebrow, title, items, footer }) {
  return (
    <div className="flex h-full w-full flex-col border border-[#182359]/10 bg-[#FFFDF7] p-5 text-[#182359]">
      <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#182359]/50">{eyebrow}</p>
      <p className="mt-4 font-heading text-[21px] font-semibold leading-[1.15] tracking-[-.035em]">{title}</p>
      <div className="mt-5 space-y-3">
        {items.map((item) => <div key={item} className="flex items-center gap-2 text-[11px]"><Check className="h-3.5 w-3.5 shrink-0 text-[#4C5AF4]" /><span>{item}</span></div>)}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-[#182359]/15 pt-3 text-[10px] text-[#182359]/65"><span>{footer}</span><ArrowRight className="h-4 w-4 shrink-0 text-[#182359]" /></div>
    </div>
  );
}

export function VisionNote() {
  return <Note eyebrow="Control de vedere" title="Mai multă claritate." items={["Evaluarea vederii", "Măsurarea dioptriilor", "Corecție optică"]} footer="Pentru adulți și copii" />;
}
export function InvestigationsNote() {
  return <Note eyebrow="Investigații" title="Un pas mai în detaliu." items={["Tomografie OCT", "Câmp vizual", "Fund de ochi"]} footer="La recomandarea medicului" />;
}
export function LensesNote() {
  return <Note eyebrow="Lentile" title="Potrivite ritmului tău." items={["Lentile pentru ochelari", "Lentile de contact", "Măsurători și adaptare"]} footer="Împreună cu specialistul" />;
}
export function RepairNote() {
  return <Note eyebrow="Atelier de optică" title="Grijă pentru fiecare detaliu." items={["Reglaje și ajustări", "Șuruburi și plăcuțe", "Reparații de rame"]} footer="Verifică opțiunile disponibile" />;
}

export function SnellenTile() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between bg-[#EEE7D8] px-4 py-5 text-[#182359]">
      <span className="self-start font-mono text-[9px] uppercase tracking-[.15em] opacity-55">Acuitate vizuală</span>
      <div className="flex flex-col items-center gap-1 font-mono font-semibold leading-none">
        <span className="text-[58px]">E</span><span className="text-[30px] tracking-[.22em]">F P</span>
        <span className="text-[22px] tracking-[.18em]">T O Z</span><span className="text-[16px] tracking-[.17em]">L P E D</span>
        <span className="mt-1 h-[2px] w-24 bg-[#C87945]" /><span className="text-[12px] tracking-[.12em]">P E C F D</span>
      </div>
      <span className="font-mono text-[8px] uppercase tracking-[.1em] opacity-50">Vedere de aproape · departe</span>
    </div>
  );
}

export function ConsultationPhoto() { return <Photo src={HOME + "eye-consultation-v1.jpg"} label="Un control, mai multă claritate." number="01" />; }
export function ConnectionPhoto() { return <Photo src={SPECIALISTS + "optician-client-editorial-v1.webp"} position="50% 30%" />; }
export function StillLifePhoto() { return <Photo src={SPECIALISTS + "optical-stilllife-v2.webp"} />; }
export function IrisPhoto() { return <Photo src={SPECIALISTS + "iris-lens-flower-v2.webp"} />; }
export function LightPhoto() { return <Photo src={SPECIALISTS + "optical-light-study-v2.webp"} />; }
export function PortraitPhoto() { return <Photo src={SPECIALISTS + "eyewear-portrait-v2.webp"} position="50% 30%" />; }
export function WorkshopPhoto() { return <Photo src={SPECIALISTS + "optical-team-hero-v1.webp"} label="Oameni și lucruri bine făcute." number="05" />; }
export function RepairPhoto() { return <Photo src={HOME + "eyewear-repair-v1.jpg"} position="50% 45%" />; }
