import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { prefetchOnIntent } from "@/lib/routePrefetch";
import {
  SPECIALIST_CARDS, DoctorTile, PinTile, NearbyTile, ConnectionPhoto, FiltersTile,
  ConsultationPhoto, SnellenTile, EyeTile, StillLifePhoto, VisionNote,
  IrisPhoto, ApertureTile, LightPhoto, InvestigationsNote,
  PortraitPhoto, GlassesTile, LensesNote, WorkshopPhoto, WrenchTile, RepairPhoto, RepairNote,
} from "@/components/home/CategoryArtworks";

// Collages keep the category navigation, automatic rotation and compact three-tile mobile layout.
const INTERVAL_MS = 3200;
const SPECIALIST_INTERVAL_MS = 3200;

function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

// basis = lățimea desenului (rem) și proporția din rândul desktop.
// mobileTiles = cele trei desene alese pentru compoziția compactă de pe telefon.
// optional = plăcuța lipsește pe ecranele desktop înguste (1024–1279px), ca celelalte să aibă loc.
export const CATEGORY_SETS = [
  {
    id: "medici",
    label: "Medici și clinici",
    mobileLabel: "Specialiști",
    mobileTiles: ["doctor", "pin", "map"],
    mobileDescription: "Cabinete, clinici și optici din apropiere.",
    to: "/cauta",
    description: "Cabinete de oftalmologie, clinici și optici medicale, găsite după locul în care ești.",
    tiles: [
      { key: "doctor", Component: DoctorTile, basis: 16, h: 17.5 },
      { key: "pin", Component: PinTile, basis: 9, h: 10.5 },
      { key: "map", Component: NearbyTile, basis: 20, h: 17.5 },
      { key: "schedule", Component: ConnectionPhoto, basis: 16, h: 17.5, optional: true },
      { key: "filters", Component: FiltersTile, basis: 15, h: 17.5 },
    ],
  },
  {
    id: "vedere",
    label: "Control de vedere",
    mobileLabel: "Control",
    mobileTiles: ["refraction", "e", "snellen"],
    mobileDescription: "Verifică vederea și corecția optică.",
    to: "/cerere?categorie=control_vedere",
    description: "Verificarea vederii și a corecției optice, pentru adulți și copii.",
    tiles: [
      { key: "refraction", Component: ConsultationPhoto, basis: 24, h: 17.5 },
      { key: "snellen", Component: SnellenTile, basis: 14, h: 17.5 },
      { key: "e", Component: EyeTile, basis: 9, h: 11 },
      { key: "plate", Component: StillLifePhoto, basis: 18, h: 14.5, optional: true },
      { key: "astigmatism", Component: VisionNote, basis: 16, h: 17.5 },
    ],
  },
  {
    id: "investigatii",
    label: "Investigații",
    mobileLabel: "Investigații",
    mobileTiles: ["oct", "fundus", "field"],
    mobileDescription: "OCT, câmp vizual și alte investigații recomandate.",
    to: "/cerere?categorie=investigatii",
    description: "Investigații recomandate de medic: tomografie OCT, câmp vizual, fund de ochi.",
    tiles: [
      { key: "oct", Component: ConsultationPhoto, basis: 24, h: 17.5 },
      { key: "fundus", Component: IrisPhoto, basis: 14, h: 13.5 },
      { key: "field", Component: ApertureTile, basis: 9, h: 10.5 },
      { key: "thickness", Component: LightPhoto, basis: 10, h: 15, optional: true },
      { key: "pressure", Component: InvestigationsNote, basis: 18, h: 17.5 },
    ],
  },
  {
    id: "ochelari",
    label: "Ochelari și lentile",
    mobileLabel: "Ochelari",
    mobileTiles: ["frames", "glasses", "lens"],
    mobileDescription: "Rame, lentile și măsurători pentru ochelari.",
    to: "/cerere?categorie=ochelari_lentile",
    description: "Rame, lentile și măsurători, la optometriști și optici din apropiere.",
    tiles: [
      { key: "frames", Component: PortraitPhoto, basis: 17, h: 17.5 },
      { key: "glasses", Component: GlassesTile, basis: 9, h: 10.5 },
      { key: "tint", Component: LightPhoto, basis: 10, h: 15.5, optional: true },
      { key: "lens", Component: StillLifePhoto, basis: 23, h: 15.5 },
      { key: "measure", Component: LensesNote, basis: 16, h: 17.5 },
    ],
  },
  {
    id: "reparatii",
    label: "Reparații",
    mobileLabel: "Reparații",
    mobileTiles: ["ticket", "screwdriver", "hinge"],
    mobileDescription: "Reparații și reglaje pentru ochelari.",
    to: "/cerere?categorie=reparatii_ochelari",
    description: "Șuruburi, plăcuțe, brațe îndoite: reparații și reglaje pentru ochelari.",
    tiles: [
      { key: "ticket", Component: WorkshopPhoto, basis: 24, h: 17.5 },
      { key: "screwdriver", Component: WrenchTile, basis: 9, h: 11.5 },
      { key: "hinge", Component: RepairPhoto, basis: 19, h: 15.5 },
      { key: "time", Component: StillLifePhoto, basis: 12, h: 13, optional: true },
      { key: "adjust", Component: RepairNote, basis: 17, h: 17.5 },
    ],
  },
];

