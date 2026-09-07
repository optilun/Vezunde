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

const AUDIENCE_OPTIONS = [
  {
    id: "organization",
    icon: Building2,
    title: "Reprezint o organizatie",
    description: "Optica medicala, clinica, cabinet sau alta locatie de servicii pentru vedere.",
  },
  {
    id: "professional",
    icon: Stethoscope,
    title: "Sunt specialist",
    description: "Medic oftalmolog, optometrist sau optician, independent sau asociat unei locatii.",
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
    <section className="max-w-6xl mx-auto px-5 pt-10 sm:pt-16 pb-14 sm:pb-20 grid lg:grid-cols-[52%_48%] gap-10 lg:gap-8 items-center relative">
      <img
        src="https://media.base44.com/images/public/6a48cb9d04fa7f999d8a8054/8bc17e08f_generated_image.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none order-first lg:order-last w-full max-w-md mx-auto lg:max-w-none lg:absolute lg:right-[-4%] lg:top-1/2 lg:-translate-y-1/2 lg:w-[56%] opacity-90"
        style={{
          maskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
          WebkitMaskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
        }}
      />

      <div className="relative z-10 text-center lg:text-left">
        <h1 className="font-heading font-extrabold tracking-[-0.03em] leading-[1.08] text-3xl sm:text-5xl">
          Administreaza prezenta ta pe VIASEE.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
          Revendica un profil existent sau creeaza unul nou pentru organizatia, locatia sau activitatea ta profesionala.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {AUDIENCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = audience === option.id;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAudience(option.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-foreground bg-foreground/[0.04]"
                    : "border-border bg-card hover:border-foreground/35"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selected ? "bg-foreground text-background" : "bg-secondary text-foreground"
                  }`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="font-heading text-sm font-bold">{option.title}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>

        {audience === "organization" ? (
          <div className="mt-6 max-w-2xl mx-auto lg:mx-0">
            <div className="mb-3 text-left">
              <h2 className="font-heading text-base font-bold">Gaseste organizatia sau locatia</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cauta mai intai profilul existent. Asa evitam duplicatele si pastram istoricul locatiei.
              </p>
            </div>

            <div className="relative flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nume, localitate sau adresa"
                  className="w-full h-12 pl-11 pr-10 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-[#EEF2F3] transition-shadow"
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
                className="h-12 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
              >
                Cauta
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
                            ? "Profil administrat. Poti solicita acces."
                            : "Disponibila pentru revendicare"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate("/adauga-sau-revendica", {
                            state: { selectedLocation: loc },
                          })
                        }
                        className="shrink-0 px-3.5 py-2 rounded-full text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                      >
                        {requestsAccess ? "Solicita acces" : "Revendica aceasta locatie"}
                      </button>
                    </div>
                  );
                })}

                {!loading && results.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nicio locatie gasita.</p>
                )}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center sm:justify-start">
                <MapPinPlus className="w-4 h-4 shrink-0" />
                Nu gasesti locatia?
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
                Adauga o locatie noua
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center sm:text-left">
              O locatie noua este analizata inainte de publicare.
            </p>
          </div>
        ) : (
          <div className="mt-6 max-w-2xl mx-auto lg:mx-0 rounded-2xl border border-border bg-card p-5 sm:p-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Profil profesional VIASEE
            </p>
            <h2 className="mt-2 font-heading text-xl font-bold">Profilul tau ramane separat de orice organizatie</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Creezi un singur profil profesional. Dupa verificare, il poti asocia cu una sau mai multe locatii unde lucrezi, fara sa creezi cate un profil pentru fiecare locatie.
            </p>
            <button
              type="button"
              onClick={() => navigate("/profil-profesional/nou")}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
            >
              Creeaza sau administreaza profilul
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Daca ai deja un profil asociat contului tau, vei fi directionat automat catre el dupa autentificare.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
