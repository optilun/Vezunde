import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { prefetchOnIntent } from "@/lib/routePrefetch";

// Banda de categorii de pe prima pagină: file sus („Medici ▪ Control ▪ …”), dedesubt un rând de
// plăcuțe cu mici interfețe desenate pentru categoria aleasă. Plăcuțele sunt desenate în cod
// (HTML + SVG): rămân clare la orice mărime, nu cântăresc nimic ca imagini și se pot anima.
// Categoriile se schimbă singure la câteva secunde cât timp banda e pe ecran; se opresc la
// trecerea mouse-ului, la alegerea unei file, la derularea benzii pe telefon și cu „reducere
// mișcare” activă în sistem.

const INTERVAL_MS = 3200;

function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

// ── Piese comune ─────────────────────────────────────────────────────────────────────────────

function Tile({ bg, color, row = false, className = "", children }) {
  return (
    <div className={`flex h-full w-full ${row ? "flex-row" : "flex-col"} ${className}`} style={{ backgroundColor: bg, color }}>
      {children}
    </div>
  );
}

function TileLabel({ children, className = "" }) {
  return <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${className}`}>{children}</span>;
}

function Toggle({ on, onColor, knob = "#ffffff" }) {
  return (
    <span className="relative h-4 w-7 shrink-0 rounded-full" style={{ backgroundColor: on ? onColor : "rgba(255,255,255,0.18)" }}>
      <span className="absolute top-0.5 h-3 w-3 rounded-full" style={{ left: on ? "0.875rem" : "0.125rem", backgroundColor: knob }} />
    </span>
  );
}

function Slider({ label, value, pct, track, fill, text }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]" style={{ color: text }}>
        <span>{label}</span>
        <span className="font-mono text-[10.5px]">{value}</span>
      </div>
      <div className="relative mt-2 h-[3px] rounded-full" style={{ backgroundColor: track }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: fill }} />
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
          style={{ left: `${pct}%`, borderColor: fill }}
        />
      </div>
    </div>
  );
}

// Plăcuță pătrată cu o pictogramă mare „tipărită” din puncte (raster), cu o a doua tipărire mai
// închisă, ușor decalată, ca la un afiș serigrafiat.
function HalftoneTile({ bg, dot, shadow, children }) {
  const id = useSvgId("ht");
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        backgroundColor: bg,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 0.8px, transparent 1.15px)",
        backgroundSize: "5px 5px",
      }}
    >
      <svg viewBox="0 0 100 100" className="h-[74%] w-[74%] overflow-visible" aria-hidden="true">
        <defs>
          <pattern id={id} width="3.6" height="3.6" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="1.3" fill={dot} />
          </pattern>
          <pattern id={`${id}-s`} width="3.6" height="3.6" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="1.3" fill={shadow} />
          </pattern>
        </defs>
        <g transform="translate(4.5 4.5)">{children(`url(#${id}-s)`)}</g>
        {children(`url(#${id})`)}
      </svg>
    </div>
  );
}

// ── Medici și clinici ──────────────────────────────────────────────────────────────────────

