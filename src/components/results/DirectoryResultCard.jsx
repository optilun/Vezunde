import { publicPhoneLink } from "../../../shared/publicPhoneLink.js";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, Phone } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { formatDistance } from "@/lib/localityQuickPicks";
import { typeVisual } from "./LocationThumb";
import { PROFILE_STATUS_LABELS as STATUS_LABELS, coverTone } from "@/lib/locationCover";

const PRECISE_LOCATION_TYPES = {
  hospital_department: "Secție de spital",
  hospital_outpatient_unit: "Ambulatoriu de spital",
  multi_specialty_clinic: "Clinică multidisciplinară",
};

// 2026-09-27. Card de director in stilul unei grile de proiecte: coperta sus, numele mare, adresa,
// apoi starea profilului si o sageata catre profil. Coperta este fotografia locatiei, cand
// furnizorul si-a pus una; altfel o coperta generata din tipul locatiei si localitate (tonuri din
// paleta: albastru-ardezie pentru optici, nisip pentru clinici si cabinete, salvie pentru
// optometrie). Poza de profil (logo-ul organizatiei) apare peste coperta, cand exista.
// Fotografiile si logo-ul vin doar pentru profilurile revendicate sau verificate (backend).
// Tonurile copertei si etichetele de stare sunt comune cu fereastra pinului (src/lib/locationCover.js).

// 2026-09-30. Varianta compacta: cand lista sta LANGA harta (grila poarta `is-beside-map`, vezi
// resultGridClasses.js) si ecranul e lat (`lg`+), cardul devine un rand orizontal: coperta patrata
// in stanga, textul in dreapta. Inainte, cu lista pe jumatate de ecran, un card cu coperta 16:9 lua
// aproape toata inaltimea si se vedea un singur rezultat; acum intra 5-6. Pe telefon si tableta
// (lista pe toata latimea, fara harta alaturi) cardul ramane cel vertical. Doar CSS: acelasi continut,
// aceleasi legaturi, aceeasi ordine in DOM. Clasele sunt scrise intregi, ca Tailwind sa le gaseasca.
const BESIDE = {
  article: "lg:group-[.is-beside-map]/grid:flex-row lg:group-[.is-beside-map]/grid:gap-4 lg:group-[.is-beside-map]/grid:p-4",
  coverWrap: "lg:group-[.is-beside-map]/grid:w-28 lg:group-[.is-beside-map]/grid:shrink-0 lg:group-[.is-beside-map]/grid:self-start",
  coverBox: "lg:group-[.is-beside-map]/grid:aspect-square",
  city: "lg:group-[.is-beside-map]/grid:bottom-2.5 lg:group-[.is-beside-map]/grid:left-2.5 lg:group-[.is-beside-map]/grid:right-2 lg:group-[.is-beside-map]/grid:text-sm",
  icon: "lg:group-[.is-beside-map]/grid:h-20 lg:group-[.is-beside-map]/grid:w-20",
  badges: "lg:group-[.is-beside-map]/grid:left-2 lg:group-[.is-beside-map]/grid:top-2",
  typePill: "lg:group-[.is-beside-map]/grid:hidden",
  logo: "lg:group-[.is-beside-map]/grid:-bottom-1.5 lg:group-[.is-beside-map]/grid:-right-1.5 lg:group-[.is-beside-map]/grid:left-auto lg:group-[.is-beside-map]/grid:h-9 lg:group-[.is-beside-map]/grid:w-9",
  typeLine: "hidden lg:group-[.is-beside-map]/grid:block",
  titleRow: "lg:group-[.is-beside-map]/grid:mt-0",
  title: "lg:group-[.is-beside-map]/grid:text-lg",
  action: "lg:group-[.is-beside-map]/grid:h-10 lg:group-[.is-beside-map]/grid:w-10",
  address: "lg:group-[.is-beside-map]/grid:mt-1 lg:group-[.is-beside-map]/grid:text-sm",
  footer: "lg:group-[.is-beside-map]/grid:items-center lg:group-[.is-beside-map]/grid:pt-3",
};

function distanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? "sub 1 km" : `aprox. ${formatDistance(km)}`;
}

