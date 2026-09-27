import { publicPhoneLink } from "../../../shared/publicPhoneLink.js";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, Phone } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { formatDistance } from "@/lib/localityQuickPicks";
import { typeVisual } from "./LocationThumb";

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
const COVER_TONES = {
  optica_medicala: "from-[#dce4f2] via-[#eff1f5] to-[#f7f2e8]",
  laborator_optic: "from-[#dce4f2] via-[#eff1f5] to-[#f7f2e8]",
  clinica_oftalmologica: "from-[#e9e2d3] via-[#f3efe7] to-[#eef1f5]",
  cabinet_oftalmologic: "from-[#e9e2d3] via-[#f3efe7] to-[#eef1f5]",
  cabinet_optometric: "from-[#dfe8e1] via-[#eef2ee] to-[#f7f2e8]",
};

const STATUS_LABELS = {
  verified: "Profil verificat de VIASEE",
  claimed: "Profil revendicat",
  directory: "Profil din director",
};

function distanceLabel(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? "sub 1 km" : `aprox. ${formatDistance(km)}`;
}

// Public directory information only. No paid rank or recommendation claims.
export default function DirectoryResultCard({ location, onShowMap, distanceKm = null }) {
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
  const tone = COVER_TONES[location.provider_type] || COVER_TONES.clinica_oftalmologica;
  const distance = distanceLabel(distanceKm);
  const profileHref = `/furnizor/${location.id}`;

  return (
    <article className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <div className="relative">
        <div className={`relative aspect-[2/1] overflow-hidden rounded-md border border-border sm:aspect-[16/9] ${photo ? "bg-secondary" : `bg-gradient-to-br ${tone}`}`}>
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
              <Icon aria-hidden="true" strokeWidth={1.1} className="absolute -bottom-4 -right-3 h-32 w-32 text-[#4f6080]/[0.09]" />
              {city && <span aria-hidden="true" className="absolute bottom-4 left-4 right-16 truncate font-display text-[26px] font-semibold leading-tight tracking-tight text-[#2b3445]/80">{city}</span>}
            </>
          )}
          <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#4f6080] shadow-sm backdrop-blur-sm">
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{typeLabel}</span>
          </span>
        </div>
        {logo && (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
            className="absolute -bottom-6 left-4 h-12 w-12 rounded-full border-2 border-white bg-white object-contain shadow-[0_2px_8px_rgba(23,23,23,0.12)]"
          />
        )}
      </div>

      <div className={`flex items-start gap-2 ${logo ? "mt-9" : "mt-5"}`}>
        <h3 className="min-w-0 flex-1 break-words font-heading text-xl font-bold leading-snug tracking-tight sm:text-[22px]">
          <Link to={profileHref} className="rounded-sm transition-colors hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{location.name}</Link>
          {status === "verified" && <><span className="sr-only"> (profil verificat)</span><BadgeCheck aria-hidden="true" className="ml-1.5 inline-block h-5 w-5 align-[-3px] text-[#4f6080]" /></>}
        </h3>
        <div className="-mr-2 -mt-1.5 flex shrink-0 items-center">
          {onShowMap && (
            <button
              type="button"
              onClick={onShowMap}
              aria-label={`Arată pe hartă: ${location.name}`}
              title="Arată pe hartă"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4f6080] transition-colors hover:bg-[#dce4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 group-data-[selected]/cell:bg-[#4f6080] group-data-[selected]/cell:text-white"
            >
              <MapPin aria-hidden="true" className="h-[19px] w-[19px]" />
            </button>
          )}
          {phoneHref && (
            <a href={phoneHref} aria-label={`Sună la ${location.name}`} title="Sună" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4f6080] transition-colors hover:bg-[#dce4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <Phone aria-hidden="true" className="h-[18px] w-[18px]" />
            </a>
          )}
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 break-words text-[15px] leading-relaxed text-muted-foreground">{addressLabel || "Adresa nu este publicată"}</p>
      {location.service_coverage_status === "not_listed" && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Serviciile nu sunt încă listate sau confirmate.</p>}

      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <p className="min-w-0 text-sm leading-snug text-muted-foreground">
          {distance && <span className="font-semibold text-foreground">{distance}</span>}
          {distance && statusLabel && <span aria-hidden="true"> · </span>}
          {statusLabel}
        </p>
        <Link
          to={profileHref}
          aria-label={`Vezi profilul: ${location.name}`}
          title="Vezi profilul"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>
    </article>
  );
}