// Pe telefon se păstrează trei piese și proporțiile colajului.
// Măsurăm spațiul disponibil, nu fereastra, inclusiv când preview-ul este într-un iframe.
function MobileCategoryArtwork({ current, specialistIndex }) {
  const containerRef = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const tiles = current.mobileTiles.map((key) => current.tiles.find((tile) => tile.key === key));
  const width = tiles.reduce((sum, tile) => sum + tile.basis * 16, 0) + 40;
  const height = Math.max(...tiles.map((tile) => tile.h * 16)) + 18;
  const scale = availableWidth > 0 ? availableWidth / width : 0;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full sm:hidden" style={{ height: height * scale }} data-mobile-category-artwork={current.id}>
      <Link
        key={current.id}
        to={current.to}
        tabIndex={-1}
        aria-hidden="true"
        {...prefetchOnIntent(current.to)}
        className="absolute left-0 top-0 flex origin-top-left items-start gap-2.5 px-2.5 pt-2.5"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {tiles.map(({ key, Component, basis, h }, index) => (
          <div key={key} data-artwork-tile={key} className="relative shrink-0" style={{ width: basis * 16, height: h * 16 }}>
            <span aria-hidden="true" className="absolute -left-[9px] -top-[9px] z-10 h-2 w-2 bg-[#171717]" />
            {index === tiles.length - 1 && <span aria-hidden="true" className="absolute -right-[9px] -top-[9px] z-10 h-2 w-2 bg-[#171717]" />}
            <div className="cat-tile-in h-full w-full overflow-hidden" style={{ "--i": index }}>
              <Component specialistIndex={specialistIndex} />
            </div>
          </div>
        ))}
      </Link>
    </div>
  );
}

// ── Banda ──────────────────────────────────────────────────────────────────────────────────

export default function CategoryStrip() {
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [specialistIndex, setSpecialistIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [selectionTick, setSelectionTick] = useState(0);
  const rootRef = useRef(null);
  const tabsRef = useRef(null);
  const stripRef = useRef(null);
  const panelId = useSvgId("category-panel");

  const running = !reducedMotion && inView;
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
    const delay = active === 0 ? SPECIALIST_INTERVAL_MS * SPECIALIST_CARDS.length : INTERVAL_MS;
    const timer = window.setTimeout(() => {
      if (active === CATEGORY_SETS.length - 1) setSpecialistIndex(0);
      setActive((index) => (index + 1) % CATEGORY_SETS.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [running, active, selectionTick]);

  useEffect(() => {
    if (active !== 0 || reducedMotion || !inView) return undefined;
    if (specialistIndex === SPECIALIST_CARDS.length - 1) return undefined;
    const timer = window.setTimeout(
      () => setSpecialistIndex((index) => (index + 1) % SPECIALIST_CARDS.length),
      SPECIALIST_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion, inView, specialistIndex, selectionTick]);

  // Pe telefon fila activă rămâne la vedere. Pe tabletă banda de desene revine la început.
  useEffect(() => {
    const tabs = tabsRef.current;
    const button = tabs?.querySelector('[aria-selected="true"]');
    if (tabs && button && tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({ left: button.offsetLeft - (tabs.clientWidth - button.offsetWidth) / 2, behavior: reducedMotion ? "auto" : "smooth" });
    }
    if (stripRef.current) stripRef.current.scrollLeft = 0;
  }, [active, reducedMotion]);

  const select = (index) => {
    if (index === 0) setSpecialistIndex(0);
    setSelectionTick((tick) => tick + 1);
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
    <div ref={rootRef}>
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
                aria-label={set.label}
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
                <span className="sm:hidden">{set.mobileLabel}</span>
                <span className="hidden sm:inline">{set.label}</span>
                {selected && <span aria-hidden="true">]</span>}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${current.id}`} className="mt-7 lg:mt-9">
        <MobileCategoryArtwork current={current} specialistIndex={specialistIndex} />
        <div
          ref={stripRef}
          className="-mx-5 hidden overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:block lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
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
                  <Component specialistIndex={specialistIndex} />
                </div>
              </div>
            ))}
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mt-6 lg:px-2.5">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]"><span className="sm:hidden">{current.mobileDescription}</span><span className="hidden sm:inline">{current.description}</span></p>
          <Link
            to={current.to}
            {...prefetchOnIntent(current.to)}
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#171717]/15 bg-white/60 px-4 py-2 text-sm font-semibold text-[#171717] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F4EC] sm:self-auto"
          >
            <span className="sm:hidden">Vezi opțiunile</span>
            <span className="hidden sm:inline">Vezi opțiunile pentru {current.label.toLowerCase()}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}