import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
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

// Plăcuță pătrată cu o pictogramă mare „tipărită” din puncte (raster), pe fond plin.
function HalftoneTile({ bg, dot, children }) {
  const id = useSvgId("ht");
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{
        backgroundColor: bg,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.13) 0.7px, transparent 1.05px)",
        backgroundSize: "4px 4px",
      }}
    >
      <svg viewBox="0 0 100 100" className="h-[72%] w-[72%]" aria-hidden="true">
        <defs>
          <pattern id={id} width="3.1" height="3.1" patternUnits="userSpaceOnUse">
            <circle cx="1.55" cy="1.55" r="1.08" fill={dot} />
          </pattern>
        </defs>
        {children(`url(#${id})`)}
      </svg>
    </div>
  );
}

// ── Medici și clinici ──────────────────────────────────────────────────────────────────────

function DoctorTile() {
  return (
    <Tile bg="#5a4468" color="#ffffff" className="p-5">
      <span className="flex items-center gap-1.5 text-[11px] text-white/80">
        <span className="h-1.5 w-1.5 rounded-full bg-[#a8e2b0]" />
        Primește cereri
      </span>
      <div className="mt-6 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e8e0ea] font-heading text-[15px] font-bold text-[#4a3657]">
          MP
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[1.05rem] font-bold leading-tight">Medic oftalmolog</p>
          <p className="mt-0.5 text-[12px] text-white/65">Adulți și copii</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {["Consult", "Fund de ochi", "Lentile de contact"].map((tag) => (
          <span key={tag} className="rounded-full border border-white/25 px-2.5 py-1 text-[11px] text-white/85">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-[#3f2d4c]">
        <span className="text-[12px] font-semibold">Trimite o cerere</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    </Tile>
  );
}

function PinHalftoneTile() {
  return (
    <HalftoneTile bg="#b29dc5" dot="#f3ecf7">
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
  { name: "Cabinet oftalmologic", distance: "1,2 km", color: "#684d78" },
  { name: "Optică medicală", distance: "2,4 km", color: "#c77d67" },
  { name: "Clinică de specialitate", distance: "3,1 km", color: "#7f9a8c" },
];

function MapTile() {
  const dots = getMapDots();
  const cities = MAP_CITIES.map((city) => ({ ...city, xy: toMap(...city.at) }));
  const [ax, ay] = cities[0].xy;

  return (
    <Tile bg="#f3eef6" color="#2b2133" row>
      <div className="relative min-w-0 flex-1 p-4">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[10.5px] text-[#4a3657]">
          <span className="h-2 w-2 rounded-sm bg-[#684d78]" />
          România
        </span>
        <div className="absolute inset-x-3 bottom-4 top-12">
        <svg viewBox="-12 -12 690 500" className="h-full w-full" aria-hidden="true">
          {dots.map(([x, y]) => {
            const near = Math.hypot(x - ax, y - ay) < 70;
            return <rect key={`${x.toFixed(1)}-${y.toFixed(1)}`} x={x - 5.5} y={y - 5.5} width="11" height="11" rx="1.5" fill={near ? "#a58db8" : "#d8cde2"} />;
          })}
          {cities.map((city) => (
            <g key={city.name}>
              {city.active && <circle cx={city.xy[0]} cy={city.xy[1]} r="26" fill="#684d78" opacity="0.16" />}
              <circle cx={city.xy[0]} cy={city.xy[1]} r={city.active ? 11 : 7.5} fill="#684d78" stroke="#ffffff" strokeWidth="3" />
            </g>
          ))}
          <g transform={`translate(${ax + 18} ${ay - 44})`}>
            <rect width="132" height="34" rx="6" fill="#2b2133" />
            <text x="12" y="22" fill="#ffffff" fontSize="15" fontWeight="600" fontFamily="Manrope, sans-serif">Cluj-Napoca</text>
          </g>
        </svg>
        </div>
      </div>
      <div className="flex w-[40%] min-w-[9.5rem] max-w-[12.5rem] flex-col gap-2 p-2.5 pl-0">
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

const SCHEDULE = [
  ["Luni – Vineri", "08:00 – 20:00"],
  ["Sâmbătă", "09:00 – 14:00"],
  ["Duminică", "Închis"],
];
const BUSY_HOURS = [28, 42, 66, 88, 72, 50, 58, 80, 62, 36, 22];

function ScheduleTile() {
  return (
    <Tile bg="#fffdf8" color="#231c28" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Program</p>
        <span className="flex items-center gap-1.5 rounded-full bg-[#e3f1df] px-2 py-0.5 text-[10.5px] font-semibold text-[#2f6b35]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3f9a48]" />
          Deschis
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {SCHEDULE.map(([day, hours]) => (
          <div key={day} className="flex items-baseline gap-2 text-[12px]">
            <span className="shrink-0">{day}</span>
            <span className="flex-1 border-b border-dotted border-black/25" />
            <span className={`shrink-0 font-mono text-[10.5px] ${hours === "Închis" ? "text-black/40" : ""}`}>{hours}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <TileLabel className="text-black/45">Ore aglomerate</TileLabel>
        <div className="mt-2 flex h-11 items-end gap-[3px]">
          {BUSY_HOURS.map((value, index) => (
            <span
              key={index}
              className="flex-1 rounded-[2px]"
              style={{ height: `${value}%`, backgroundColor: index === 4 ? "#684d78" : "#dcd2e3" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-black/40">
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
      <div className="mt-5 space-y-3 text-[12px] text-white/80">
        <div className="flex items-center justify-between gap-3">
          <span>Primește cereri online</span>
          <Toggle on onColor="#d4c6d8" knob="#1d1922" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Program sâmbăta</span>
          <Toggle on={false} onColor="#d4c6d8" />
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
      <div className="mt-5 space-y-4">
        <Slider label="Sferă" value="−1,25 D" pct={38} track="rgba(29,52,65,0.15)" fill="#345bc8" text="#1d3441" />
        <Slider label="Cilindru" value="−0,50 D" pct={22} track="rgba(29,52,65,0.15)" fill="#345bc8" text="#1d3441" />
        <Slider label="Ax" value="90°" pct={50} track="rgba(29,52,65,0.15)" fill="#345bc8" text="#1d3441" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        {[["Adiție", "+1,50"], ["DP", "63 mm"]].map(([label, value]) => (
          <div key={label} className="rounded-md bg-white/70 px-2.5 py-2">
            <p className="truncate text-[10px] text-[#1d3441]/60">{label}</p>
            <p className="mt-0.5 font-mono text-[12px] font-semibold">{value}</p>
          </div>
        ))}
      </div>
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
    <HalftoneTile bg="#345bc8" dot="#9fb4f2">
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

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const CALENDAR_CELLS = [...Array(3).fill(null), ...Array.from({ length: 31 }, (_, index) => index + 1), null];
const AVAILABLE_DAYS = new Set([6, 8, 13, 14, 15, 20, 22, 27, 29]);

function CalendarTile() {
  return (
    <Tile bg="#15232c" color="#ffffff" className="p-5">
      <TileLabel className="text-white/50">Interval preferat</TileLabel>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-heading text-[15px] font-bold">Octombrie</p>
        <span className="flex gap-1 text-white/60">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {WEEK_DAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="font-mono text-[9.5px] text-white/40">{day}</span>
        ))}
        {CALENDAR_CELLS.map((day, index) => (
          <span
            key={index}
            className={`relative mx-auto grid h-[1.35rem] w-[1.35rem] place-items-center rounded-full text-[10.5px] ${
              day === 14 ? "bg-[#a9c6d7] font-bold text-[#15232c]" : day ? "text-white/80" : ""
            }`}
          >
            {day}
            {day && day !== 14 && AVAILABLE_DAYS.has(day) && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#a9c6d7]" />}
          </span>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-4 gap-1.5 pt-3">
        {["09:00", "10:30", "12:00", "15:30"].map((slot) => (
          <span
            key={slot}
            className={`rounded-md py-1.5 text-center font-mono text-[10px] ${slot === "10:30" ? "bg-[#a9c6d7] font-semibold text-[#15232c]" : "bg-white/10 text-white/75"}`}
          >
            {slot}
          </span>
        ))}
      </div>
    </Tile>
  );
}

// ── Investigații ───────────────────────────────────────────────────────────────────────────

function octLayer(y, dip) {
  return `M20 ${y} C90 ${y - 5} 140 ${y - 5} 170 ${y + dip * 0.55} C186 ${y + dip} 214 ${y + dip} 230 ${y + dip * 0.55} C260 ${y - 5} 310 ${y - 5} 380 ${y}`;
}
const OCT_LAYERS = Array.from({ length: 9 }, (_, k) => ({
  y: 52 + k * 11 + (k >= 7 ? 6 : 0),
  dip: Math.max(0, 26 - k * 4),
  width: k === 0 || k === 7 ? 3 : k % 2 ? 1.1 : 1.6,
  color: k === 0 || k === 7 ? "#eef6e2" : ["#8fb07e", "#5f8052", "#a9c49a"][k % 3],
}));

function OctTile() {
  const glow = useSvgId("scan");
  const band = useSvgId("band");
  return (
    <Tile bg="#1d3325" color="#ffffff" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-[15px] font-bold">Tomografie OCT</p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b9e39a]" />
          Scanare
        </span>
      </div>
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-md bg-[#132219]">
        <svg viewBox="0 0 400 190" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={glow} x1="0" x2="1">
              <stop offset="0" stopColor="#d9ffc0" stopOpacity="0" />
              <stop offset="0.5" stopColor="#d9ffc0" stopOpacity="0.28" />
              <stop offset="1" stopColor="#d9ffc0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={band} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a9c49a" stopOpacity="0.35" />
              <stop offset="1" stopColor="#a9c49a" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <path d={`${octLayer(OCT_LAYERS[0].y, OCT_LAYERS[0].dip)} L380 170 L20 170 Z`} fill={`url(#${band})`} />
          {OCT_LAYERS.map((layer) => (
            <path key={layer.y} d={octLayer(layer.y, layer.dip)} fill="none" stroke={layer.color} strokeWidth={layer.width} strokeLinecap="round" />
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
  return (
    <Tile bg="#e5e9d8" color="#26331f" className="p-4">
      <div className="flex items-center justify-between">
        <TileLabel className="text-[#26331f]/55">Fund de ochi</TileLabel>
        <TileLabel className="text-[#26331f]/55">OD</TileLabel>
      </div>
      <div className="flex flex-1 items-center justify-center pt-2">
        <svg viewBox="0 0 100 100" className="h-full max-h-[9rem] w-full" aria-hidden="true">
          <defs>
            <radialGradient id={fundus} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#f0a25c" />
              <stop offset="0.7" stopColor="#d9692f" />
              <stop offset="1" stopColor="#8f3417" />
            </radialGradient>
            <radialGradient id={macula} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#7a2a12" stopOpacity="0.75" />
              <stop offset="1" stopColor="#7a2a12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="47" fill={`url(#${fundus})`} />
          <circle cx="63" cy="51" r="11" fill={`url(#${macula})`} />
          <g fill="none" stroke="#8a2413" strokeLinecap="round" opacity="0.85">
            <path d="M34 45C44 35 57 27 76 20" strokeWidth="1.6" />
            <path d="M33 44C39 30 47 19 57 10" strokeWidth="1.3" />
            <path d="M34 55C44 66 57 73 77 80" strokeWidth="1.6" />
            <path d="M33 56C39 70 47 81 58 90" strokeWidth="1.3" />
            <path d="M58 29C64 33 71 35 82 35" strokeWidth="0.9" />
            <path d="M58 71C64 67 72 65 83 65" strokeWidth="0.9" />
            <path d="M30 47C22 42 15 38 8 38" strokeWidth="1" />
            <path d="M30 53C22 58 15 62 9 63" strokeWidth="1" />
          </g>
          <circle cx="32" cy="50" r="7.5" fill="#f7d690" />
          <circle cx="32.5" cy="50" r="3.5" fill="#fbe9bd" />
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

const PREP_ITEMS = [
  { label: "Trimiterea de la medic", done: true },
  { label: "Rezultatele anterioare", done: true },
  { label: "Ochelarii sau lentilele", done: false },
];

function ChecklistTile() {
  return (
    <Tile bg="#fffdf7" color="#26331f" className="border border-black/[0.06] p-5">
      <p className="font-heading text-[15px] font-bold leading-tight">Ce iei cu tine</p>
      <div className="mt-4 space-y-3">
        {PREP_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 text-[12px]">
            <span
              className={`grid h-[1.1rem] w-[1.1rem] shrink-0 place-items-center rounded-full ${item.done ? "bg-[#4f7a45] text-white" : "border border-black/25"}`}
            >
              {item.done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className={item.done ? "" : "text-black/55"}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <div className="flex justify-between text-[10.5px] text-black/50">
          <span>Pregătit</span>
          <span className="font-mono">2 / 3</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
          <span className="block h-full w-2/3 rounded-full bg-[#4f7a45]" />
        </div>
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
    <HalftoneTile bg="#e6946a" dot="#fde7da">
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
  const zones = [
    { label: "Departe", color: "#fff6ef" },
    { label: "Intermediar", color: "#f7d9c4" },
    { label: "Aproape", color: "#eeb99a" },
  ];
  return (
    <Tile bg="#f5e4d6" color="#3b1f12" className="p-5">
      <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[#3b1f12]/15 text-center text-[10.5px]">
        {["Monofocale", "Progresive", "Birou"].map((type) => (
          <span key={type} className={`py-1 ${type === "Progresive" ? "bg-[#3b1f12] font-semibold text-white" : ""}`}>{type}</span>
        ))}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 items-center gap-4">
        <svg viewBox="0 0 200 160" className="h-full max-h-[8.5rem] w-[58%] shrink-0" aria-hidden="true">
          <defs>
            <clipPath id={clip}>
              <path d="M18 44C18 12 182 12 182 44V108C182 150 18 150 18 108Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clip})`}>
            <rect width="200" height="160" fill="#dcae93" />
            <path d="M0 0H200V62C150 66 122 70 110 74H90C78 70 50 66 0 62Z" fill={zones[0].color} />
            <path d="M90 74H110L114 104H86Z" fill={zones[1].color} />
            <path d="M86 104H114C140 106 160 114 172 160H28C40 114 60 106 86 104Z" fill={zones[2].color} />
          </g>
          <path d="M18 44C18 12 182 12 182 44V108C182 150 18 150 18 108Z" fill="none" stroke="#b85d3f" strokeWidth="3" />
        </svg>
        <div className="min-w-0 space-y-2">
          {zones.map((zone) => (
            <div key={zone.label} className="flex items-center gap-2 text-[11px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[#3b1f12]/20" style={{ backgroundColor: zone.color }} />
              <span className="truncate">{zone.label}</span>
            </div>
          ))}
        </div>
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
    <HalftoneTile bg="#c89c45" dot="#f8e9c6">
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

const REPAIR_PARTS = ["Șurub de balama slăbit", "Plăcuțe nazale", "Braț îndoit", "Lentilă ieșită din ramă"];

function PartsTile() {
  return (
    <Tile bg="#f2e7cb" color="#3a2b10" className="p-5">
      <p className="font-heading text-[15px] font-bold leading-tight">Ce se repară des</p>
      <div className="mt-4 flex-1 divide-y divide-[#3a2b10]/10">
        {REPAIR_PARTS.map((part, index) => (
          <div key={part} className="flex items-center gap-2.5 py-2 text-[12px]">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#3a2b10]/[0.08] font-mono text-[9.5px]">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{part}</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-45" aria-hidden="true" />
          </div>
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
      { key: "doctor", Component: DoctorTile, basis: 14, h: 16 },
      { key: "pin", Component: PinHalftoneTile, basis: 10, h: 10.5 },
      { key: "map", Component: MapTile, basis: 27, h: 17.5 },
      { key: "schedule", Component: ScheduleTile, basis: 13, h: 15, optional: true },
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
      { key: "calendar", Component: CalendarTile, basis: 16, h: 17.5 },
    ],
  },
  {
    id: "investigatii",
    label: "Investigații",
    to: "/cerere?categorie=investigatii",
    description: "Investigații recomandate de medic: tomografie OCT, câmp vizual, fund de ochi.",
    tiles: [
      { key: "oct", Component: OctTile, basis: 23, h: 17.5 },
      { key: "fundus", Component: FundusTile, basis: 11, h: 12.5 },
      { key: "field", Component: VisualFieldTile, basis: 13, h: 16 },
      { key: "checklist", Component: ChecklistTile, basis: 13, h: 13.5, optional: true },
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
      { key: "lens", Component: LensZonesTile, basis: 16, h: 14 },
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
      { key: "parts", Component: PartsTile, basis: 15, h: 15 },
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
                {selected && (
                  <span aria-hidden="true" className="absolute inset-x-2 -bottom-0.5 h-[2px] overflow-hidden bg-[#171717]/10">
                    <span
                      key={`${active}-${running}`}
                      className={`block h-full bg-[#171717] ${running ? "cat-progress" : ""}`}
                      style={{ animationDuration: `${INTERVAL_MS}ms`, transform: running ? undefined : "scaleX(0)" }}
                    />
                  </span>
                )}
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
