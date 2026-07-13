import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Loader2, MapPinPlus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function SpecialistsHero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showProfessionalNotice, setShowProfessionalNotice] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions.invoke("getClaimableProviderLocations", { q }).catch(() => ({ data: {} }));
      if (reqId !== reqRef.current) return;
      setLoading(false);
      setResults(res.data?.locations || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const searched = query.trim().length >= 2;

  return (
    <>
      <section className="max-w-6xl mx-auto px-5 pt-10 sm:pt-16 pb-16 sm:pb-24 grid lg:grid-cols-[46%_54%] gap-10 lg:gap-6 items-center relative">
        <img
          src="https://media.base44.com/images/public/6a48cb9d04fa7f999d8a8054/8bc17e08f_generated_image.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none order-first lg:order-last w-full max-w-md mx-auto lg:max-w-none lg:absolute lg:right-[-4%] lg:top-1/2 lg:-translate-y-1/2 lg:w-[64%] opacity-90"
          style={{
            maskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
            WebkitMaskImage: "radial-gradient(ellipse 68% 68% at 45% 50%, black 55%, transparent 96%)",
          }}
        />

        <div className="relative z-10 text-center lg:text-left">
          <h1 className="font-heading font-extrabold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-5xl">Administreaza cum apari pe VIASEE.</h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Revendica sau adauga o locatie. Daca lucrezi independent ca medic oftalmolog sau optometrist, iti poti crea un profil profesional.
          </p>

          <div className="mt-7 max-w-xl mx-auto lg:mx-0">
            <div className="relative flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cauta dupa nume, localitate sau adresa"
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-[#EEF2F3] transition-shadow"
                />
                {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <button
                type="button"
                onClick={() => document.getElementById("hero-search-results")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                className="h-12 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
              >
                Cauta
              </button>
            </div>

            {searched && (
              <div id="hero-search-results" className="mt-4 space-y-2.5 text-left">
                {results.map((loc) => (
                  <div key={loc.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[loc.provider_type] || loc.provider_type}</div>
                      <div className="font-heading font-bold text-sm">{loc.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {loc.city}{loc.address ? `, ${loc.address}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Disponibila pentru revendicare</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/adauga-sau-revendica", { state: { selectedLocation: loc } })}
                      className="shrink-0 px-3.5 py-2 rounded-full text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                    >
                      Revendica aceasta locatie
                    </button>
                  </div>
                ))}
                {!loading && results.length === 0 && <p className="text-sm text-muted-foreground">Nicio locatie gasita.</p>}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center sm:justify-start">
                <MapPinPlus className="w-4 h-4 shrink-0" /> Nu gasesti locatia?
              </span>
              <button
                type="button"
                onClick={() => navigate("/adauga-sau-revendica", { state: { startFlow: "new_location" } })}
                className="px-5 py-2.5 rounded-full border border-border bg-card text-sm font-medium hover:border-foreground/40 transition-colors"
              >
                Adauga o locatie noua
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center sm:text-left">Noua locatie este analizata inainte de publicare.</p>

            <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-xs text-muted-foreground text-center sm:text-left">Lucrezi independent ca medic oftalmolog sau optometrist?</span>
              <button
                type="button"
                onClick={() => setShowProfessionalNotice(true)}
                className="text-xs font-medium text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
              >
                Creeaza profil profesional →
              </button>
            </div>
          </div>
        </div>
      </section>

      {showProfessionalNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="professional-notice-title">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <button type="button" onClick={() => setShowProfessionalNotice(false)} className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Inchide">
              <X className="h-4 w-4" />
            </button>
            <h2 id="professional-notice-title" className="pr-8 font-heading text-xl font-bold">Profilurile profesionale sunt in pregatire</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Fluxul dedicat medicilor oftalmologi, optometristilor si opticienilor va fi separat de inscrierea organizatiilor. Nu te trimitem intr-un formular de locatie care nu se potriveste profilului tau.
            </p>
            <button type="button" onClick={() => setShowProfessionalNotice(false)} className="mt-5 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background">
              Am inteles
            </button>
          </div>
        </div>
      )}
    </>
  );
}
