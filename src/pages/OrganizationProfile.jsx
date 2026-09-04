import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Building2, Globe2, MapPin, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useEntitySeo } from "@/lib/useEntitySeo";
import { SITE_URL, buildOrganizationProfileTitle } from "../../shared/seoProfileMetadata.js";
import ProfessionalThumb from "@/components/results/ProfessionalThumb";

const ORGANIZATION_TYPE_LABELS = {
  optical_chain: "Lanț de optici",
  independent_optical_store: "Optică independentă",
  ophthalmology_clinic: "Clinică oftalmologică",
  ophthalmology_office: "Cabinet oftalmologic",
  healthcare_network: "Rețea medicală",
  multi_specialty_healthcare_provider: "Furnizor multi-specialitate",
  public_healthcare_institution: "Instituție publică de sănătate",
  independent_professional: "Profesionist independent",
  optical_laboratory: "Laborator optic",
  other: "Organizație",
};

function LocationRow({ location }) {
  return (
    <Link
      to={`/furnizor/${location.id}`}
      className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-bold text-foreground">{location.name}</p>
        {location.address && (
          <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{location.address}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {location.city && <span>{location.city}</span>}
          {location.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" aria-hidden="true" />
              {location.phone}
            </span>
          )}
          {location.status_label && (
            <span className="rounded-full border border-border px-2 py-0.5">{location.status_label}</span>
          )}
        </div>
      </div>
      <ArrowRight
        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function OrganizationProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    base44.functions
      .invoke("getPublicProviderProfile", { organization_id: id })
      .then((res) => setData(res.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const organization = data?.organization || null;
  const summary = data?.summary || null;
  const locations = useMemo(() => data?.locations || [], [data]);
  const professionals = useMemo(() => data?.professionals || [], [data]);

  const grouped = useMemo(() => {
    const filtered = selectedCounty
      ? locations.filter((location) => location.county === selectedCounty)
      : locations;
    const byCounty = new Map();
    for (const location of filtered) {
      const key = location.county || "Alte localități";
      if (!byCounty.has(key)) byCounty.set(key, []);
      byCounty.get(key).push(location);
    }
    return [...byCounty.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [locations, selectedCounty]);

  // 2026-09-03, audit SEO. Aici exista deja intentia corecta - pagina incerca sa isi puna
  // title si description proprii - dar o facea montand a doua oara componenta RouteSeo, cu
  // props. RouteSeo e declarat fara parametri, deci props-urile erau ignorate tacut si pe ruta
  // asta ajunsesera doua instante care scriau in acelasi head. De aceea metadatele merg
  // acum prin store, iar instanta globala ramane singurul scriitor.
  const seoMeta = useMemo(() => {
    if (loading) return null;
    if (!organization) {
      return { title: "Organizație indisponibilă | VIASEE", description: "Profilul căutat nu este public pe VIASEE.", noindex: true };
    }
    const canonical = `${SITE_URL}/organizatie/${organization.id || id}`;
    const locationCount = summary?.location_count || locations.length || 0;
    const countyCount = summary?.county_count || 0;
    return {
      title: buildOrganizationProfileTitle(organization),
      description: `${organization.name}: ${locationCount} locații publice în ${countyCount} județe. Vezi adresele, programul și detaliile fiecărei locații.`,
      image: /^https?:\/\//i.test(String(organization.logo_url || "")) ? organization.logo_url : undefined,
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${canonical}#organization`,
            name: organization.name,
            url: canonical,
            ...(organization.website ? { sameAs: [organization.website] } : {}),
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${canonical}#breadcrumb`,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "VIASEE", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Caută furnizori", item: `${SITE_URL}/cauta` },
              { "@type": "ListItem", position: 3, name: organization.name, item: canonical },
            ],
          },
        ],
      },
    };
  }, [loading, organization, summary, locations.length, id]);
  useEntitySeo(seoMeta);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Organizația nu a fost găsită</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este posibil ca profilul să nu fie public sau să fi fost mutat.
        </p>
        <Link
          to="/cauta"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Caută în director
        </Link>
      </div>
    );
  }

  const typeLabel = ORGANIZATION_TYPE_LABELS[organization.organization_type_code] || "Organizație";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {organization.logo_configured ? (
            <img
              src={organization.logo_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl border border-border object-contain p-1.5"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/50">
              <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{typeLabel}</p>
            <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-foreground">{organization.name}</h1>
            {organization.legal_name && organization.legal_name !== organization.name && (
              <p className="mt-1 text-xs text-muted-foreground">{organization.legal_name}</p>
            )}
          </div>
        </div>

        {organization.website && (
          <a
            href={organization.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40"
          >
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            Site oficial
          </a>
        )}
      </header>

      {organization.description && (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">{organization.description}</p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-3xl font-bold text-foreground">{summary?.location_count || 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">locații publice în director</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-3xl font-bold text-foreground">{summary?.county_count || 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">județe acoperite</p>
        </div>
      </div>

      {(summary?.counties?.length || 0) > 1 && (
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filtrează după județ</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCounty("")}
              className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                selectedCounty === ""
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              Toate
            </button>
            {summary.counties.map((entry) => (
              <button
                key={entry.county}
                type="button"
                onClick={() => setSelectedCounty(entry.county)}
                className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  selectedCounty === entry.county
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {entry.county} ({entry.location_count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {grouped.map(([county, items]) => (
          <section key={county}>
            <h2 className="font-heading text-sm font-bold text-foreground">
              {county}
              <span className="ml-2 font-normal text-muted-foreground">
                {items.length} {items.length === 1 ? "locație" : "locații"}
              </span>
            </h2>
            <div className="mt-3 grid gap-2.5">
              {items.map((location) => (
                <LocationRow key={location.id} location={location} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 2026-09-03: drumul organizatie -> specialist. Asocierile publice existau deja in date,
          dar pagina de organizatie nu ducea nicaieri catre oameni: pacientul vedea locatiile si
          se oprea acolo. Sunt afisati exact specialistii pe care i-ar fi vazut oricum deschizand
          fiecare locatie in parte - nicio conditie de vizibilitate nu este relaxata aici. */}
      {professionals.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-sm font-bold text-foreground">
            Specialiști
            <span className="ml-2 font-normal text-muted-foreground">
              {professionals.length} {professionals.length === 1 ? "specialist" : "specialiști"}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Profiluri verificate, afișate cu acordul explicit al fiecărui specialist.
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {professionals.map((professional) => (
              <Link
                key={professional.id}
                to={`/specialist/${professional.id}`}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/40"
              >
                <ProfessionalThumb professional={professional} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {professional.professional_type_label}
                  </div>
                  <h3 className="mt-0.5 text-sm font-bold group-hover:underline">{professional.display_name}</h3>
                  {professional.locations?.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {professional.locations.map((location) => location.name).filter(Boolean).slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        Informațiile provin din surse oficiale și din datele declarate de furnizor. Dacă reprezentați această
        organizație, puteți{" "}
        <Link to="/adauga-sau-revendica" className="font-medium text-foreground underline underline-offset-2">
          revendica profilul
        </Link>{" "}
        pentru a actualiza datele.
      </p>
    </div>
  );
}
