import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, ChevronDown, Clock, ExternalLink, Globe2, Mail, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";
import { CLIENT_NEED_BY_KEY, summarizePublicServices } from "@/lib/servicePresentation";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";
import ProviderLocationHero from "@/components/provider/ProviderLocationHero";

const SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", platform: "facebook" },
  { key: "instagram", label: "Instagram", platform: "instagram" },
  { key: "linkedin", label: "LinkedIn", platform: "linkedin" },
];

const SPECIALIZATION_LABELS = {
  general_ophthalmology: "Oftalmologie generală",
  pediatric_ophthalmology: "Oftalmologie pediatrică",
  glaucoma: "Glaucom",
  retina: "Retină",
  cornea: "Cornee",
  cataract: "Cataractă",
  refractive_surgery: "Chirurgie refractivă",
  dry_eye: "Ochi uscat",
  myopia_management: "Managementul miopiei",
  refraction: "Refracție și dioptrii",
  contact_lenses: "Lentile de contact",
  pediatric_optometry: "Optometrie pediatrică",
  binocular_vision: "Vedere binoculară",
  low_vision: "Vedere slabă",
  occupational_vision: "Vedere ocupațională",
  frame_consulting: "Consiliere rame",
  ophthalmic_lenses: "Lentile oftalmice",
  progressive_lenses: "Lentile progresive",
  lens_fitting: "Montaj lentile",
  adjustments_repairs: "Reglaje și reparații",
  children_eyewear: "Ochelari pentru copii",
  protective_eyewear: "Ochelari de protecție",
};

const WEEK_DAYS = [
  { key: "monday", label: "Luni" },
  { key: "tuesday", label: "Marți" },
  { key: "wednesday", label: "Miercuri" },
  { key: "thursday", label: "Joi" },
  { key: "friday", label: "Vineri" },
  { key: "saturday", label: "Sâmbătă" },
  { key: "sunday", label: "Duminică" },
];

function compactUrl(url) {
  return String(url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCaseAddress(value) {
  const raw = String(value || "").trim();
  if (!raw || raw !== raw.toLocaleUpperCase("ro-RO")) return raw;
  return raw
    .toLocaleLowerCase("ro-RO")
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator, letter) => `${separator}${letter.toLocaleUpperCase("ro-RO")}`);
}

function formatStreetAddress(address, city) {
  let value = String(address || "").trim().replace(/\s+/g, " ");
  if (!value) return "";

  if (city) {
    const cityPrefix = new RegExp(`^(?:sat(?:ul)?\\s+)?${escapeRegExp(city)}\\s*,\\s*`, "i");
    value = value.replace(cityPrefix, "");
  }

  value = value
    .replace(/(?:,\s*)?ET\.?\s*$/i, "")
    .replace(/\bSTR\.?\s*/gi, "Str. ")
    .replace(/\bNR\.?\s*/gi, "nr. ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*$/, "")
    .trim();

  value = titleCaseAddress(value)
    .replace(/\bNr\.\s*/g, "nr. ")
    .replace(/\bStr\.\s*/g, "Str. ");

  return value;
}

function fullAddress(profile) {
  const parts = [formatStreetAddress(profile.address, profile.city), profile.city, profile.county].filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLocaleLowerCase("ro-RO") === String(part).toLocaleLowerCase("ro-RO"))) unique.push(part);
  }
  return unique.join(", ");
}

