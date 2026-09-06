import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Search as SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ResultsMap from "@/components/results/ResultsMap";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// Directorul pe harta Romaniei.
//
// 2026-09-06. Pana acum, ca sa vezi ceva pe harta trebuia sa stii deja unde cauti: scriai
// localitatea, si abia apoi apareau punctele. Pagina asta inverseaza ordinea - pornesti de la
// tara intreaga si cobori cu zoom-ul pana unde te intereseaza. Este singurul ecran din care se
// vede acoperirea reala a directorului.
//
// Ce NU este: o cautare. Nu scoreaza, nu ordoneaza dupa relevanta, nu are Top 3 si nu trimite
// cereri. Cine vrea o recomandare merge prin `/cerere`, unde intrebarile si potrivirea sunt
// facute pentru asta. De aici pacientul intra pe un profil.
//
// Filtrarea dupa tip se face in browser, pe punctele deja primite: sunt sub o mie, iar o
// re-interogare la fiecare bifa ar fi mai lenta decat filtrarea locala.

export default function DirectoryMap() {
  const [state, setState] = useState({ status: "loading", points: [], meta: null, error: "" });
  const [type, setType] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", points: [], meta: null, error: "" });
    base44.functions
      .invoke("browseDirectoryProviders", { map_scope: "national" })
      .then((response) => {
        if (!active) return;
        if (response.data?.error) throw new Error(response.data.error);
        setState({
          status: "ready",
          points: Array.isArray(response.data?.results) ? response.data.results : [],
          meta: {
            total: Number(response.data?.total_published) || 0,
            withoutPosition: Number(response.data?.without_position) || 0,
          },
          error: "",
        });
      })
      .catch((reason) => {
        if (!active) return;
        setState({
          status: "error",
          points: [],
          meta: null,
          error: reason?.message || "Harta directorului nu a putut fi încărcată.",
        });
      });
    return () => { active = false; };
  }, [retry]);

  const visiblePoints = useMemo(
    () => (type ? state.points.filter((point) => point.provider_type === type) : state.points),
    [state.points, type],
  );

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col lg:h-[calc(100svh-5rem)]">
      <div className="shrink-0 border-b border-border bg-background px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
              Directorul pe hartă
            </h1>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {state.status === "ready"
                ? `${visiblePoints.length} ${visiblePoints.length === 1 ? "locație" : "locații"} pe hartă${
                    state.meta?.withoutPosition
                      ? `, ${state.meta.withoutPosition} fără poziție publicată`
                      : ""
                  }`
                : state.status === "error" ? "Directorul nu a putut fi încărcat." : "Se încarcă locațiile publicate..."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={type}
              onChange={(event) => { setType(event.target.value); setSelectedId(null); }}
              aria-label="Filtrează după tipul locației"
              className="min-h-10 rounded-full border border-border bg-card px-4 text-xs font-semibold outline-none"
            >
              <option value="">Toate tipurile</option>
              {Object.entries(PROVIDER_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Link
              to="/cerere"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
            >
              <SearchIcon className="h-3.5 w-3.5" /> Găsește opțiuni potrivite
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă directorul...
          </div>
        )}

        {state.status === "error" && (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p role="alert" className="text-sm text-muted-foreground">{state.error}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)}
                className="mt-4 min-h-11 rounded-full border border-border bg-card px-5 text-sm font-semibold">
                Reîncearcă
              </button>
            </div>
          </div>
        )}

        {state.status === "ready" && visiblePoints.length === 0 && (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <MapPin className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Nicio locație de acest tip pe hartă
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Schimbă tipul selectat sau caută direct într-o localitate.
              </p>
            </div>
          </div>
        )}

        {state.status === "ready" && visiblePoints.length > 0 && (
          <ResultsMap
            results={visiblePoints}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