function DoctorTile() {
  return (
    <Tile bg="#5a4468" color="#ffffff">
      <div
        className="relative h-[52%] shrink-0 overflow-hidden"
        style={{
          backgroundColor: "#b9a2cf",
          backgroundImage: "radial-gradient(circle, rgba(74,54,87,0.28) 0.9px, transparent 1.25px)",
          backgroundSize: "6px 6px",
        }}
      >
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-[#3f2d4c]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3f9a48]" />
          Primește cereri
        </span>
        <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#e8e0ea]/60" />
        <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[86%] w-full" aria-hidden="true">
          <path d="M36 120C40 91 68 79 100 79s60 12 64 41Z" fill="#ffffff" stroke="#171717" strokeWidth="3" />
          <path d="M86 80 100 104 114 80Z" fill="#684d78" stroke="#171717" strokeWidth="3" strokeLinejoin="round" />
          <path d="M86 80 95 120M114 80l-9 40" stroke="#171717" strokeWidth="2.5" />
          <path d="M83 83c-10 10-11 23-1 29M117 83c10 10 11 21 3 27" fill="none" stroke="#2b2133" strokeWidth="3" strokeLinecap="round" />
          <circle cx="120" cy="112" r="5.5" fill="#d4c6d8" stroke="#171717" strokeWidth="2.5" />
          <rect x="129" y="95" width="16" height="10" rx="2" fill="#684d78" />
          <rect x="91" y="63" width="18" height="18" rx="4" fill="#dc9a78" />
          <circle cx="100" cy="47" r="23" fill="#e7ad8c" stroke="#171717" strokeWidth="2.5" />
          <path d="M77 46c-1-20 12-28 24-28 15 0 24 11 22 26-8-8-21-11-32-7-6 2-10 5-14 9Z" fill="#2b2133" />
          <g fill="#f6eefa" stroke="#171717" strokeWidth="2.5">
            <circle cx="90" cy="50" r="8" />
            <circle cx="110" cy="50" r="8" />
          </g>
          <path d="M98 50h4" stroke="#171717" strokeWidth="2.5" />
          <circle cx="91" cy="51" r="2" fill="#171717" />
          <circle cx="111" cy="51" r="2" fill="#171717" />
          <path d="M95 61c3.5 3 6.5 3 10 0" fill="none" stroke="#171717" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <p className="font-heading text-[1.05rem] font-bold leading-tight">Medic oftalmolog</p>
        <p className="mt-0.5 text-[11.5px] text-white/65">Adulți și copii · consult, fund de ochi</p>
        <div className="mt-auto flex items-center justify-between rounded-md bg-white px-3 py-2 text-[#3f2d4c]">
          <span className="text-[12px] font-semibold">Trimite o cerere</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      </div>
    </Tile>
  );
}

function PinHalftoneTile() {
  return (
    <HalftoneTile bg="#b29dc5" dot="#f5eff9" shadow="#6d5585">
      {(paint) => (
        <path
          fill={paint}
          fillRule="evenodd"
          d="M50 5C32 5 18 19 18 36.5 18 60 50 95 50 95s32-35 32-58.5C82 19 68 5 50 5Zm13 31.5a13 13 0 1 1-26 0 13 13 0 1 1 26 0Z"
        />
      )}
    </HalftoneTile>
  );
}

// Harta României ca grilă de pătrățele: conturul (aproximativ) e un poligon în grade, iar
// pătrățelele din interior se calculează o singură dată, la prima afișare.
const RO_BORDER = [
  [20.26, 46.11], [21.0, 46.24], [21.6, 46.7], [21.95, 47.2], [22.3, 47.6], [22.9, 47.95], [23.5, 48.0],
  [24.2, 47.95], [24.9, 47.72], [25.6, 47.93], [26.3, 48.2], [26.8, 48.25], [27.3, 47.95], [27.8, 47.35],
  [28.2, 46.8], [28.25, 46.1], [28.1, 45.5], [28.75, 45.25], [29.66, 45.2], [29.7, 44.85], [29.0, 44.7],
  [28.65, 44.2], [28.58, 43.74], [27.95, 43.9], [27.3, 44.12], [26.4, 44.0], [25.4, 43.63], [24.5, 43.7],
  [23.5, 43.84], [22.9, 43.9], [22.5, 44.3], [22.7, 44.55], [22.1, 44.65], [21.5, 44.8], [21.4, 45.05],
  [21.1, 45.3], [20.7, 45.6], [20.45, 45.9],
];
const MAP_LON0 = 20.15;
const MAP_LAT0 = 48.35;
const MAP_LON_SCALE = 0.69;
const MAP_STEP = 0.165;
const toMap = (lon, lat) => [(lon - MAP_LON0) * MAP_LON_SCALE * 100, (MAP_LAT0 - lat) * 100];

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let mapDotsCache = null;
function getMapDots() {
  if (mapDotsCache) return mapDotsCache;
  const dots = [];
  for (let lat = MAP_LAT0; lat >= 43.55; lat -= MAP_STEP) {
    for (let lon = MAP_LON0; lon <= 29.85; lon += MAP_STEP / MAP_LON_SCALE) {
      if (insidePolygon(lon, lat, RO_BORDER)) dots.push(toMap(lon, lat));
    }
  }
  mapDotsCache = dots;
  return dots;
}

const MAP_CITIES = [
  { name: "Cluj-Napoca", at: [23.59, 46.77], active: true },
  { name: "București", at: [26.1, 44.43] },
  { name: "Iași", at: [27.59, 47.16] },
  { name: "Timișoara", at: [21.23, 45.75] },
  { name: "Constanța", at: [28.63, 44.18] },
  { name: "Brașov", at: [25.59, 45.65] },
  { name: "Craiova", at: [23.8, 44.32] },
  { name: "Oradea", at: [21.92, 47.07] },
];

const MAP_RESULTS = [
  { name: "Cabinet oftalmologic", distance: "1,2 km", color: "#684d78", offset: [-70, 62] },
  { name: "Optică medicală", distance: "2,4 km", color: "#c77d67", offset: [104, 18] },
  { name: "Clinică de specialitate", distance: "3,1 km", color: "#5f8a76", offset: [30, 150] },
];

function MapTile() {
  const dots = getMapDots();
  const cities = MAP_CITIES.map((city) => ({ ...city, xy: toMap(...city.at) }));
  const [ax, ay] = cities[0].xy;

  return (
    <Tile bg="#efe8f3" color="#2b2133" row>
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-3">
          <svg viewBox="-12 -12 690 500" className="h-full w-full" aria-hidden="true">
            {dots.map(([x, y]) => {
              const distance = Math.hypot(x - ax, y - ay);
              const fill = distance < 80 ? "#7d609a" : distance < 170 ? "#a78fbf" : "#d3c6df";
              return <rect key={`${x.toFixed(1)}-${y.toFixed(1)}`} x={x - 6.5} y={y - 6.5} width="13" height="13" rx="2" fill={fill} />;
            })}
            <g fill="none" stroke="#684d78" strokeWidth="3" strokeDasharray="8 9" opacity="0.6">
              <circle cx={ax} cy={ay} r="110" />
              <circle cx={ax} cy={ay} r="190" />
            </g>
            {cities.slice(1).map((city) => (
              <circle key={city.name} cx={city.xy[0]} cy={city.xy[1]} r="9" fill="#2b2133" stroke="#ffffff" strokeWidth="4" />
            ))}
            {MAP_RESULTS.map((result) => {
              const x = ax + result.offset[0];
              const y = ay + result.offset[1];
              return (
                <g key={result.name}>
                  <path d={`M${ax} ${ay}L${x} ${y}`} stroke={result.color} strokeWidth="4" />
                  <rect x={x - 12} y={y - 12} width="24" height="24" rx="5" fill={result.color} stroke="#ffffff" strokeWidth="4" />
                </g>
              );
            })}
            <circle cx={ax} cy={ay} r="21" fill="#2b2133" stroke="#ffffff" strokeWidth="6" />
            <circle cx={ax} cy={ay} r="7" fill="#ffffff" />
            <g transform={`translate(${ax - 114} ${ay - 96})`}>
              <rect width="228" height="58" rx="10" fill="#2b2133" />
              <text x="20" y="38" fill="#ffffff" fontSize="28" fontWeight="700" fontFamily="Manrope, sans-serif">Cluj-Napoca</text>
            </g>
          </svg>
        </div>
      </div>
      <div className="flex w-[36%] min-w-[9rem] max-w-[12rem] flex-col gap-2 p-2.5 pl-0">
        <div className="rounded-md bg-[#684d78] p-3 text-white">
          <p className="font-heading text-[15px] font-bold leading-tight">Lângă tine</p>
          <p className="mt-1 text-[10.5px] text-white/70">Ordonate după distanță</p>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 rounded-md bg-[#e8e0ea] p-3">
          {MAP_RESULTS.map((result) => (
            <div key={result.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: result.color }} />
              <span className="min-w-0 flex-1 truncate text-[11px]">{result.name}</span>
              <span className="font-mono text-[10px] text-black/50">{result.distance}</span>
            </div>
          ))}
          <div className="mt-auto grid grid-cols-2 overflow-hidden rounded border border-[#d4c6d8] text-center text-[10.5px]">
            <span className="bg-white py-1 font-semibold">Hartă</span>
            <span className="py-1 text-black/55">Listă</span>
          </div>
        </div>
      </div>
    </Tile>
  );
}

const BUSY_HOURS = [28, 42, 66, 88, 72, 50, 58, 80, 62, 36, 22];

function ScheduleTile() {
  return (
    <Tile bg="#fffdf8" color="#231c28" className="border border-black/[0.06] p-5">
      <div className="flex items-center justify-between gap-2">
        <TileLabel className="text-black/50">Program azi</TileLabel>
        <span className="flex items-center gap-1.5 rounded-full bg-[#e3f1df] px-2 py-0.5 text-[10.5px] font-semibold text-[#2f6b35]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3f9a48]" />
          Deschis
        </span>
      </div>
      <p className="mt-4 font-heading text-[2.3rem] font-extrabold leading-none tracking-[-0.05em]">
        08<span className="text-[#684d78]">–</span>20
      </p>
      <p className="mt-1.5 text-[11px] text-black/50">Sâmbătă 09–14 · Duminică închis</p>
      <div className="mt-auto pt-6">
        <div className="flex h-16 items-end gap-[3px]">
          {BUSY_HOURS.map((value, index) => (
            <span
              key={index}
              className="relative flex-1 rounded-t-[3px]"
              style={{ height: `${value}%`, background: index === 4 ? "#684d78" : "linear-gradient(#c9b9d7, #ebe3f0)" }}
            >
              {index === 4 && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-[#231c28] px-1 py-px font-mono text-[8.5px] text-white">acum</span>
              )}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-between border-t border-black/10 pt-1 font-mono text-[9.5px] text-black/40">
          <span>08</span>
          <span>14</span>
          <span>20</span>
        </div>
      </div>
    </Tile>
  );
}

function FiltersTile() {
  return (
    <Tile bg="#1d1922" color="#ffffff" className="p-5">
      <p className="font-heading text-[15px] font-bold">Filtrează</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["Oftalmologie", "Optometrie", "Optică medicală", "Pediatrie"].map((chip, index) => (
          <span
            key={chip}
            className={`rounded-full px-2.5 py-1 text-[11px] ${index === 0 ? "bg-[#d4c6d8] font-semibold text-[#2b2133]" : "border border-white/20 text-white/75"}`}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-5">
        <Slider label="Distanță maximă" value="5 km" pct={34} track="rgba(255,255,255,0.18)" fill="#d4c6d8" text="rgba(255,255,255,0.8)" />
      </div>
      <div className="mt-5 text-[12px] text-white/80">
        <div className="flex items-center justify-between gap-3">
          <span>Primește cereri online</span>
          <Toggle on onColor="#d4c6d8" knob="#1d1922" />
        </div>
      </div>
      <span className="mt-auto block rounded-md bg-[#d4c6d8] py-2.5 text-center text-[12px] font-semibold text-[#2b2133]">
        Arată rezultatele
      </span>
    </Tile>
  );
}

// ── Control de vedere ──────────────────────────────────────────────────────────────────────

function RefractionTile() {
  return (
    <Tile bg="#dce7ee" color="#1d3441" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Refracție</p>
        <span className="grid grid-cols-2 overflow-hidden rounded border border-[#1d3441]/20 text-center font-mono text-[10px]">
          <span className="bg-[#1d3441] px-2 py-0.5 text-white">OD</span>
          <span className="px-2 py-0.5">OS</span>
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="font-heading text-[2.6rem] font-extrabold leading-none tracking-[-0.05em] text-[#345bc8]">−1,25</span>
        <span className="pb-1 font-mono text-[10.5px] text-[#1d3441]/70">D · sferă</span>
      </div>
      <div className="mt-5 space-y-4">
        <Slider label="Cilindru" value="−0,50 D" pct={22} track="rgba(29,52,65,0.15)" fill="#345bc8" text="#1d3441" />
        <Slider label="Ax" value="90°" pct={50} track="rgba(29,52,65,0.15)" fill="#345bc8" text="#1d3441" />
      </div>
      <p className="mt-auto flex justify-between border-t border-[#1d3441]/15 pt-2.5 font-mono text-[10.5px]">
        <span>ADD +1,50</span>
        <span>DP 63 mm</span>
      </p>
    </Tile>
  );
}

const SNELLEN_ROWS = [
  { letters: "E", size: 36, score: "6/60" },
  { letters: "F P", size: 26, score: "6/36" },
  { letters: "T O Z", size: 20, score: "6/24" },
  { letters: "L P E D", size: 15.5, score: "6/18" },
  { letters: "P E C F D", size: 12.5, score: "6/12", mark: true },
  { letters: "E D F C Z P", size: 10, score: "6/6" },
];

function SnellenTile() {
  return (
    <Tile bg="#1f3d4d" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Acuitate vizuală</p>
        <TileLabel className="text-white/55">Ochiul drept</TileLabel>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-[0.45rem]">
        {SNELLEN_ROWS.map((row) => (
          <div key={row.score} className="relative grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
            <span className="font-mono text-[10px] text-[#f09a74]">{row.mark ? "▶" : ""}</span>
            <span
              className="text-center font-heading font-extrabold leading-none tracking-[0.18em] text-white"
              style={{ fontSize: `${row.size}px` }}
            >
              {row.letters}
            </span>
            <span className={`text-right font-mono text-[10px] ${row.mark ? "text-[#f09a74]" : "text-white/45"}`}>{row.score}</span>
            {row.mark && <span className="absolute inset-x-8 -bottom-1 h-px bg-[#f09a74]/80" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3 text-[11px] text-white/70">
        <span>Distanță de citire</span>
        <span className="font-mono">6 m</span>
      </div>
    </Tile>
  );
}

function EHalftoneTile() {
  return (
    <HalftoneTile bg="#345bc8" dot="#b3c4f6" shadow="#1b2f86">
      {(paint) => (
        <g fill={paint}>
          <rect x="16" y="16" width="68" height="15" />
          <rect x="16" y="42.5" width="54" height="15" />
          <rect x="16" y="69" width="68" height="15" />
          <rect x="16" y="16" width="15" height="68" />
        </g>
      )}
    </HalftoneTile>
  );
}

// Planșă pentru vederea culorilor: cercuri de mărimi diferite, iar cele din conturul cifrei
// sunt colorate altfel. Pozițiile vin dintr-un generator cu sămânță fixă (mereu aceeași planșă).
let plateDotsCache = null;
function getPlateDots() {
  if (plateDotsCache) return plateDotsCache;
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Grilă hexagonală ușor deplasată: cercuri dese, fără suprapuneri, calculate într-o singură trecere.
  const dots = [];
  const step = 4.3;
  for (let row = 0; row * step * 0.87 <= 100; row += 1) {
    for (let col = 0; col * step <= 100; col += 1) {
      const x = col * step + (row % 2 ? step / 2 : 0) + (random() - 0.5) * 0.7;
      const y = row * step * 0.87 + (random() - 0.5) * 0.7;
      const r = 1.15 + random() * 0.75;
      if (Math.hypot(x - 50, y - 50) + r > 46.5) continue;
      dots.push([x, y, r, random()]);
    }
  }
  plateDotsCache = dots;
  return dots;
}
const PLATE_GREENS = ["#8ea36a", "#a8b97c", "#6f8a55", "#bcc78f"];
const PLATE_ORANGES = ["#e0874f", "#ec9d62", "#d27040", "#f1ad78"];

function ColorPlateTile() {
  const id = useSvgId("plate");
  const dots = getPlateDots();
  return (
    <Tile bg="#f7f3ec" color="#23303a" className="p-4">
      <TileLabel className="text-center text-[#23303a]/55">Test culori</TileLabel>
      <div className="flex flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 100 100" className="h-full max-h-[8.5rem] w-full" aria-hidden="true">
          <defs>
            <clipPath id={id}>
              <text x="50" y="67" textAnchor="middle" fontSize="50" fontWeight="800" fontFamily="Manrope, sans-serif">74</text>
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="48.5" fill="#efe6d6" />
          {dots.map(([x, y, r, c], index) => (
            <circle key={index} cx={x} cy={y} r={r} fill={PLATE_GREENS[Math.floor(c * 4)]} />
          ))}
          <g clipPath={`url(#${id})`}>
            {dots.map(([x, y, r, c], index) => (
              <circle key={index} cx={x} cy={y} r={r} fill={PLATE_ORANGES[Math.floor(c * 4)]} />
            ))}
          </g>
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
        {["21", "74", "Nu văd"].map((answer) => (
          <span
            key={answer}
            className={`rounded-md py-1.5 ${answer === "74" ? "bg-[#1f3d4d] font-semibold text-white" : "border border-black/10"}`}
          >
            {answer}
          </span>
        ))}
      </div>
    </Tile>
  );
}

// Cadranul pentru astigmatism: raze la fiecare 15°; cea „mai închisă” (ora 2–8) e evidențiată.
const DIAL_LINES = Array.from({ length: 13 }, (_, index) => index * 15);
const DIAL_HOURS = [[180, "9"], [150, "10"], [120, "11"], [90, "12"], [60, "1"], [30, "2"], [0, "3"]];

function AstigmatismTile() {
  return (
    <Tile bg="#15232c" color="#ffffff" className="p-5">
      <p className="font-heading text-[15px] font-bold">Test astigmatism</p>
      <p className="mt-1 text-[11px] text-white/55">Care linii par mai închise?</p>
      <div className="flex min-h-0 flex-1 items-end justify-center pt-2">
        <svg viewBox="0 0 200 118" className="w-full max-w-[15rem]" aria-hidden="true">
          {DIAL_LINES.map((deg) => {
            const [x1, y1] = polar(100, 106, 16, deg);
            const [x2, y2] = polar(100, 106, 84, deg);
            const strong = deg === 30;
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strong ? "#a9c6d7" : "#ffffff"}
                strokeOpacity={strong ? 1 : 0.82}
                strokeWidth={strong ? 7.5 : 4}
                strokeLinecap="round"
              />
            );
          })}
          {DIAL_HOURS.map(([deg, label]) => {
            const [x, y] = polar(100, 106, 97, deg);
            return (
              <text key={label} x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#ffffff" fillOpacity="0.55">
                {label}
              </text>
            );
          })}
          <circle cx="100" cy="106" r="5" fill="#a9c6d7" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {["12 – 6", "2 – 8", "3 – 9"].map((answer) => (
          <span
            key={answer}
            className={`rounded-md py-1.5 text-center font-mono text-[10.5px] ${answer === "2 – 8" ? "bg-[#a9c6d7] font-semibold text-[#15232c]" : "bg-white/10 text-white/75"}`}
          >
            {answer}
          </span>
        ))}
      </div>
    </Tile>
  );
}

// ── Investigații ───────────────────────────────────────────────────────────────────────────

function octLayer(y, dip) {
  return `M0 ${y} C90 ${y - 5} 140 ${y - 5} 170 ${y + dip * 0.55} C186 ${y + dip} 214 ${y + dip} 230 ${y + dip * 0.55} C260 ${y - 5} 310 ${y - 5} 400 ${y}`;
}
const OCT_LAYERS = Array.from({ length: 9 }, (_, k) => ({
  y: 52 + k * 11 + (k >= 7 ? 6 : 0),
  dip: Math.max(0, 26 - k * 4),
}));
// Straturile retinei colorate de sus în jos, ca pe o imagine OCT în pseudo-culori.
const OCT_BANDS = ["#35603a", "#4f8443", "#7ea653", "#b2c666", "#dcd77f", "#a4bd6c", "#5f8c4c", "#f2edc2", "#2c4a31"];

function OctTile() {
  const glow = useSvgId("scan");
  return (
    <Tile bg="#1d3325" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Tomografie OCT</p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b9e39a]" />
          Scanare
        </span>
      </div>
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-md bg-[#0c1710]">
        <svg viewBox="0 0 400 190" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={glow} x1="0" x2="1">
              <stop offset="0" stopColor="#d9ffc0" stopOpacity="0" />
              <stop offset="0.5" stopColor="#d9ffc0" stopOpacity="0.28" />
              <stop offset="1" stopColor="#d9ffc0" stopOpacity="0" />
            </linearGradient>
          </defs>
          {OCT_LAYERS.map((layer, index) => (
            <path key={`band-${layer.y}`} d={`${octLayer(layer.y, layer.dip)} L400 190 L0 190 Z`} fill={OCT_BANDS[index]} />
          ))}
          {OCT_LAYERS.map((layer) => (
            <path key={layer.y} d={octLayer(layer.y, layer.dip)} fill="none" stroke="#0f1d13" strokeOpacity="0.3" strokeWidth="0.8" />
          ))}
          <g className="cat-scan">
            <rect x="6" y="18" width="28" height="160" fill={`url(#${glow})`} />
            <rect x="19.3" y="18" width="1.4" height="160" fill="#e6ffd4" />
          </g>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {[["Ochi", "OD"], ["Zonă", "Maculă"], ["Secțiuni", "128"]].map(([label, value]) => (
          <div key={label}>
            <p className="text-white/50">{label}</p>
            <p className="mt-0.5 font-mono text-[11.5px]">{value}</p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function FundusTile() {
  const fundus = useSvgId("fundus");
  const macula = useSvgId("macula");
  const halo = useSvgId("halo");
  return (
    <Tile bg="#0d1510" color="#ffffff" className="p-4">
      <div className="flex items-center justify-between">
        <TileLabel className="text-white/55">Fund de ochi</TileLabel>
        <TileLabel className="text-white/55">OD</TileLabel>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center pt-1">
        <svg viewBox="0 0 110 110" className="h-full max-h-[10rem] w-full" aria-hidden="true">
          <defs>
            <radialGradient id={halo} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.8" stopColor="#e2743a" stopOpacity="0.35" />
              <stop offset="1" stopColor="#e2743a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={fundus} cx="0.55" cy="0.5" r="0.55">
              <stop offset="0" stopColor="#f5b066" />
              <stop offset="0.65" stopColor="#dc6c30" />
              <stop offset="1" stopColor="#7c2a12" />
            </radialGradient>
            <radialGradient id={macula} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#6e230e" stopOpacity="0.8" />
              <stop offset="1" stopColor="#6e230e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="55" cy="55" r="55" fill={`url(#${halo})`} />
          <g transform="translate(5 5)">
            <circle cx="50" cy="50" r="47" fill={`url(#${fundus})`} />
            <circle cx="63" cy="51" r="12" fill={`url(#${macula})`} />
            <g fill="none" stroke="#8a2413" strokeLinecap="round" opacity="0.9">
              <path d="M34 45C44 35 57 27 76 20" strokeWidth="1.8" />
              <path d="M33 44C39 30 47 19 57 10" strokeWidth="1.4" />
              <path d="M34 55C44 66 57 73 77 80" strokeWidth="1.8" />
              <path d="M33 56C39 70 47 81 58 90" strokeWidth="1.4" />
              <path d="M58 29C64 33 71 35 82 35" strokeWidth="1" />
              <path d="M58 71C64 67 72 65 83 65" strokeWidth="1" />
              <path d="M66 24C70 30 76 32 86 44" strokeWidth="0.8" />
              <path d="M66 76C70 70 76 68 86 56" strokeWidth="0.8" />
              <path d="M30 47C22 42 15 38 8 38" strokeWidth="1.1" />
              <path d="M30 53C22 58 15 62 9 63" strokeWidth="1.1" />
            </g>
            <circle cx="32" cy="50" r="7.5" fill="#f7d690" />
            <circle cx="32.5" cy="50" r="3.5" fill="#fbe9bd" />
          </g>
        </svg>
      </div>
    </Tile>
  );
}

const FIELD_CELLS = (() => {
  const cells = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const dx = col - 4;
      const dy = row - 4;
      const distance = Math.hypot(dx, dy);
      if (distance > 4.7) continue;
      let value = 0.08 + distance * 0.075 + ((col * 7 + row * 13) % 5) * 0.025;
      if (col === 6 && (row === 4 || row === 5)) value = 0.92;
      const shade = Math.round(243 - value * 200);
      cells.push({ x: col * 10 + 5, y: row * 10 + 5, fill: `rgb(${shade - 6}, ${shade}, ${shade - 16})` });
    }
  }
  return cells;
})();

function VisualFieldTile() {
  return (
    <Tile bg="#dde4cb" color="#26331f" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Câmp vizual</p>
        <TileLabel className="text-[#26331f]/55">24-2 · OD</TileLabel>
      </div>
      <div className="flex flex-1 items-center justify-center py-3">
        <svg viewBox="0 0 100 100" className="h-full max-h-[9.5rem] w-full" aria-hidden="true">
          {FIELD_CELLS.map((cell) => (
            <rect key={`${cell.x}-${cell.y}`} x={cell.x + 0.8} y={cell.y + 0.8} width="8.4" height="8.4" fill={cell.fill} />
          ))}
          <path d="M50 2V98M2 50H98" stroke="#26331f" strokeWidth="0.6" opacity="0.55" />
        </svg>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#26331f]/60">
        <span>Sensibilitate</span>
        <span className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-[#3a4430] to-[#eef1e4]" />
      </div>
    </Tile>
  );
}

function annularSector(cx, cy, r1, r2, a0, a1) {
  const [x1, y1] = polar(cx, cy, r2, a0);
  const [x2, y2] = polar(cx, cy, r2, a1);
  const [x3, y3] = polar(cx, cy, r1, a1);
  const [x4, y4] = polar(cx, cy, r1, a0);
  const f = (value) => value.toFixed(2);
  return `M${f(x1)} ${f(y1)} A${r2} ${r2} 0 0 0 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${r1} ${r1} 0 0 1 ${f(x4)} ${f(y4)} Z`;
}
// Grosimea retinei pe zone (µm): centru, inel interior și exterior (sus, dreapta, jos, stânga).
const THICKNESS = { center: 268, inner: [322, 336, 318, 329], outer: [289, 301, 276, 294] };
const SECTOR_ANGLES = [90, 0, 270, 180];
const thicknessColor = (value) =>
  value >= 330 ? "#e98a4f" : value >= 315 ? "#e7c25c" : value >= 290 ? "#a7c76c" : value >= 272 ? "#6fa56b" : "#3f7d6b";

function ThicknessMapTile() {
  return (
    <Tile bg="#f1ecd9" color="#26331f" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Grosime retină</p>
        <TileLabel className="text-[#26331f]/55">µm</TileLabel>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 120 120" className="h-full max-h-[9.5rem] w-full" aria-hidden="true">
          {SECTOR_ANGLES.map((angle, index) => (
            <g key={angle}>
              <path d={annularSector(60, 60, 36, 57, angle - 45, angle + 45)} fill={thicknessColor(THICKNESS.outer[index])} stroke="#f1ecd9" strokeWidth="1.6" />
              <path d={annularSector(60, 60, 17, 36, angle - 45, angle + 45)} fill={thicknessColor(THICKNESS.inner[index])} stroke="#f1ecd9" strokeWidth="1.6" />
            </g>
          ))}
          <circle cx="60" cy="60" r="17" fill={thicknessColor(THICKNESS.center)} stroke="#f1ecd9" strokeWidth="1.6" />
          <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="7.5" fontWeight="600" textAnchor="middle" fill="#1a2415">
            {SECTOR_ANGLES.map((angle, index) => {
              const [ox, oy] = polar(60, 60, 47, angle);
              const [ix, iy] = polar(60, 60, 26.5, angle);
              return (
                <React.Fragment key={angle}>
                  <text x={ox} y={oy + 2.6}>{THICKNESS.outer[index]}</text>
                  <text x={ix} y={iy + 2.6}>{THICKNESS.inner[index]}</text>
                </React.Fragment>
              );
            })}
            <text x="60" y="62.6" fill="#ffffff">{THICKNESS.center}</text>
          </g>
        </svg>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#26331f]/60">
        <span>subțire</span>
        <span className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-[#3f7d6b] via-[#e7c25c] to-[#e98a4f]" />
        <span>groasă</span>
      </div>
    </Tile>
  );
}

const GAUGE_MAX = 40;
const gaugeAngle = (value) => 180 - (value / GAUGE_MAX) * 180;
function gaugeArc(from, to, r) {
  const [x1, y1] = polar(100, 100, r, gaugeAngle(from));
  const [x2, y2] = polar(100, 100, r, gaugeAngle(to));
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function PressureTile() {
  const [nx, ny] = polar(100, 100, 58, gaugeAngle(16));
  return (
    <Tile bg="#141a14" color="#ffffff" className="p-5">
      <p className="font-heading text-[15px] font-bold">Tensiune oculară</p>
      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        <svg viewBox="0 0 200 112" className="w-full max-w-[13rem]" aria-hidden="true">
          <path d={gaugeArc(0, GAUGE_MAX, 80)} fill="none" stroke="#2a3529" strokeWidth="14" strokeLinecap="round" />
          <path d={gaugeArc(10, 21, 80)} fill="none" stroke="#9fcf8f" strokeWidth="14" />
          {Array.from({ length: 9 }, (_, index) => {
            const [x1, y1] = polar(100, 100, 64, gaugeAngle(index * 5));
            const [x2, y2] = polar(100, 100, 69, gaugeAngle(index * 5));
            return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />;
          })}
          <line x1="100" y1="100" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill="#ffffff" />
        </svg>
        <p className="mt-2 font-heading text-[2.4rem] font-extrabold leading-none tracking-[-0.04em]">
          16 <span className="text-[0.9rem] font-semibold tracking-normal text-white/55">mmHg</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-[11px]">
        <div>
          <p className="text-white/50">OD</p>
          <p className="font-mono">16</p>
        </div>
        <div>
          <p className="text-white/50">OS</p>
          <p className="font-mono">15</p>
        </div>
      </div>
    </Tile>
  );
}

// ── Ochelari și lentile ────────────────────────────────────────────────────────────────────

function FrameShapeTile() {
  return (
    <Tile bg="#bf5a36" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Forma ramei</p>
        <TileLabel className="text-white/60">02 / 12</TileLabel>
      </div>
      <div className="flex flex-1 items-center justify-center px-2 py-3">
        <svg viewBox="0 0 400 190" className="h-full max-h-[8rem] w-full" aria-hidden="true">
          <g fill="rgba(255,255,255,0.12)" stroke="#fbe7da" strokeWidth="9" strokeLinejoin="round">
            <rect x="46" y="46" width="126" height="96" rx="30" />
            <rect x="228" y="46" width="126" height="96" rx="30" />
          </g>
          <g fill="none" stroke="#fbe7da" strokeWidth="9" strokeLinecap="round">
            <path d="M172 76C188 62 212 62 228 76" />
            <path d="M46 70 16 60" />
            <path d="M354 70l30-10" />
          </g>
          <path d="M66 64c16-8 44-10 62-4M248 64c16-8 44-10 62-4" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Rotunde", "Pătrate", "Cat-eye", "Aviator"].map((shape) => (
          <span
            key={shape}
            className={`rounded-full px-2.5 py-1 text-[11px] ${shape === "Pătrate" ? "bg-[#fbe7da] font-semibold text-[#7c3219]" : "border border-white/35 text-white/85"}`}
          >
            {shape}
          </span>
        ))}
      </div>
    </Tile>
  );
}

function GlassesHalftoneTile() {
  return (
    <HalftoneTile bg="#e6946a" dot="#fde9dd" shadow="#a54f2a">
      {(paint) => (
        <g fill="none" stroke={paint} strokeWidth="9" strokeLinecap="round">
          <circle cx="28" cy="56" r="17" />
          <circle cx="72" cy="56" r="17" />
          <path d="M45 54c3-5 7-5 10 0" />
          <path d="M11 52 5 38M89 52l6-14" />
        </g>
      )}
    </HalftoneTile>
  );
}

const TINTS = ["#f6e3d5", "#ebc6aa", "#dca47f", "#c27b53", "#9d5a37", "#6d3a22"];

function TintTile() {
  return (
    <Tile bg="#ffffff" color="#2a1a12" className="border border-black/[0.06] p-4">
      <p className="text-center font-heading text-[14px] font-bold">Nuanța lentilelor</p>
      <div className="mt-3 flex items-end justify-between px-1">
        {Array.from({ length: 17 }, (_, index) => (
          <span key={index} className="w-px bg-[#2a1a12]" style={{ height: index === 9 ? 16 : index % 4 === 1 ? 10 : 6, opacity: index === 9 ? 1 : 0.45 }} />
        ))}
      </div>
      <div className="mt-3 grid flex-1 grid-cols-3 gap-[3px]">
        {TINTS.map((tint, index) => (
          <span key={tint} className={`min-h-[2.2rem] ${index === 3 ? "ring-2 ring-inset ring-[#2a1a12]" : ""}`} style={{ backgroundColor: tint }} />
        ))}
      </div>
      <span className="mt-3 block rounded-md bg-[#1c1411] py-2 text-center text-[11.5px] font-semibold text-white">Confirmă</span>
    </Tile>
  );
}

function LensZonesTile() {
  const clip = useSvgId("lens");
  const hatch = useSvgId("hatch");
  const far = useSvgId("far");
  const zones = [
    { label: "Departe", swatch: "#ffffff" },
    { label: "Intermediar", swatch: "#f6c9ad" },
    { label: "Aproape", swatch: "#ee9f78" },
    { label: "Periferie", swatch: "repeating-linear-gradient(45deg, #e7bda3 0 3px, #c98468 3px 4.5px)" },
  ];
  const outline = "M26 28C44 8 156 8 174 28C192 48 190 108 170 128C150 146 50 146 30 128C10 108 8 48 26 28Z";
  return (
    <Tile bg="#f5e4d6" color="#3b1f12" className="p-5">
      <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[#3b1f12]/15 text-center text-[10.5px]">
        {["Monofocale", "Progresive", "Birou"].map((type) => (
          <span key={type} className={`py-1 ${type === "Progresive" ? "bg-[#3b1f12] font-semibold text-white" : ""}`}>{type}</span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        <svg viewBox="0 0 200 150" className="h-full max-h-[8.5rem] w-full" aria-hidden="true">
          <defs>
            <clipPath id={clip}>
              <path d={outline} />
            </clipPath>
            <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#e7bda3" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="#b85d3f" strokeWidth="2.2" strokeOpacity="0.5" />
            </pattern>
            <linearGradient id={far} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#fde9dc" />
            </linearGradient>
          </defs>
          <g clipPath={`url(#${clip})`}>
            <rect width="200" height="150" fill={`url(#${hatch})`} />
            <path d="M0 0H200V60C150 64 122 68 110 72H90C78 68 50 64 0 60Z" fill={`url(#${far})`} />
            <path d="M90 72H110L114 98H86Z" fill="#f6c9ad" />
            <path d="M86 98H114C140 100 160 108 172 150H28C40 108 60 100 86 98Z" fill="#ee9f78" />
          </g>
          <path d={outline} fill="none" stroke="#7c3219" strokeWidth="4" />
          <path d="M44 24c30-10 80-11 110-3" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {zones.map((zone) => (
          <div key={zone.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[#3b1f12]/25" style={{ background: zone.swatch }} />
            <span className="truncate">{zone.label}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function MeasureTile() {
  return (
    <Tile bg="#1f1814" color="#fbe7da" className="p-5">
      <p className="font-heading text-[15px] font-bold text-white">Dimensiuni ramă</p>
      <div className="flex flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 220 110" className="h-full max-h-[6.5rem] w-full" aria-hidden="true">
          <g fill="none" stroke="#e9a07c" strokeWidth="3">
            <rect x="20" y="40" width="76" height="54" rx="16" />
            <rect x="124" y="40" width="76" height="54" rx="16" />
            <path d="M96 58c9-8 19-8 28 0" />
          </g>
          <g stroke="#fbe7da" strokeWidth="1" opacity="0.8">
            <path d="M20 24V34M96 24V34M20 29H96" />
            <path d="M96 12V22M124 12V22M96 17H124" />
          </g>
          <g fill="#fbe7da" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="10" textAnchor="middle">
            <text x="58" y="22">50</text>
            <text x="110" y="10">18</text>
          </g>
        </svg>
      </div>
      <p className="text-center font-mono text-[1.35rem] font-semibold tracking-[-0.02em] text-white">50 □ 18 — 145</p>
      <div className="mt-2 grid grid-cols-3 text-center text-[10.5px] text-[#fbe7da]/60">
        <span>Lentilă</span>
        <span>Punte</span>
        <span>Braț</span>
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-[#fbe7da]/70">Scrise pe interiorul brațului.</p>
    </Tile>
  );
}

// ── Reparații și reglaje ───────────────────────────────────────────────────────────────────

const REPAIR_STEPS = [
  { label: "Primită", state: "done" },
  { label: "În lucru", state: "active" },
  { label: "Gata", state: "todo" },
];

function RepairTicketTile() {
  return (
    <Tile bg="#6e4f1a" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Reparație</p>
        <TileLabel className="text-white/60">#2481</TileLabel>
      </div>
      <div className="mt-5 flex items-center">
        {REPAIR_STEPS.map((step, index) => (
          <React.Fragment key={step.label}>
            {index > 0 && <span className={`h-[2px] flex-1 ${step.state === "todo" ? "bg-white/20" : "bg-[#f3dfa6]"}`} />}
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                step.state === "done"
                  ? "bg-[#f3dfa6] text-[#6e4f1a]"
                  : step.state === "active"
                    ? "cat-pulse border-2 border-[#f3dfa6] bg-[#6e4f1a]"
                    : "border-2 border-white/25"
              }`}
            >
              {step.state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
              {step.state === "active" && <span className="h-2 w-2 rounded-full bg-[#f3dfa6]" />}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-white/65">
        {REPAIR_STEPS.map((step) => <span key={step.label}>{step.label}</span>)}
      </div>
      <div className="mt-5 rounded-md bg-white/10 p-3">
        <p className="text-[12px] font-semibold">Balama stângă</p>
        <p className="mt-0.5 text-[11px] text-white/65">Înlocuire șurub și strângere</p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-white/15 pt-3 text-[11px]">
        <span className="text-white/60">Estimare</span>
        <span className="font-semibold">Mâine, 12:00</span>
      </div>
    </Tile>
  );
}

function ScrewdriverHalftoneTile() {
  return (
    <HalftoneTile bg="#c89c45" dot="#faeecf" shadow="#77541a">
      {(paint) => (
        <g fill={paint} transform="rotate(-45 50 50)">
          <rect x="39" y="4" width="22" height="40" rx="8" />
          <rect x="46" y="44" width="8" height="38" />
          <path d="M46 82h8l-1.5 12h-5Z" />
        </g>
      )}
    </HalftoneTile>
  );
}

function HingeArtTile() {
  return (
    <Tile bg="#f2e7cb" color="#3a2b10" className="p-4">
      <div className="flex items-center justify-between">
        <TileLabel className="text-[#3a2b10]/55">Balama · piese</TileLabel>
        <TileLabel className="text-[#3a2b10]/55">4 : 1</TileLabel>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <img
          src="/images/home/viasee-artwork-reparatii-reglaje.svg"
          width="400"
          height="280"
          alt=""
          decoding="async"
          className="h-full max-h-[10rem] w-full scale-[1.18] object-contain"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Șuruburi", "Plăcuțe nazale", "Brațe"].map((part) => (
          <span key={part} className="rounded-full border border-[#3a2b10]/20 px-2.5 py-1 text-[11px]">
            {part}
          </span>
        ))}
      </div>
    </Tile>
  );
}

function TimeRingTile() {
  const circumference = 2 * Math.PI * 40;
  return (
    <Tile bg="#fffdf6" color="#3a2b10" className="border border-black/[0.06] p-4">
      <TileLabel className="text-center text-[#3a2b10]/55">Timp estimat</TileLabel>
      <div className="relative flex flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 100 100" className="h-full max-h-[8rem] w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#efe4c8" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#c8942f"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.72} ${circumference}`}
          />
        </svg>
        <span className="absolute font-heading text-[1.9rem] font-extrabold tracking-[-0.04em]">24h</span>
      </div>
      <p className="text-center text-[11px] text-[#3a2b10]/60">pentru reparații simple</p>
    </Tile>
  );
}

const KNOBS = [
  { label: "Punte", angle: -40 },
  { label: "Brațe", angle: 25 },
  { label: "Înclinare", angle: 70 },
];
const FADERS = [
  { label: "2 mm", pos: 30 },
  { label: "4°", pos: 62 },
  { label: "1 mm", pos: 45 },
  { label: "3°", pos: 20 },
];

function AdjustTile() {
  return (
    <Tile bg="#18150f" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Reglaj ramă</p>
        <TileLabel className="text-white/50">Pe măsura ta</TileLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {KNOBS.map((knob) => (
          <div key={knob.label} className="flex flex-col items-center gap-1.5">
            <svg viewBox="0 0 40 40" className="h-11 w-11" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="#2a251b" stroke="#3b3426" strokeWidth="1.5" />
              <g transform={`rotate(${knob.angle} 20 20)`}>
                <line x1="20" y1="20" x2="20" y2="6" stroke="#e0b25a" strokeWidth="3" strokeLinecap="round" />
              </g>
            </svg>
            <span className="text-[10.5px] text-white/60">{knob.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-4 gap-2 pt-4">
        {FADERS.map((fader) => (
          <div key={fader.label} className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-[9.5px] text-white/55">{fader.label}</span>
            <span className="relative h-14 w-[3px] rounded-full bg-white/15">
              <span className="absolute left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-[2px] bg-[#e0b25a]" style={{ bottom: `${fader.pos}%` }} />
            </span>
          </div>
        ))}
      </div>
    </Tile>
  );
}

// ── Date ───────────────────────────────────────────────────────────────────────────────────

// basis = lățimea de bază (rem): pe telefon e lățimea plăcuței, pe desktop proporția din rând.
// optional = plăcuța lipsește pe ecranele desktop înguste (1024–1279px), ca celelalte să aibă loc.
export const CATEGORY_SETS = [
  {
    id: "medici",
    label: "Medici și clinici",
    to: "/cauta",
    description: "Cabinete de oftalmologie, clinici și optici medicale, găsite după locul în care ești.",
    tiles: [
      { key: "doctor", Component: DoctorTile, basis: 14, h: 17.5 },
      { key: "pin", Component: PinHalftoneTile, basis: 10, h: 10.5 },
      { key: "map", Component: MapTile, basis: 27, h: 17.5 },
      { key: "schedule", Component: ScheduleTile, basis: 13, h: 15.5, optional: true },
      { key: "filters", Component: FiltersTile, basis: 15, h: 17.5 },
    ],
  },
  {
    id: "vedere",
    label: "Control de vedere",
    to: "/cerere?categorie=control_vedere",
    description: "Verificarea vederii și a corecției optice, pentru adulți și copii.",
    tiles: [
      { key: "refraction", Component: RefractionTile, basis: 14, h: 15.5 },
      { key: "snellen", Component: SnellenTile, basis: 21, h: 17.5 },
      { key: "e", Component: EHalftoneTile, basis: 10, h: 11 },
      { key: "plate", Component: ColorPlateTile, basis: 12, h: 14.5, optional: true },
      { key: "astigmatism", Component: AstigmatismTile, basis: 16, h: 17.5 },
    ],
  },
  {
    id: "investigatii",
    label: "Investigații",
    to: "/cerere?categorie=investigatii",
    description: "Investigații recomandate de medic: tomografie OCT, câmp vizual, fund de ochi.",
    tiles: [
      { key: "oct", Component: OctTile, basis: 23, h: 17.5 },
      { key: "fundus", Component: FundusTile, basis: 12, h: 13.5 },
      { key: "field", Component: VisualFieldTile, basis: 13, h: 16 },
      { key: "thickness", Component: ThicknessMapTile, basis: 13, h: 15, optional: true },
      { key: "pressure", Component: PressureTile, basis: 14, h: 17.5 },
    ],
  },
  {
    id: "ochelari",
    label: "Ochelari și lentile",
    to: "/cerere?categorie=ochelari_lentile",
    description: "Rame, lentile și măsurători, la optometriști și optici din apropiere.",
    tiles: [
      { key: "frames", Component: FrameShapeTile, basis: 21, h: 17.5 },
      { key: "glasses", Component: GlassesHalftoneTile, basis: 10, h: 10.5 },
      { key: "tint", Component: TintTile, basis: 12, h: 15.5, optional: true },
      { key: "lens", Component: LensZonesTile, basis: 16, h: 15.5 },
      { key: "measure", Component: MeasureTile, basis: 15, h: 17.5 },
    ],
  },
  {
    id: "reparatii",
    label: "Reparații",
    to: "/cerere?categorie=reparatii_ochelari",
    description: "Șuruburi, plăcuțe, brațe îndoite: reparații și reglaje pentru ochelari.",
    tiles: [
      { key: "ticket", Component: RepairTicketTile, basis: 19, h: 17.5 },
      { key: "screwdriver", Component: ScrewdriverHalftoneTile, basis: 10, h: 11.5 },
      { key: "hinge", Component: HingeArtTile, basis: 15, h: 15.5 },
      { key: "time", Component: TimeRingTile, basis: 11, h: 13, optional: true },
      { key: "adjust", Component: AdjustTile, basis: 16, h: 17.5 },
    ],
  },
];

// ── Banda ──────────────────────────────────────────────────────────────────────────────────

export default function CategoryStrip() {
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [stopped, setStopped] = useState(false);
  const rootRef = useRef(null);
  const tabsRef = useRef(null);
  const stripRef = useRef(null);
  const panelId = useSvgId("category-panel");

  const running = !reducedMotion && !stopped && inView && !hovered;
  const current = CATEGORY_SETS[active];

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % CATEGORY_SETS.length), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [running, active]);

  // Pe telefon filele și plăcuțele se derulează orizontal: fila activă rămâne la vedere, iar
  // rândul nou de plăcuțe pornește de la început.
  useEffect(() => {
    const tabs = tabsRef.current;
    const button = tabs?.querySelector('[aria-selected="true"]');
    if (tabs && button && tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({ left: button.offsetLeft - (tabs.clientWidth - button.offsetWidth) / 2, behavior: reducedMotion ? "auto" : "smooth" });
    }
    if (stripRef.current && !stopped) stripRef.current.scrollLeft = 0;
  }, [active, reducedMotion, stopped]);

  const select = (index) => {
    setStopped(true);
    setActive(index);
  };

  const onTabKeyDown = (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + CATEGORY_SETS.length) % CATEGORY_SETS.length;
    select(next);
    tabsRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Categorii"
        onKeyDown={onTabKeyDown}
        className="-mx-5 flex items-center gap-x-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:justify-center lg:mx-0 lg:gap-x-6 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORY_SETS.map((set, index) => {
          const selected = index === active;
          return (
            <React.Fragment key={set.id}>
              {index > 0 && <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 bg-[#171717]/75" />}
              <button
                type="button"
                role="tab"
                id={`${panelId}-tab-${set.id}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                className={`relative shrink-0 whitespace-nowrap rounded-sm py-1 font-heading text-[1.2rem] font-medium tracking-[-0.025em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] sm:text-[1.35rem] lg:text-[1.55rem] ${
                  selected ? "text-[#171717]" : "text-[#8a847b] hover:text-[#171717]"
                }`}
              >
                {selected && <span aria-hidden="true">[</span>}
                {set.label}
                {selected && <span aria-hidden="true">]</span>}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${current.id}`} className="mt-7 lg:mt-9">
        <div
          ref={stripRef}
          onTouchStart={() => setStopped(true)}
          className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          <Link
            key={current.id}
            to={current.to}
            tabIndex={-1}
            aria-hidden="true"
            {...prefetchOnIntent(current.to)}
            className="flex min-h-[18.5rem] w-max items-start gap-2.5 pl-2.5 pr-2.5 pt-2.5 lg:w-full lg:px-2.5"
          >
            {current.tiles.map(({ key, Component, basis, h, optional }, index) => (
              <div
                key={key}
                className={`relative w-[var(--tile-w)] shrink-0 lg:w-auto lg:flex-[var(--tile-grow)_1_0%] ${optional ? "lg:max-xl:hidden" : ""}`}
                style={{ "--tile-w": `${Math.min(basis, 21)}rem`, "--tile-grow": basis, height: `${h}rem` }}
              >
                <span aria-hidden="true" className="absolute -left-[9px] -top-[9px] z-10 h-2 w-2 bg-[#171717]" />
                {index === current.tiles.length - 1 && (
                  <span aria-hidden="true" className="absolute -right-[9px] -top-[9px] z-10 h-2 w-2 bg-[#171717]" />
                )}
                <div className="cat-tile-in h-full w-full overflow-hidden shadow-[0_14px_34px_rgba(30,24,18,0.08)]" style={{ "--i": index }}>
                  <Component />
                </div>
              </div>
            ))}
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mt-6 lg:px-2.5">
          <p className="max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">{current.description}</p>
          <Link
            to={current.to}
            {...prefetchOnIntent(current.to)}
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#171717]/15 bg-white/60 px-4 py-2 text-sm font-semibold text-[#171717] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] sm:self-auto"
          >
            Vezi opțiunile pentru {current.label.toLowerCase()}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