function initials(value) {
  return String(value || "S").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function readableServiceSummary(labels = []) {
  const items = uniqueValues(labels);
  if (items.length === 0) return "Vezi serviciile disponibile în această categorie.";
  if (items.length === 1) return `Include ${items[0]}.`;
  if (items.length === 2) return `Include ${items[0]} și ${items[1]}.`;
  if (items.length === 3) return `Include ${items[0]}, ${items[1]} și ${items[2]}.`;
  return `Include ${items[0]}, ${items[1]} și încă ${items.length - 2} servicii.`;
}

function groupedProgramRows(openingHoursJson) {
  if (!openingHoursJson) return [];
  try {
    const parsed = typeof openingHoursJson === "string" ? JSON.parse(openingHoursJson) : openingHoursJson;
    const weekly = parsed?.weekly;
    if (!weekly || typeof weekly !== "object") return [];

    const days = WEEK_DAYS.map((day) => {
      const value = weekly[day.key] || {};
      const open = value.open === true;
      return {
        ...day,
        open,
        from: open ? String(value.from || "").trim() : "",
        to: open ? String(value.to || "").trim() : "",
        signature: open ? `open:${value.from || ""}:${value.to || ""}` : "closed",
      };
    });

    const groups = [];
    for (const day of days) {
      const current = groups[groups.length - 1];
      if (current && current.signature === day.signature) current.end = day;
      else groups.push({ start: day, end: day, signature: day.signature });
    }

    return groups.map((group) => ({
      label: group.start.key === group.end.key ? group.start.label : `${group.start.label}–${group.end.label}`,
      value: group.start.open ? `${group.start.from || "—"} - ${group.start.to || "—"}` : "Închis",
    }));
  } catch (_error) {
    return [];
  }
}

function programRows(openingHoursJson, openingHours, saturdayHours) {
  const structuredRows = groupedProgramRows(openingHoursJson);
  if (structuredRows.length > 0) return structuredRows;

  const rows = String(openingHours || "")
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (saturdayHours && !rows.some((row) => row.toLowerCase().includes("sâmb") || row.toLowerCase().includes("samb"))) {
    rows.push(`Sâmbătă: ${saturdayHours}`);
  }

  return rows.map((row) => {
    const separatorIndex = row.indexOf(":");
    if (separatorIndex < 0) return { label: row, value: "" };
    return {
      label: row.slice(0, separatorIndex).trim(),
      value: row.slice(separatorIndex + 1).trim(),
    };
  });
}

function sameCopy(left, right) {
  return String(left || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO")
    === String(right || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO");
}

function SocialPublicLink({ item, url }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary" title={compactUrl(url)}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" /></span>
      {item.label}
    </a>
  );
}

function ContactRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 border-b border-border/70 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

function ServicesCard({ services, confirmationLevel }) {
  const summaries = summarizePublicServices(services).filter((item) => item.key !== "other");
  if (summaries.length === 0) return null;

  const serviceByKey = new Map(services.map((service) => [service.key, service]));
  const groups = summaries.map((summary) => {
    const section = CLIENT_NEED_BY_KEY[summary.key];
    const selectedServices = summary.matchedIds.map((key) => serviceByKey.get(key)).filter(Boolean);
    return { ...summary, section, selectedServices };
  }).filter((group) => group.section && group.selectedServices.length > 0);

  if (groups.length === 0) return null;

  const uniqueServiceCount = new Set(groups.flatMap((group) => group.selectedServices.map((service) => service.key))).size;
  const categoryLabel = groups.length === 1 ? "categorie" : "categorii";
  const serviceLabel = uniqueServiceCount === 1 ? "serviciu" : "servicii";
  const confirmationText = confirmationLevel === "vezunde_verified"
    ? "Verificate de VIASEE"
    : confirmationLevel === "provider_confirmed"
      ? "Confirmate de furnizor"
      : null;

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold">Servicii disponibile</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Vezi principalele produse și servicii disponibile în această locație.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirmationText && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${confirmationLevel === "vezunde_verified" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>
              <BadgeCheck className="h-3 w-3" /> {confirmationText}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{groups.length} {categoryLabel}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <article key={group.key} className="rounded-2xl border border-border bg-secondary/20 p-4">
            <h3 className="text-sm font-bold">{group.label}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{readableServiceSummary(group.selectedServices.map((service) => service.label))}</p>
          </article>
        ))}
      </div>

      <details className="group mt-4 rounded-2xl border border-border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>Vezi toate cele {uniqueServiceCount} {serviceLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-4">
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.selectedServices.map((service) => (
                    <li key={`${group.key}-${service.key}`} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/55" />
                      <span>{service.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function TeamCard({ team }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold">Echipa acestei locații</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sunt afișați doar specialiștii verificați și asociați public cu această locație.</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{team.length} {team.length === 1 ? "specialist" : "specialiști"}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {team.map((professional) => (
          <article key={professional.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="flex items-start gap-3">
              {professional.profile_photo_url ? (
                <img src={professional.profile_photo_url} alt={`Fotografie ${professional.full_name}`} className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card font-heading font-bold">{initials(professional.full_name)}</div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold">{professional.full_name}</h3>
                  {professional.verified && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800"><BadgeCheck className="h-3 w-3" /> Verificat</span>}
                </div>
                <div className="mt-1 text-xs font-semibold text-primary">{PROFESSIONAL_TYPES[professional.professional_type] || professional.professional_type}</div>
              </div>
            </div>

            {(professional.specializations || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {professional.specializations.slice(0, 4).map((key) => <span key={key} className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">{SPECIALIZATION_LABELS[key] || key}</span>)}
              </div>
            )}

            {professional.bio && <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{professional.bio}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

export default function ProviderProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke("getPublicProviderProfile", { location_id: id }).then((res) => setProfile(res.data?.profile || null)).catch(() => setProfile(null)).finally(() => setLoading(false));
  }, [id]);

  const services = useMemo(() => profile?.services || [], [profile?.services]);

  if (loading) return <div className="mx-auto max-w-5xl px-5 pt-20 text-sm text-muted-foreground">Se încarcă...</div>;
  if (!profile) return <div className="mx-auto max-w-5xl px-5 pt-20 text-sm text-muted-foreground">Furnizorul nu a fost găsit.</div>;

  const status = profile.profile_control_status;
  const mapUrl = buildGoogleMapsUrl(profile);
  const embedUrl = buildGoogleMapsEmbedUrl(profile);
  const websiteLabel = profile.website ? compactUrl(profile.website) : "";
  const socialLinks = SOCIAL_LINKS.filter((item) => profile[item.key]);
  const addressLabel = fullAddress(profile);
  const team = profile.team || [];
  const hours = programRows(profile.opening_hours_json, profile.opening_hours, profile.saturday_hours);
  const organizationDescription = profile.organization_description || profile.description || null;
  const locationDescription = profile.location_description && !sameCopy(profile.location_description, organizationDescription)
    ? profile.location_description
    : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-12">
      <ProviderLocationHero profile={profile} status={status} serviceCount={services.length} mapUrl={mapUrl} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="space-y-5">
          {organizationDescription && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Despre organizație</h2>
              <p className="mt-2 text-[15px] leading-7 text-foreground/75">{organizationDescription}</p>
            </div>
          )}

          {locationDescription && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Despre această locație</h2>
              <p className="mt-2 text-[15px] leading-7 text-foreground/75">{locationDescription}</p>
            </div>
          )}

          {services.length > 0 && <ServicesCard services={services} confirmationLevel={profile.service_confirmation_level} />}
          {team.length > 0 && <TeamCard team={team} />}

          {status === "directory" && (
            <div className="rounded-3xl border border-dashed border-border/80 bg-secondary/40 p-6">
              <p className="text-sm text-muted-foreground">Informațiile acestui profil provin din surse publice și pot fi actualizate de furnizor prin revendicarea profilului.</p>
              <Link to="/adauga-sau-revendica" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">Aceasta este locația ta? Revendică profilul</Link>
            </div>
          )}
        </main>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-sm font-bold">Date și contact</h2>
            <div className="mt-4">
              {profile.phone_public && (
                <ContactRow icon={Phone} label="Telefon">
                  <a href={`tel:${profile.phone_public.replace(/\s/g, "")}`} className="text-primary hover:underline">{profile.phone_public}</a>
                </ContactRow>
              )}
              {profile.public_email && (
                <ContactRow icon={Mail} label="Email">
                  <a href={`mailto:${profile.public_email}`} className="break-all text-primary hover:underline">{profile.public_email}</a>
                </ContactRow>
              )}
              {profile.website && (
                <ContactRow icon={Globe2} label="Website">
                  <a href={profile.website} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{websiteLabel}</a>
                </ContactRow>
              )}
              <ContactRow icon={Clock} label="Program">
                {hours.length > 0 ? (
                  <div className="space-y-1.5">
                    {hours.map((row, index) => (
                      <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="text-right font-semibold text-foreground">{row.value || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-muted-foreground">Program nepublicat</span>}
              </ContactRow>
            </div>
            {socialLinks.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socialLinks.map((item) => <SocialPublicLink key={item.key} item={item} url={profile[item.key]} />)}</div>}
            {profile.availability_label && <p className="mt-4 rounded-2xl bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">{profile.availability_label} · publicat de furnizor</p>}
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-bold">Hartă și adresă</h2>
                  {addressLabel ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{addressLabel}</p> : <p className="mt-2 text-sm text-muted-foreground">Adresa completă nu este publicată.</p>}
                  {profile.map_precision === "approximate" && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Poziție aproximativă, calculată din adresă.</p>}
                  {profile.map_precision === "exact" && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Poziție confirmată pe hartă.</p>}
                </div>
                {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">Deschide în Maps <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </div>
            {hasMapLocation(profile) && embedUrl ? (
              <div className="h-60 border-t border-border bg-secondary">
                <iframe title={`Harta ${profile.name}`} src={embedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            ) : (
              <div className="border-t border-border bg-secondary/40 p-5 text-sm text-muted-foreground">Harta va fi afișată după publicarea adresei sau a pinului verificat.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