// Public directory information only. No paid rank or recommendation claims.
// 2026-09-28 (audit /cauta, E1): acelasi card si pentru cautarea dupa serviciu. `rank` este doar
// numarul pinului de pe harta (ordinea primita de la server, redata ca atare), iar `details` sunt
// detaliile potrivirii (ServiceMatchDetails). Ambele lipsesc la rasfoirea localitatii.
// 2026-09-30: acelasi card il folosesc si recomandarile clientului (MatchResultCard). Pentru ele:
// `rankKind="recommendation"` (numarul este pozitia in cele mai potrivite optiuni, primita de la
// server, nu numarul unui pin), `linkState` (starea de intoarcere spre lista de recomandari) si
// `onProfileClick` / `onPhoneClick` (analitica). Fara ele, cardul se comporta exact ca inainte.
export default function DirectoryResultCard({ location, onShowMap, distanceKm = null, rank = null, details = null, rankKind = "pin", linkState = undefined, onProfileClick = undefined, onPhoneClick = undefined }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const phoneHref = publicPhoneLink(location.phone);
  const { Icon } = typeVisual(location.provider_type);
  const typeLabel = PRECISE_LOCATION_TYPES[location.location_type_code]
    || PROVIDER_TYPES[location.provider_type] || "Locație";
  const city = String(location.city || "").trim();
  const address = String(location.address || "").trim();
  const addressLabel = address.toLocaleLowerCase("ro").includes(city.toLocaleLowerCase("ro"))
    ? address : [city, address].filter(Boolean).join(", ");
  const status = location.profile_control_status;
  const statusLabel = STATUS_LABELS[status] || "";
  const photo = !photoFailed && location.photo_url ? location.photo_url : "";
  const logo = !logoFailed && location.logo_url ? location.logo_url : "";
  const tone = coverTone(location.provider_type);
  const distance = distanceLabel(distanceKm);
  const profileHref = `/furnizor/${location.id}`;

  return (
    <article className={`flex h-full min-w-0 flex-col p-5 sm:p-6 ${BESIDE.article}`}>
      <div className={`relative ${BESIDE.coverWrap}`}>
        <div className={`relative aspect-[2/1] overflow-hidden rounded-md border border-border sm:aspect-[16/9] ${BESIDE.coverBox} ${photo ? "bg-secondary" : `bg-gradient-to-br ${tone}`}`}>
          {photo ? (
            <img
              src={photo}
              alt={`Fotografie ${location.name}`}
              loading="lazy"
              decoding="async"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <Icon aria-hidden="true" strokeWidth={1.1} className={`absolute -bottom-4 -right-3 h-32 w-32 text-[#4f6080]/[0.09] ${BESIDE.icon}`} />
              {city && <span aria-hidden="true" className={`absolute bottom-4 left-4 right-16 truncate font-display text-[26px] font-semibold leading-tight tracking-tight text-[#2b3445]/80 ${BESIDE.city}`}>{city}</span>}
            </>
          )}
          <div className={`absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 ${BESIDE.badges}`}>
            {rank && (
              <span className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-[#171717] px-1.5 text-xs font-extrabold tabular-nums text-white shadow-sm group-data-[selected]/cell:bg-[#4f6080]">
                {rankKind === "recommendation"
                  ? <><span className="sr-only">Poziția </span>{rank}<span className="sr-only"> în cele mai potrivite opțiuni. </span></>
                  : <><span className="sr-only">Pinul </span>{rank}<span className="sr-only"> pe hartă. </span></>}
              </span>
            )}
            <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#4f6080] shadow-sm backdrop-blur-sm ${BESIDE.typePill}`}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
              <span className="truncate">{typeLabel}</span>
            </span>
          </div>
        </div>
        {logo && (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
            className={`absolute -bottom-6 left-4 h-12 w-12 rounded-full border-2 border-white bg-white object-contain shadow-[0_2px_8px_rgba(23,23,23,0.12)] ${BESIDE.logo}`}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
      <p className={`text-xs font-semibold text-[#4f6080] ${BESIDE.typeLine}`}>{typeLabel}</p>
      <div className={`flex items-start gap-2 ${logo ? "mt-9" : "mt-5"} ${BESIDE.titleRow}`}>
        <h3 className={`min-w-0 flex-1 break-words font-heading text-xl font-bold leading-snug tracking-tight sm:text-[22px] ${BESIDE.title}`}>
          <Link to={profileHref} state={linkState} onClick={onProfileClick} className="rounded-sm transition-colors hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{location.name}</Link>
          {status === "verified" && <><span className="sr-only"> (profil verificat)</span><BadgeCheck aria-hidden="true" className="ml-1.5 inline-block h-5 w-5 align-[-3px] text-[#4f6080]" /></>}
        </h3>
        <div className="-mr-2 -mt-1.5 flex shrink-0 items-center">
          {onShowMap && (
            <button
              type="button"
              onClick={onShowMap}
              aria-label={`Arată pe hartă: ${location.name}`}
              title="Arată pe hartă"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4f6080] transition-colors hover:bg-[#dce4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 group-data-[selected]/cell:bg-[#4f6080] group-data-[selected]/cell:text-white ${BESIDE.action}`}
            >
              <MapPin aria-hidden="true" className="h-[19px] w-[19px]" />
            </button>
          )}
          {phoneHref && (
            <a href={phoneHref} onClick={onPhoneClick} aria-label={`Sună la ${location.name}`} title="Sună" className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4f6080] transition-colors hover:bg-[#dce4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${BESIDE.action}`}>
              <Phone aria-hidden="true" className="h-[18px] w-[18px]" />
            </a>
          )}
        </div>
      </div>
      <p className={`mt-1.5 line-clamp-2 break-words text-[15px] leading-relaxed text-muted-foreground ${BESIDE.address}`}>{addressLabel || "Adresa nu este publicată"}</p>
      {location.service_coverage_status === "not_listed" && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Serviciile nu sunt încă listate sau confirmate.</p>}
      {details}

      <div className={`mt-auto flex items-end justify-between gap-4 pt-5 ${BESIDE.footer}`}>
        <p className="min-w-0 text-sm leading-snug text-muted-foreground">
          {distance && <span className="font-semibold text-foreground">{distance}</span>}
          {distance && statusLabel && <span aria-hidden="true"> · </span>}
          {statusLabel}
        </p>
        <Link
          to={profileHref}
          state={linkState}
          onClick={onProfileClick}
          aria-label={`Vezi profilul: ${location.name}`}
          title="Vezi profilul"
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${BESIDE.action}`}
        >
          <ArrowRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>
      </div>
    </article>
  );
}
