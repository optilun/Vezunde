import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BadgeCheck, X } from "lucide-react";
import { typeVisual } from "./LocationThumb";
import { PROFILE_STATUS_LABELS, coverTone } from "@/lib/locationCover";
import { mapCardFocused, restoreMapCardOpener, wantsMapCardFocus } from "@/lib/mapCardFocus";

// 2026-09-27. Fereastra pinului, in stilul noilor carduri: coperta (fotografia locatiei, cand
// exista; altfel coperta generata din tip si localitate), numele, adresa, starea profilului si
// sageata neagra catre profil. Pozitia aproximativa se spune aici, nu prin contur punctat pe harta.
// - `floating`: pe ecrane late, cardul sta deasupra pinului si il urmeaza (VectorResultsCanvas);
// - implicit: pe telefon (si pe harta 2D), cardul sta jos, pe latimea hartii.
function Cover({ point, compact }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const { Icon, label } = typeVisual(point.provider_type);
  const photo = !photoFailed && point.photo_url ? point.photo_url : "";
  const city = String(point.city || "").trim();
  return (
    <div className={`relative overflow-hidden ${compact ? "h-[88px] w-[88px] shrink-0 rounded-xl" : "aspect-[16/9] w-full"} ${photo ? "bg-secondary" : `bg-gradient-to-br ${coverTone(point.provider_type)}`}`}>
      {photo ? (
        <img src={photo} alt={`Fotografie ${point.name}`} loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" />
      ) : compact ? (
        <Icon aria-hidden="true" strokeWidth={1.4} className="absolute inset-0 m-auto h-9 w-9 text-[#4f6080]/60" />
      ) : (
        <>
          <Icon aria-hidden="true" strokeWidth={1.1} className="absolute -bottom-3 -right-2 h-24 w-24 text-[#4f6080]/[0.09]" />
          {city && <span aria-hidden="true" className="absolute bottom-3 left-4 right-14 truncate font-display text-[22px] font-semibold leading-tight tracking-tight text-[#2b3445]/80">{city}</span>}
        </>
      )}
      {!compact && (
        <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#4f6080] shadow-sm backdrop-blur-sm">
          <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          <span className="truncate">{label}</span>
        </span>
      )}
    </div>
  );
}

export default function MapLocationCard({ point, onClose, variant = "sheet" }) {
  const route = useLocation();
  const returnState = route.pathname === "/rezultate" ? { resultsReturn: route.state } : undefined;
  const floating = variant === "floating";
  const visual = typeVisual(point.provider_type);
  const profileHref = `/furnizor/${point.id}`;
  const statusLabel = PROFILE_STATUS_LABELS[point.profile_control_status] || "";
  const approximate = point.map_precision !== "exact";
  // 2026-09-28 (audit /cauta, C2): fereastra ceruta acum primeste focusul; la inchidere, focusul
  // revine de unde a pornit. Fereastra plutitoare poate fi ascunsa cateva sute de ms (pana ajunge
  // pinul in cadru), deci se mai incearca o data.
  const cardRef = useRef(null);
  useEffect(() => {
    if (!wantsMapCardFocus()) return undefined;
    const focusCard = () => {
      const card = cardRef.current;
      if (!card) return;
      card.focus({ preventScroll: true });
      if (document.activeElement === card) mapCardFocused();
    };
    focusCard();
    const timer = window.setTimeout(() => { if (wantsMapCardFocus()) focusCard(); }, 450);
    return () => window.clearTimeout(timer);
  }, [point.id]);
  const close = () => { onClose(); restoreMapCardOpener(); };
  const onKeyDown = (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } };

  const title = (
    <p className={`font-heading font-bold leading-snug tracking-tight text-foreground ${floating ? "text-base" : "text-[15px]"}`}>
      <Link to={profileHref} state={returnState} className="rounded-sm hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{point.name}</Link>
      {point.profile_control_status === "verified" && <><span className="sr-only"> (profil verificat)</span><BadgeCheck aria-hidden="true" className="ml-1 inline-block h-4 w-4 align-[-2px] text-[#4f6080]" /></>}
    </p>
  );
  const details = (
    <>
      {point.address && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{point.address}</p>}
      {point.is_request_result === false && <p className="mt-1.5 text-xs text-muted-foreground">Din directorul național</p>}
      {point.is_request_result === true && <p className="mt-1.5 text-xs font-semibold text-[#4f6080]">Rezultat al cererii tale</p>}
    </>
  );
  const footer = (
    <div className="mt-3 flex items-end justify-between gap-3">
      <p className="min-w-0 text-xs leading-snug text-muted-foreground">
        {statusLabel}
        {statusLabel && approximate && <span aria-hidden="true"> · </span>}
        {approximate && <span>Poziție aproximativă</span>}
      </p>
      <Link
        to={profileHref}
        state={returnState}
        aria-label={`Vezi profilul: ${point.name}`}
        title="Vezi profilul"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowRight aria-hidden="true" className="h-5 w-5" />
      </Link>
    </div>
  );
  const closeButton = (
    <button
      type="button"
      onClick={close}
      aria-label="Închide"
      // C3: cercul ramane de 36 px, dar zona de apasare are 44 px (pseudo-elementul).
      className={floating
        ? "absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-[0_1px_4px_rgba(23,23,23,0.18)] transition-transform before:absolute before:-inset-1 before:rounded-full before:content-[''] hover:scale-105 focus-visible:outline focus-visible:outline-2"
        : "-mr-1.5 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2"}
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  );

  if (floating) {
    return (
      <section ref={cardRef} tabIndex={-1} aria-label={"Detalii locație: " + point.name} onKeyDown={onKeyDown} className="relative overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_14px_36px_rgba(23,35,55,0.24)] outline-none">
        <Cover point={point} />
        {closeButton}
        <div className="p-4">
          {title}
          {details}
          {footer}
        </div>
      </section>
    );
  }

  return (
    <section ref={cardRef} tabIndex={-1} aria-label={"Detalii locație: " + point.name} onKeyDown={onKeyDown} className="absolute inset-x-3 bottom-3 z-[500] max-h-[55%] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-lg outline-none sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-start gap-3">
        <Cover point={point} compact />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#4f6080]">{visual.label}</div>
              <div className="mt-0.5">{title}</div>
            </div>
            {closeButton}
          </div>
          {details}
        </div>
      </div>
      {footer}
    </section>
  );
}
