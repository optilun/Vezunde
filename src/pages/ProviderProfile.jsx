import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock, ExternalLink, Globe2, MapPin, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES, PROFESSIONAL_AFFILIATION_STATUS, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";
import { summarizePublicServiceKeys } from "@/lib/servicePresentation";
import TrustBadge from "@/components/results/TrustBadge";
import ServiceChip from "@/components/results/ServiceChip";
import SocialBrandIcon from "@/components/common/SocialBrandIcon";

const SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", platform: "facebook" },
  { key: "instagram", label: "Instagram", platform: "instagram" },
  { key: "linkedin", label: "LinkedIn", platform: "linkedin" },
];

function compactUrl(url) {
  return String(url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function locationSummary(profile) {
  return [profile.city, profile.county].filter(Boolean).join(", ") || profile.city || "Romania";
}

function fullAddress(profile) {
  return [profile.address, profile.city, profile.county].filter(Boolean).join(", ");
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

function ContactLine({ icon: Icon, label, children }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/25 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function ServicesCard({ services }) {
  const publicSummaries = summarizePublicServiceKeys(services);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold">Ce poți face aici</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Afișăm pe scurt nevoile acoperite. Particularitățile tehnice sunt folosite în spate pentru recomandări mai bune.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{publicSummaries.length} zone</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {publicSummaries.map((item) => <ServiceChip key={item.key} label={item.label} />)}
      </div>

      <p className="mt-4 rounded-2xl bg-secondary/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Exemplu: dacă locația are reglaj rame, reparații și montaj lentile, public afișăm „Reparații și reglaje”, iar detaliile ajută la alegerea rezultatului potrivit.
      </p>
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
  const publicServiceCount = summarizePublicServiceKeys(services).length;

  if (loading) return <div className="max-w-5xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Se incarca...</div>;
  if (!profile) return <div className="max-w-5xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Furnizorul nu a fost gasit.</div>;

  const status = profile.profile_control_status;
  const mapUrl = buildGoogleMapsUrl(profile);
  const embedUrl = buildGoogleMapsEmbedUrl(profile);
  const websiteLabel = profile.website ? compactUrl(profile.website) : "";
  const socialLinks = SOCIAL_LINKS.filter((item) => profile[item.key]);
  const addressLabel = fullAddress(profile);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-12">
      <div className="rounded-[32px] border border-border bg-card/70 p-6 shadow-sm sm:p-7">
        <div className="text-xs font-medium text-primary">{PROVIDER_TYPES[profile.provider_type]}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{profile.name}</h1>
          <TrustBadge status={status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{locationSummary(profile)}</span>
          {publicServiceCount > 0 && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">{publicServiceCount} zone disponibile</span>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="space-y-5">
          {profile.description && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Despre</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
            </div>
          )}

          {services.length > 0 && <ServicesCard services={services} />}

          {status === "directory" && (
            <div className="rounded-3xl border border-dashed border-border/80 bg-secondary/40 p-6">
              <p className="text-sm text-muted-foreground">Informatiile acestui profil provin din surse publice si pot fi actualizate de furnizor prin revendicarea profilului.</p>
              <Link to="/adauga-sau-revendica" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">Aceasta este locatia ta? Revendica profilul</Link>
            </div>
          )}

          {profile.team.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading font-bold">Specialisti</h2>
              <p className="mt-1 text-xs text-muted-foreground">Specialistii sunt afisati ca membri ai acestei locatii.</p>
              <div className="mt-4 space-y-4">
                {profile.team.map((pro, i) => {
                  const affiliation = pro.affiliation_status || "location_added";
                  const showBadge = affiliation !== "location_added";
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-heading font-bold text-primary">{pro.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium">{pro.full_name}</div>
                          {showBadge && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">{PROFESSIONAL_AFFILIATION_STATUS[affiliation] || affiliation}</span>}
                        </div>
                        <div className="text-xs text-primary">{PROFESSIONAL_TYPES[pro.professional_type]}</div>
                        {pro.bio && <p className="mt-1 text-xs text-muted-foreground">{pro.bio}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading font-bold text-sm">Date si contact</h2>
            <div className="mt-4 space-y-3">
              {profile.phone_public ? (
                <ContactLine icon={Phone} label="Telefon">
                  <a href={`tel:${profile.phone_public.replace(/\s/g, "")}`} className="text-primary hover:underline">{profile.phone_public}</a>
                </ContactLine>
              ) : (
                <ContactLine icon={Phone} label="Telefon"><span className="text-muted-foreground">Indisponibil</span></ContactLine>
              )}
              {profile.website && (
                <ContactLine icon={Globe2} label="Website">
                  <a href={profile.website} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{websiteLabel}</a>
                </ContactLine>
              )}
              <ContactLine icon={Clock} label="Program">
                {profile.opening_hours ? <span>{profile.opening_hours}</span> : <span className="text-muted-foreground">Program nepublicat</span>}
                {profile.saturday_hours && !String(profile.opening_hours || "").includes(profile.saturday_hours) && <div className="mt-1 text-xs text-muted-foreground">Sambata: {profile.saturday_hours}</div>}
              </ContactLine>
            </div>
            {socialLinks.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socialLinks.map((item) => <SocialPublicLink key={item.key} item={item} url={profile[item.key]} />)}</div>}
            {profile.availability_label && <p className="mt-4 rounded-2xl bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">{profile.availability_label} · publicat de furnizor</p>}
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading font-bold text-sm">Harta si adresa</h2>
                  {addressLabel ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{addressLabel}</p> : <p className="mt-2 text-sm text-muted-foreground">Adresa completa nu este publicata.</p>}
                </div>
                {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">Maps <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </div>
            {hasMapLocation(profile) && embedUrl ? (
              <div className="h-60 border-t border-border bg-secondary">
                <iframe title={`Harta ${profile.name}`} src={embedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            ) : (
              <div className="border-t border-border bg-secondary/40 p-5 text-sm text-muted-foreground">Harta va fi afisata dupa publicarea adresei sau a pinului verificat.</div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <Link to={`/cerere?furnizor=${profile.id}`} className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-medium text-primary-foreground transition-opacity hover:opacity-90">Trimite o cerere <ArrowRight className="h-4 w-4" /></Link>
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">Datele tale de contact nu sunt transmise automat furnizorului. Poti oricand suna direct.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
