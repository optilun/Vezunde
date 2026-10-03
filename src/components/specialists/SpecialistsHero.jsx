import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  MapPin,
  MapPinPlus,
  Search,
  Stethoscope,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import SpecialistsLocationArtwork from "./SpecialistsLocationArtwork";
import OrganizationSearchResult from "@/components/provider/OrganizationSearchResult";
import { standaloneClaimLocations } from "@/lib/claimSearchResults";

const AUDIENCE_OPTIONS = [
  {
    id: "organization",
    icon: Building2,
    title: "Optică, clinică sau cabinet",
    description: "Administrez una sau mai multe locații.",
  },
  {
    id: "professional",
    icon: Stethoscope,
    title: "Sunt specialist",
    description: "Oftalmolog, optometrist sau optician.",
  },
];

export default function SpecialistsHero() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState("organization");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const reqRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqRef.current;
    setResults([]);
    setOrganizations([]);
    setSearchError(false);
    if (audience !== "organization") {
      setResults([]);
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke("getClaimableProviderLocations", { q });
        if (res.data?.error) throw new Error(res.data.error);
        if (reqId !== reqRef.current) return;
        setResults(res.data?.locations || []);
        setOrganizations(res.data?.organizations || []);
      } catch {
        if (reqId === reqRef.current) setSearchError(true);
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(t);
      reqRef.current += 1;
    };
  }, [audience, query, searchRetry]);

  const searched = audience === "organization" && query.trim().length >= 2;
  const standaloneLocations = standaloneClaimLocations(results, organizations);

  return (
    <section id="profilul-tau" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 pb-14 pt-10 sm:pb-16 sm:pt-12">
      <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_1fr]" data-hero-intro>
        <div className="relative z-10 text-center lg:text-left">
          <h1 className="font-heading text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
            Administrează prezența ta pe VIASEE.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
            Prezintă-ți serviciile, actualizează datele și gestionează locațiile.
          </p>
        </div>
        <SpecialistsLocationArtwork />
      </div>

      <div className="mt-7 grid gap-6 rounded-2xl border border-[#E4E4DF] bg-card p-4 shadow-[0_8px_32px_rgba(24,35,45,0.035)] sm:p-6 lg:grid-cols-[.82fr_1.35fr] lg:gap-8" data-profile-panel>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#657087]">Ce vrei să administrezi?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1" role="group" aria-label="Alege ce vrei să administrezi">
            {AUDIENCE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = audience === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAudience(option.id)}
                  className={`relative min-w-0 rounded-xl border p-4 pr-8 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#405AE9] focus-visible:ring-offset-2 ${
                    selected
                      ? "border-[#405AE9] bg-[#EEF2FF] shadow-sm"
                      : "border-border bg-card hover:border-[#A5B7EE] hover:bg-[#F8FAFF]"
                  }`}
                >
                  {selected && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-[#405AE9] sm:right-3 sm:top-3" />}
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      selected ? "bg-[#405AE9] text-white" : "bg-secondary text-foreground"
                    }`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-heading text-sm font-bold leading-snug">{option.title}</span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-[#657087]">{option.description}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        <div className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {audience === "organization" ? (
            <div className="min-w-0">
              <div className="mb-4 text-left">
                <h2 className="font-heading text-xl font-bold">Caută organizația sau locația</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#657087]">
                  Ai mai multe locații? Începe cu organizația și le alegi la pasul următor.
                </p>
              </div>

              <div className="relative flex gap-2.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    aria-label="Nume, localitate sau adresă"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Numele organizației sau locației"
                    className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#FAFAF8] border border-border text-sm outline-none focus:ring-2 focus:border-[#405AE9] focus:ring-[#DCE4FF] transition-shadow"
                  />
                  {loading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (searchError) setSearchRetry((current) => current + 1);
                    document.getElementById("hero-search-results")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                  className="h-12 px-4 sm:px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
                >
                  Caută
                </button>
              </div>

              {searched && (
                <div id="hero-search-results" className="mt-4 space-y-2.5 text-left">
                  {organizations.map((organization) => (
                    <OrganizationSearchResult
                      key={organization.id}
                      organization={organization}
                      onClaimOrganization={(org) => {
                        const primary = org.locations.find((loc) => loc.id === org.primary_location_id) || org.locations[0];
                        if (primary) navigate("/adauga-sau-revendica", {
                          state: { selectedLocation: primary, selectedOrganization: org, preferredScope: "organization" },
                        });
                      }}
                      onClaimLocation={(loc) => navigate("/adauga-sau-revendica", {
                        state: { selectedLocation: loc },
                      })}
                    />
                  ))}
                  {standaloneLocations.map((loc) => {
                    const requestsAccess = loc.claim_action === "request_access";

                    return (
                      <div
                        key={loc.id}
                        className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {PROVIDER_TYPES[loc.provider_type] || loc.provider_type}
                          </div>
                          <div className="font-heading font-bold text-sm">{loc.name}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {loc.city}
                            {loc.address ? `, ${loc.address}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {requestsAccess
                              ? "Profil administrat. Poți solicita acces."
                              : "Disponibilă pentru revendicare"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            navigate("/adauga-sau-revendica", {
                              state: { selectedLocation: loc },
                            })
                          }
                          className="min-h-11 shrink-0 px-3.5 py-2 rounded-full text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                        >
                          {requestsAccess ? "Solicită acces" : "Revendică această locație"}
                        </button>
                      </div>
                    );
                  })}

                  {searchError && <p role="alert" className="text-sm text-muted-foreground">Căutarea nu este disponibilă momentan. Apasă „Caută” pentru a reîncerca.</p>}
                  {!loading && !searchError && results.length === 0 && organizations.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nicio locație găsită.</p>
                  )}
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPinPlus className="w-4 h-4 shrink-0" />
                  Nu găsești locația?
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/adauga-sau-revendica", {
                      state: { startFlow: "new_location" },
                    })
                  }
                  className="px-5 py-2.5 rounded-full border border-border bg-card text-sm font-medium hover:border-foreground/40 transition-colors"
                >
                  Adaugă o locație nouă
                </button>
              </div>
              <p className="mt-2 text-[13px] text-[#657087] text-left">
                Publicarea se face după verificare.
              </p>
            </div>
          ) : (
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Profil profesional VIASEE
              </p>
              <h2 className="mt-2 font-heading text-xl font-bold">Un profil, oriunde lucrezi</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Creează-ți profilul și asociază-l cu locațiile unde lucrezi, după verificare.
              </p>
              <button
                type="button"
                onClick={() => navigate("/profil-profesional/nou")}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
              >
                Continuă cu profilul tău
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-[13px] leading-relaxed text-[#657087]">
                Ai deja un profil? Îl regăsești după autentificare.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

