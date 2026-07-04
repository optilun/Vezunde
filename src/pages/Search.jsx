import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SERVICES, PROVIDER_TYPES } from "@/lib/vezunde";
import ProviderCard from "@/components/ProviderCard";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const SELECT = "bg-card border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors";

export default function Search() {
  const urlParams = new URLSearchParams(window.location.search);
  const [results, setResults] = useState(null);
  const [service, setService] = useState(urlParams.get("serviciu") || "");
  const [type, setType] = useState("");
  // Module 3F.2: canonical locality selection — no dependency on provider data for city choices.
  const [locality, setLocality] = useState(urlParams.get("oras") ? { name: urlParams.get("oras"), display_label: urlParams.get("oras") } : null);

  useEffect(() => {
    setResults(null);
    base44.functions.invoke("matchProviders", {
      service_keys: service ? [service] : [],
      provider_types: type ? [type] : [],
      city: locality?.name || "",
      locality_siruta_code: locality?.siruta_code || "",
      scope: locality ? "city" : "national",
      limit: 50,
    }).then((res) => {
      setResults(res.data.results || []);
    });
  }, [service, type, locality]);

  return (
    <div className="max-w-6xl mx-auto px-5 pt-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Cauta furnizori</h1>
      <p className="mt-2 text-sm text-muted-foreground">Rezultatele sunt ordonate dupa relevanta pentru nevoia ta — niciodata dupa marimea companiei sau pret.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <select value={service} onChange={(e) => setService(e.target.value)} className={SELECT}>
          <option value="">Toate serviciile</option>
          {Object.entries(SERVICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
          <option value="">Toate tipurile</option>
          {Object.entries(PROVIDER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <LocalityAutocomplete value={locality} onSelect={setLocality} placeholder="Toata Romania — cauta o localitate" className="w-64" />
      </div>
      <div className="mt-8 grid sm:grid-cols-2 gap-4 pb-8">
        {results === null && <p className="text-sm text-muted-foreground">Se incarca...</p>}
        {results?.length === 0 && (
          <div className="sm:col-span-2 bg-card border border-border rounded-2xl p-10 text-center">
            {locality ? (
              <>
                <p className="font-heading font-bold">Nu avem inca profiluri relevante in aceasta localitate.</p>
                <p className="mt-2 text-sm text-muted-foreground">Poti extinde cautarea in judet sau poti verifica din nou mai tarziu.</p>
              </>
            ) : (
              <>
                <p className="font-heading font-bold">Nu am gasit profiluri care sa corespunda cautarii tale.</p>
                <p className="mt-2 text-sm text-muted-foreground">Incearca o alta localitate sau o formulare mai generala.</p>
              </>
            )}
            <Link to="/cerere" className="mt-5 inline-block bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity">Trimite o cerere</Link>
          </div>
        )}
        {results?.map((loc) => (
          <ProviderCard key={loc.id} location={loc} />
        ))}
      </div>
      <p className="pb-10 text-xs text-muted-foreground">Vezunde nu ofera diagnostic medical.</p>
    </div>
  );
}