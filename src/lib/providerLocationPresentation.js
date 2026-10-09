import { isLocationPubliclyVisible } from "./providerLocationVisibility.js";
import { validateProviderOpeningHours } from "../../shared/providerOpeningHours.js";

const count = value => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
const counted = (value, singular, plural) => `${value}${value >= 20 ? " de" : ""} ${value === 1 ? singular : plural}`;

// Presentation uses only this location's summary, never organization totals.
export function locationModulePresentation(location = {}, overview = null) {
  const content = location.content_summary || {};
  const services = count(content.approved_service_count);
  const specialists = count(content.approved_public_team_count);
  const detail = overview?.location?.id === location.id ? overview.location : location;
  let hours = "Program de completat";
  if (detail.opening_hours_json) {
    try {
      hours = validateProviderOpeningHours(JSON.parse(detail.opening_hours_json)).valid
        ? "Program configurat" : "Program de revizuit";
    } catch { hours = "Program de revizuit"; }
  } else if (String(detail.opening_hours || "").trim()) hours = "Program completat";
  const pending = value => count(value) > 0 ? counted(value, "modificare în lucru", "modificări în lucru") : "";
  const photo = Boolean(location.photo_url || location.profile_photo_url);
  return {
    services: { label: services === null ? "Rezumat indisponibil" : services ? counted(services, "serviciu aprobat", "servicii aprobate") : "Niciun serviciu aprobat", pending: pending(content.pending_service_review_count) },
    hours: { label: hours, pending: "" },
    specialists: { label: specialists === null ? "Rezumat indisponibil" : specialists ? counted(specialists, "specialist public", "specialiști publici") : "Niciun specialist public", pending: pending(content.pending_team_review_count) },
    photo: { label: photo ? "Fotografie principală adăugată" : "Fotografie de adăugat", pending: pending(content.pending_media_review_count), action: photo ? "Schimbă fotografia" : "Adaugă fotografia" },
  };
}

export function locationVisibilityPresentation(location = {}, organization = {}) {
  const suspended = location.profile_control_status === "suspended" || location.status === "suspendata";
  const inactive = location.active_status === "inactiva" || location.is_active === false;
  const publicProfile = isLocationPubliclyVisible(location) && !suspended;
  const title = suspended ? "Locație suspendată" : inactive ? "Locație inactivă" : publicProfile ? "Profil public" : "Profil nepublicat";
  const organizationArchived = organization.public_visibility_status === "archived";
  return {
    publicProfile,
    title,
    description: publicProfile ? "" : [
      "Locația nu este afișată public. Aprobarea datelor nu schimbă automat starea locației.",
      organizationArchived ? "Profilul organizației este arhivat." : "",
    ].filter(Boolean).join(" "),
  };
}
