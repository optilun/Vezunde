import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin } from "lucide-react";

const EXAMPLES = [
  { type: "Cabinet optometric", name: "Optica Vision", place: "Cluj-Napoca, Str. Memorandumului nr. 12" },
  { type: "Clinica oftalmologica", name: "Clinica Oftalmologica Nova", place: "Timisoara, Bd. Take Ionescu nr. 5" },
];

// Illustrative search module — submitting hands off to the real claim flow
// (/adauga-sau-revendica) which performs the actual location lookup.
export default function LocationSearchModule() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/adauga-sau-revendica");
  };

  return (
    <section id="cauta-locatia" className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      <div className="bg-card border border-border rounded-[2rem] p-6 sm:p-10 shadow-[0_18px_55px_rgba(20,20,20,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            Gaseste locatia pe care vrei sa o administrezi
          </h2>
          <span className="text-xs text-muted-foreground shrink-0">Dupa nume, localitate sau adresa</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cauta dupa nume, localitate sau adresa"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-[#EEF2F3] transition-shadow"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            Cauta
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Exemple: Optica Vision, Cluj-Napoca sau Clinica Oftalmologica Nova, Timisoara
        </p>

        {/* Illustrative result card anatomy — factual fields only, not real results */}
        <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">Exemplu de rezultat</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {EXAMPLES.map((ex) => (
            <div key={ex.name} className="bg-background border border-border rounded-2xl p-5">
              <div className="text-xs font-medium text-muted-foreground">{ex.type}</div>
              <h3 className="mt-1 font-heading font-bold text-base tracking-tight">{ex.name}</h3>
              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {ex.place}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Disponibila pentru revendicare</div>
              <button
                type="button"
                onClick={() => navigate("/adauga-sau-revendica")}
                className="mt-3 px-4 py-2 rounded-full text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                Revendica aceasta locatie
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}