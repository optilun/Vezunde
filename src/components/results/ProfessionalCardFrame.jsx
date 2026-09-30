import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Eye, Glasses, Stethoscope, User } from "lucide-react";
import ServiceChip from "@/components/results/ServiceChip";
import { COVER_TONES } from "@/lib/locationCover";
import { resultCellClassName } from "./resultGridClasses";
import {
  professionalInitials,
  professionalTypeIconKey,
  professionalTypeLabel,
} from "../../../shared/professionalIdentity.js";

// Cadrul cardului de specialist: acelasi limbaj vizual ca DirectoryResultCard (celula de grila cu
// linii fine, coperta sus, numele mare, o sageata spre profil), ca in tabul „Specialisti” sa se
// vada acelasi produs ca in tabul cu locatii.
//
// 2026-09-30. Inainte, cardul de specialist din /cauta avea un chenar rotunjit cu doua butoane, iar
// cel din recomandari un alt card, cu variante de bucket (Top 3 evidentiat, director punctat).
// Acum amandoua sunt acest cadru. Ce difera vine prin `details` si `specializations`:
//   - ProfessionalDirectoryCard (rasfoire) nu trimite nimic in `details`: rasfoirea nu e o
//     recomandare, deci fara scor, fara incredere si fara Top 3 (regula din 2026-09-03);
//   - ProfessionalResultCard (recomandari) trimite panoul „De ce se potriveste”.
// Cadrul nu stie nimic despre bucketuri sau scoruri si nu ordoneaza nimic.
//
// Coperta: fotografia specialistului cand exista; altfel o coperta generata din profesie (aceleasi
// tonuri ca la locatii: nisip pentru medici, salvie pentru optometristi, albastru-ardezie pentru
// opticieni), cu pictograma profesiei si initialele. Nu inventam o poza sau o silueta.

const PROFESSION_TONES = {
  ophthalmologist: COVER_TONES.clinica_oftalmologica,
  optometrist: COVER_TONES.cabinet_optometric,
  optician: COVER_TONES.optica_medicala,
};

const ICONS = { stethoscope: Stethoscope, eye: Eye, glasses: Glasses, user: User };

export default function ProfessionalCardFrame({
  professional,
  specializations = [],
  details = null,
  linkState = undefined,
  onProfileClick = undefined,
  onLocationClick = undefined,
  variant = undefined,
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const type = professional.professional_type;
  const Icon = ICONS[professionalTypeIconKey(type)] || User;
  const tone = PROFESSION_TONES[type] || COVER_TONES.clinica_oftalmologica;
  const typeLabel = professional.professional_type_label || professionalTypeLabel(type);
  const photo = !photoFailed && professional.profile_photo_url ? professional.profile_photo_url : "";
  const name = professional.display_name;
  // Raspunsul motorului de specialisti are `display_name`; professionalInitials citeste
  // `public_display_name` (formatul profilului), deci numele se da explicit - altfel coperta ar
  // arata „?” in loc de initiale.
  const initials = professionalInitials({ public_display_name: name });
  const profileHref = `/specialist/${professional.id}`;
  const locations = Array.isArray(professional.locations) ? professional.locations : [];
  const shownLocations = locations.slice(0, 2);
  const moreLocations = Math.max(0, locations.length - shownLocations.length);
  const labels = Array.isArray(specializations) ? specializations : [];
  const shownLabels = labels.slice(0, 3);
  const moreLabels = Math.max(0, labels.length - shownLabels.length);

  return (
    <div
      data-professional-id={professional.id}
      data-result-variant={variant}
      className={resultCellClassName({ hasPositions: false })}
    >
      <article className="flex h-full min-w-0 flex-col p-5 sm:p-6">
        <div className={`relative aspect-[2/1] overflow-hidden rounded-md border border-border sm:aspect-[16/9] ${photo ? "bg-secondary" : `bg-gradient-to-br ${tone}`}`}>
          {photo ? (
            <img
              src={photo}
              alt={`Fotografie ${name}`}
              loading="lazy"
              decoding="async"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <>
              <Icon aria-hidden="true" strokeWidth={1.1} className="absolute -bottom-4 -right-3 h-32 w-32 text-[#4f6080]/[0.09]" />
              <span aria-hidden="true" className="absolute bottom-4 left-4 right-16 truncate font-display text-[26px] font-semibold leading-tight tracking-tight text-[#2b3445]/80">
                {initials}
              </span>
            </>
          )}
          <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#4f6080] shadow-sm backdrop-blur-sm">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
              <span className="truncate">{typeLabel}</span>
            </span>
          </div>
        </div>

        <h3 className="mt-5 min-w-0 break-words font-heading text-xl font-bold leading-snug tracking-tight sm:text-[22px]">
          <Link to={profileHref} state={linkState} onClick={onProfileClick} className="rounded-sm transition-colors hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{name}</Link>
        </h3>

        {shownLabels.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shownLabels.map((label) => <ServiceChip key={label} label={label} />)}
            {moreLabels > 0 && <span className="px-1 py-1 text-xs text-muted-foreground">+{moreLabels} specializări</span>}
          </div>
        )}

        {details}

        {/* Drumul specialist -> locatie: fara el cardul ar fi un capat de drum. */}
        {shownLocations.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Unde poate fi găsit</p>
            <ul className="mt-1 space-y-0.5">
              {shownLocations.map((location) => (
                <li key={location.id} className="text-sm leading-snug">
                  <Link
                    to={`/furnizor/${location.id}`}
                    state={linkState}
                    onClick={() => { if (onLocationClick) onLocationClick(location); }}
                    className="inline-block rounded-sm py-1 font-medium text-foreground underline underline-offset-4 hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {location.name}
                  </Link>
                  {location.city && <span className="text-muted-foreground"> · {location.city}</span>}
                </li>
              ))}
            </ul>
            {moreLocations > 0 && (
              <p className="text-xs text-muted-foreground">
                și încă {moreLocations} {moreLocations === 1 ? "locație" : "locații"} pe profilul complet
              </p>
            )}
          </div>
        )}

        {/* Un specialist ajunge in lista doar cu profilul verificat; textul ramane explicit, ca
            pacientul sa stie ce a fost verificat. */}
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <p className="inline-flex min-w-0 items-center gap-1.5 text-sm leading-snug text-muted-foreground">
            <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4f6080]" />
            Specialist verificat
          </p>
          <Link
            to={profileHref}
            state={linkState}
            onClick={onProfileClick}
            aria-label={`Vezi profilul specialistului: ${name}`}
            title="Vezi profilul"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
      </article>
    </div>
  );
}
