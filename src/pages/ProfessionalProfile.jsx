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
  return String(value || "S")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "S";
}

function compactUrl(value) {
  return String(value || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function ContactRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 border-b border-border/70 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default function ProfessionalProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.functions.invoke("getPublicProfessionalProfile", { professional_id: id })
      .then((response) => {
        if (active) setProfile(response.data?.profile || null);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <div className="mx-auto min-h-[55vh] max-w-5xl px-5 pt-20 text-sm text-muted-foreground">Se încarcă profilul profesional...</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto min-h-[55vh] max-w-5xl px-5 pt-20">
        <h1 className="font-heading text-2xl font-extrabold">Profilul nu a fost gasit</h1>
        <p className="mt-2 text-sm text-muted-foreground">Profilul nu este public sau nu mai este disponibil.</p>
        <Link to="/cauta" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" /> Înapoi la căutare
        </Link>
      </div>
    );
  }

  const typeLabel = PROFESSIONAL_TYPE_LABELS[profile.professional_type] || "Specialist";
  const specializations = profile.specializations || [];
  const locations = profile.locations || [];
  const socialLinks = SOCIAL_LINKS.filter((item) => profile[item.key]);
  const hasContact = Boolean(profile.public_phone || profile.public_email || profile.website || socialLinks.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-12">
      <Link to="/cauta" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la căutare
      </Link>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-border bg-card shadow-sm">
        <div className="p-5 sm:p-8" style={{ background: "linear-gradient(135deg, #fffaf2 0%, #ffffff 55%, #f4f1ea 100%)" }}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-white/90 bg-foreground font-heading text-2xl font-black text-background shadow-sm sm:h-28 sm:w-28">
              {profile.profile_photo_url
                ? <img src={profile.profile_photo_url} alt={`Fotografie ${profile.display_name}`} className="h-full w-full object-cover" decoding="async" />
                : initials(profile.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold shadow-sm">{typeLabel}</span>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-800">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verificat de VIASEE
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{profile.display_name}</h1>
              {specializations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {specializations.slice(0, 5).map((key) => (
                    <span key={key} className="rounded-full border border-border bg-white/75 px-3 py-1 text-xs font-medium">
                      {specializationLabel(profile.professional_type, key)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {profile.bio && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Despre specialist</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-foreground/75">{profile.bio}</p>
            </section>
          )}

          {specializations.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Domenii profesionale</h2>
              <p className="mt-1 text-xs text-muted-foreground">Domeniile declarate și verificate pentru acest profil.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {specializations.map((key) => (
                  <span key={key} className="rounded-full border border-border bg-secondary/35 px-3 py-2 text-xs font-semibold">
                    {specializationLabel(profile.professional_type, key)}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading font-bold">Locații asociate</h2>
                <p className="mt-1 text-xs text-muted-foreground">Sunt afișate numai asocierile publice cu locații active în VIASEE.</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {locations.length} {locations.length === 1 ? "locație" : "locații"}
              </span>
            </div>

            {locations.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-border bg-secondary/25 p-4 text-sm text-muted-foreground">
                Acest specialist lucreaza independent sau nu are inca o asociere publica cu o locație.
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {locations.map((location) => (
                  <Link key={location.id} to={`/furnizor/${location.id}`} className="group rounded-2xl border border-border bg-secondary/20 p-4 hover:bg-secondary/45">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
                        {location.image_url
                          ? <img src={location.image_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                          : <Building2 className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold group-hover:underline">{location.name}</h3>
                        {location.organization_name && <p className="mt-0.5 text-[11px] text-muted-foreground">{location.organization_name}</p>}
                        <p className="mt-2 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {[location.address, location.city, location.county].filter(Boolean).join(", ") || "Adresa nepublicată"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">Vezi locația <ArrowRight className="h-3.5 w-3.5" /></div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
              <UserRound className="h-4 w-4" />
            </div>
            <h2 className="mt-4 font-heading text-sm font-bold">Profil profesional</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Identitatea profesionala apartine specialistului. Asocierea cu o locație nu inseamna acces la administrarea acelei organizatii.
            </p>
            {profile.accepts_independent_requests && (
              <div className="mt-4 rounded-2xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Acceptă cereri independente</div>
            )}
          </section>

          {hasContact && (
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-sm font-bold">Contact profesional</h2>
              <div className="mt-4">
                {profile.public_phone && (
                  <ContactRow icon={Phone} label="Telefon">
                    <a href={`tel:${profile.public_phone.replace(/\s/g, "")}`} className="text-primary hover:underline">{profile.public_phone}</a>
                  </ContactRow>
                )}
                {profile.public_email && (
                  <ContactRow icon={Mail} label="Email">
                    <a href={`mailto:${profile.public_email}`} className="break-all text-primary hover:underline">{profile.public_email}</a>
                  </ContactRow>
                )}
                {profile.website && (
                  <ContactRow icon={Globe2} label="Website">
                    <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
                      {compactUrl(profile.website)} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </ContactRow>
                )}
              </div>
              {socialLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socialLinks.map((item) => (
                    <a key={item.key} href={profile[item.key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                        <SocialBrandIcon platform={item.platform} className="h-3.5 w-3.5" />
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

