import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin } from "lucide-react";

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
    <section id="cauta-locatia" className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-center">
        Gaseste locatia pe care vrei sa o administrezi
      </h2>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cauta dupa nume, localitate sau adresa"
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-[#EEF2F3] transition-shadow"
          />
        </div>
        <button
          type="submit"
          className="h-12 px-6 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          Cauta
        </button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground text-center">
        Exemple: Optica Vision, Cluj-Napoca sau Clinica Oftalmologica Nova, Timisoara
      </p>

      {/* Illustrative result card anatomy — factual fields only */}
      <div className="mt-8 bg-card border border-border rounded-2xl p-5">
        <div className="text-xs font-medium text-muted-foreground">Cabinet optometric</div>
        <h3 className="mt-1 font-heading font-bold text-lg tracking-tight">Optica Vision</h3>
        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" /> Cluj-Napoca, Str. Memorandumului nr. 12
        </div>
        <div className="mt-3 text-xs text-muted-foreground">Disponibila pentru revendicare</div>
        <button
          type="button"
          onClick={() => navigate("/adauga-sau-revendica")}
          className="mt-4 px-4 py-2 rounded-full text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          Revendica aceasta locatie
        </button>
      </div>
    </section>
  );
}