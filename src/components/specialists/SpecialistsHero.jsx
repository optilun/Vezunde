import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Loader2,
  MapPin,
  MapPinPlus,
  Search,
  Stethoscope,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import SpecialistsPresenceArtwork from "./SpecialistsPresenceArtwork";

const AUDIENCE_OPTIONS = [
  {
    id: "organization",
    icon: Building2,
    title: "Reprezint o organizație",
    description: "Optică medicală, clinică, cabinet sau altă locație de servicii pentru vedere.",
  },
  {
    id: "professional",
    icon: Stethoscope,
    title: "Sunt specialist",
    description: "Medic oftalmolog, optometrist sau optician, independent sau asociat unei locații.",
  },
];

export default function SpecialistsHero() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState("organization");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
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

    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions
        .invoke("getClaimableProviderLocations", { q })
        .catch(() => ({ data: {} }));

      if (reqId !== reqRef.current) return;
      setLoading(false);
      setResults(res.data?.locations || []);
    }, 300);

    return () => clearTimeout(t);
  }, [audience, query]);

  const searched = audience === "organization" && query.trim().length >= 2;

  return (
    <section id="incepe" className="relative mx-auto grid max-w-7xl scroll-mt-24 items-start gap-10 px-4 pb-12 pt-8 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-16">
      <div className="order-last hidden lg:sticky lg:top-28 lg:mt-14 lg:block">
        <SpecialistsPresenceArtwork professional={audience === "professional"} />
      </div>

      <div className="relative z-10 min-w-0 text-left">
        <p className="mb-4 flex items-center gap-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#684d78] sm:text-xs"><span aria-hidden="true" className="h-2 w-2 bg-[#684d78]" /> VIASEE pentru specialiști</p>
        <h1 className="font-heading text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.04] tracking-[-0.045em]">
          <span className="block">Locul tău pe</span><span className="block text-[#684d78]">VIASEE.</span>
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#665f69] sm:text-base">
          Clinici, optici și profesioniști în îngrijirea vederii. Revendică un profil existent sau creează unul nou.
        </p>

        <div role="group" aria-label="Alege tipul profilului" className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-3">
          {AUDIENCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = audience === option.id;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAudience(option.id)}
                className={`min-w-0 rounded-2xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#684d78] sm:p-4 ${
                  selected
                    ? "border-[#684d78] bg-[#ede5f1] shadow-[inset_0_0_0_1px_#684d78]"
                    : "border-[#d9d2dc] bg-white/75 hover:border-[#684d78]/60"
                }`}
              >
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selected ? "bg-[#684d78] text-white" : "bg-[#f0ece4] text-[#665f69]"
                  }`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="font-heading text-[13px] font-semibold leading-snug sm:text-sm">{option.title}</span>
                </div>
                <p className="mt-3 hidden text-xs leading-relaxed text-[#665f69] sm:block">{option.description}</p>
              </button>
            );
          })}
        </div>

        {audience === "organization" ? (
          <div className="mt-3 rounded-2xl border border-[#d9d2dc] bg-[#fffdf9] p-4 shadow-[0_8px_30px_rgba(44,32,54,0.04)] sm:p-6">
            <div className="mb-3 text-left">
              <h2 className="font-heading text-base font-bold">Găsește profilul locației</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Caută numele sau adresa. Dacă profilul există, îl poți revendica sau solicita acces.
              </p>
            </div>

            <div className="relative flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  aria-label="Nume, localitate sau adresă"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nume, localitate sau adresă"
                  className="h-12 w-full rounded-xl border border-[#d9d2dc] bg-white pl-10 pr-8 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[#684d78]/30"
                />
                {loading && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("hero-search-results")
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
                className="h-12 shrink-0 rounded-xl bg-[#211c25] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:px-6"
              >
                Caută
              </button>
            </div>

            {searched && (
              <div id="hero-search-results" className="mt-4 space-y-2.5 text-left">
                {results.map((loc) => {
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
                        className="min-h-11 shrink-0 rounded-full bg-[#684d78] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        {requestsAccess ? "Solicită acces" : "Revendică această locație"}
                      </button>
                    </div>
                  );
                })}

                {!loading && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nicio locație găsită.</p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e5dfe8] pt-3">
              <span className="flex items-center gap-1.5 text-xs text-[#665f69]">
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
                className="min-h-11 rounded-full px-2 text-xs font-semibold text-[#684d78] underline decoration-[#684d78]/35 underline-offset-4 hover:decoration-[#684d78]"
              >
                Adaugă o locație nouă
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              O locație nouă este analizată înainte de publicare.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-[#d9d2dc] bg-[#fffdf9] p-4 text-left shadow-[0_8px_30px_rgba(44,32,54,0.04)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Profil profesional VIASEE
            </p>
            <h2 className="mt-2 font-heading text-xl font-bold">Un profil. Toate locurile unde lucrezi.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Creezi profilul tău de oftalmolog, optometrist sau optician. După verificare, îl asociezi cu locațiile unde lucrezi.
            </p>
            <button
              type="button"
              onClick={() => navigate("/profil-profesional/nou")}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-[#684d78] px-4 py-2 text-left text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Creează sau administrează profilul
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Dacă ai deja un profil asociat contului tău, vei fi direcționat automat către el după autentificare.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
