import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";
import {
  PROFESSIONAL_TYPE_LABELS,
  specializationLabel,
} from "@/lib/professionalProfileCatalog";

const SOCIAL_LINKS = [
  { key: "linkedin", label: "LinkedIn", platform: "linkedin" },
  { key: "facebook", label: "Facebook", platform: "facebook" },
  { key: "instagram", label: "Instagram", platform: "instagram" },
];

function initials(value) {
  return (
    String(value || "S")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "S"
  );
}

function compactUrl(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function ContactRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 border-b border-border/70 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 break-words text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

function ProfileSection({ id, title, description, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[26px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(34,30,24,0.035)] sm:p-6"
    >
      <div>
        <h2 className="font-heading text-lg font-bold tracking-[-0.02em]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ProfessionalProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.functions
      .invoke("getPublicProfessionalProfile", { professional_id: id })
      .then((response) => {
        if (active) setProfile(response.data?.profile || null);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto min-h-[55vh] max-w-6xl px-5 pt-20 text-sm text-muted-foreground">
        Se incarca profilul profesional...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto min-h-[55vh] max-w-6xl px-5 pt-20">
        <h1 className="font-heading text-2xl font-extrabold">
          Profilul nu a fost gasit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Profilul nu este public sau nu mai este disponibil.
        </p>
        <Link
          to="/cauta"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" /> Inapoi la cautare
        </Link>
      </div>
    );
  }

  const typeLabel =
    PROFESSIONAL_TYPE_LABELS[profile.professional_type] || "Specialist";
  const specializations = profile.specializations || [];
  const locations = profile.locations || [];
  const socialLinks = SOCIAL_LINKS.filter((item) => profile[item.key]);
  const hasContact = Boolean(
    profile.public_phone ||
      profile.public_email ||
      profile.website ||
      socialLinks.length > 0,
  );
  const navigationItems = [
    profile.bio && { href: "#despre", label: "Despre" },
    specializations.length > 0 && {
      href: "#domenii",
      label: "Domenii profesionale",
    },
    { href: "#locatii", label: "Locatii" },
    hasContact && { href: "#contact", label: "Contact" },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 sm:pt-10">
      <Link
        to="/cauta"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inapoi la cautare
      </Link>

      <section className="mt-3 overflow-hidden rounded-[30px] border border-border bg-card shadow-[0_14px_40px_rgba(34,30,24,0.05)]">
        <div
          className="relative h-36 overflow-hidden sm:h-48 lg:h-52"
          style={{
            background:
              "linear-gradient(180deg, #eef2f1 0%, #e4eaeb 55%, #f0c9ad 82%, #e96a36 100%)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.14) 1px, transparent 1.15px)",
              backgroundSize: "22px 22px",
            }}
          />
          <span
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/55"
          />
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-12 h-40 w-40 rounded-full border border-white/45"
          />
        </div>

        <div className="relative px-5 pb-0 sm:px-8 lg:px-10">
          <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:gap-6">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border-4 border-card bg-foreground font-heading text-2xl font-black text-background shadow-[0_10px_28px_rgba(23,23,23,0.14)] sm:h-32 sm:w-32 sm:rounded-[30px]">
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={`Fotografie ${profile.display_name}`}
                  className="h-full w-full object-cover"
                  decoding="async"
                />
              ) : (
                initials(profile.display_name)
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#e9d8ca] bg-[#fff7ef] px-3 py-1 text-[11px] font-semibold text-[#9b4f2e]">
                  {typeLabel}
                </span>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf4ec] px-3 py-1 text-[11px] font-semibold text-[#2f6b3d]">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verificat de VIASEE
                  </span>
                )}
                {profile.accepts_independent_requests && (
                  <span className="rounded-full border border-border bg-secondary/65 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Accepta solicitari independente
                  </span>
                )}
              </div>

              <h1 className="mt-3 break-words font-heading text-[2rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[2.6rem]">
                {profile.display_name}
              </h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
                {typeLabel}
                {specializations.length > 0
                  ? ` · ${specializationLabel(
                      profile.professional_type,
                      specializations[0],
                    )}`
                  : ""}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 pb-1 sm:w-auto sm:flex-row sm:pb-2">
              {hasContact && (
                <a
                  href="#contact"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  Contact
                </a>
              )}
              <a
                href="#locatii"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#171717] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
              >
                Vezi locatiile <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <nav
            aria-label="Sectiuni profil"
            className="mt-7 flex gap-1 overflow-x-auto border-t border-border/80 py-2 scrollbar-none sm:mt-8"
          >
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {profile.bio && (
            <ProfileSection id="despre" title="Despre specialist">
              <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/75">
                {profile.bio}
              </p>
            </ProfileSection>
          )}

          {specializations.length > 0 && (
            <ProfileSection
              id="domenii"
              title="Domenii profesionale"
              description="Domeniile declarate si afisate pentru acest profil profesional."
            >
              <div className="flex flex-wrap gap-2">
                {specializations.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-border bg-secondary/35 px-3.5 py-2 text-xs font-semibold"
                  >
                    {specializationLabel(profile.professional_type, key)}
                  </span>
                ))}
              </div>
            </ProfileSection>
          )}

          <ProfileSection
            id="locatii"
            title="Locatii asociate"
            description="Sunt afisate numai asocierile publice cu locatii active in VIASEE."
          >
            <div className="mb-4 flex justify-end">
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {locations.length} {locations.length === 1 ? "locatie" : "locatii"}
              </span>
            </div>

            {locations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-secondary/25 p-4 text-sm leading-relaxed text-muted-foreground">
                Acest specialist lucreaza independent sau nu are inca o asociere
                publica cu o locatie.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {locations.map((location) => (
                  <Link
                    key={location.id}
                    to={`/furnizor/${location.id}`}
                    className="group rounded-2xl border border-border bg-secondary/20 p-4 transition-colors hover:bg-secondary/45"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
                        {location.image_url ? (
                          <img
                            src={location.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-bold group-hover:underline">
                          {location.name}
                        </h3>
                        {location.organization_name && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {location.organization_name}
                          </p>
                        )}
                        <p className="mt-2 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {[location.address, location.city, location.county]
                            .filter(Boolean)
                            .join(", ") || "Adresa nepublicata"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold">
                      Vezi locatia <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ProfileSection>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          <section className="rounded-[26px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(34,30,24,0.035)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
              <UserRound className="h-4 w-4" />
            </div>
            <h2 className="mt-4 font-heading text-sm font-bold">
              Profil profesional
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Identitatea profesionala apartine specialistului. Asocierea cu o
              locatie nu inseamna acces la administrarea acelei organizatii.
            </p>
          </section>

          {hasContact && (
            <section
              id="contact"
              className="scroll-mt-24 rounded-[26px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(34,30,24,0.035)]"
            >
              <h2 className="font-heading text-sm font-bold">
                Contact profesional
              </h2>
              <div className="mt-4">
                {profile.public_phone && (
                  <ContactRow icon={Phone} label="Telefon">
                    <a
                      href={`tel:${profile.public_phone.replace(/\s/g, "")}`}
                      className="text-primary hover:underline"
                    >
                      {profile.public_phone}
                    </a>
                  </ContactRow>
                )}
                {profile.public_email && (
                  <ContactRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${profile.public_email}`}
                      className="break-all text-primary hover:underline"
                    >
                      {profile.public_email}
                    </a>
                  </ContactRow>
                )}
                {profile.website && (
                  <ContactRow icon={Globe2} label="Website">
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                    >
                      {compactUrl(profile.website)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </ContactRow>
                )}
              </div>

              {socialLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socialLinks.map((item) => (
                    <a
                      key={item.key}
                      href={profile[item.key]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                        <SocialBrandIcon
                          platform={item.platform}
                          className="h-3.5 w-3.5"
                        />
                      </span>
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
