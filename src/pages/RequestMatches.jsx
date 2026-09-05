import React, { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Clock, Map as MapIcon, MapPin, Phone, X } from "lucide-react";
import MatchResults from "@/components/intake2/MatchResults";
import { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import LocationThumb, { typeVisual } from "@/components/results/LocationThumb";
import ResultsMap from "@/components/results/ResultsMap";
import TrustBadge from "@/components/results/TrustBadge";
import { clearPatientIntakeSession } from "@/lib/patientIntakeSession";

// Ecranul de recomandari.
//
// 2026-09-04. Pana acum coloana din dreapta era goala pana cand pacientul apasa un card, iar
// cardurile erau atat de inalte incat se vedea cate una pe ecran. Doua probleme diferite cu
// aceeasi cauza: ecranul nu ajuta la COMPARAT. Acum lista e compacta, iar coloana din dreapta
// tine o harta cu optiunile care au pozitie publica, cu selectie sincronizata in ambele sensuri.
//
// Ce trebuie stiut despre harta: nu toate rezultatele ajung pe ea. Coordonatele sunt expuse
// public doar pentru profilurile revendicate sau verificate; pentru cele din director politica de
// vizibilitate le taie deliberat. Nu geocodam adresa ca sa "reparam" lipsa - ar insemna sa
// afirmam o pozitie pe care VIASEE nu o detine. Cate lipsesc se scrie sub harta, nu se ascunde.

function DetailPanel({ location, onClose }) {
  const visual = typeVisual(location.provider_type);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <LocationThumb name={location.name} photoUrl={location.photo_url} providerType={location.provider_type} size="sm" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{visual.label}</div>
            <h2 className="mt-1 font-display text-base font-bold leading-tight text-foreground">{location.name}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide detaliile"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {location.profile_control_status && (
        <div className="mt-3">
          <TrustBadge status={location.profile_control_status} />
        </div>
      )}

      <div className="mt-3.5 space-y-2 text-sm text-foreground/85">
        {(location.address || location.city) && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{location.address || location.city}</span>
          </p>
        )}
        {location.opening_hours && (
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{location.opening_hours}</span>
          </p>
        )}
        {location.phone && (
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${location.phone.replace(/\s/g, "")}`} className="underline underline-offset-2">
              {location.phone}
            </a>
          </p>
        )}
      </div>

      {Array.isArray(location.public_services) && location.public_services.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {location.public_services.slice(0, 6).map((service) => (
            <span key={service.key || service.label} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground/75">
              {service.label || service.key}
            </span>
          ))}
        </div>
      )}

      <Link
        to={`/furnizor/${location.id}`}
        className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Vezi profilul complet <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function RequestMatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results, meta } = location.state || {};
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [visibleResults, setVisibleResults] = useState(Array.isArray(results) ? results : []);
  const [resultMode, setResultMode] = useState(RESULT_MODES.locations.key);
  const [mapOpenOnMobile, setMapOpenOnMobile] = useState(false);

  // Selectia dinspre harta primeste un id, cea dinspre lista primeste locatia intreaga.
  // Le aducem la acelasi numitor aici, ca ambele sensuri sa duca in aceeasi stare.
  const selectById = useCallback((id) => {
    const found = visibleResults.find((item) => item.id === id) || null;
    if (found) setSelectedLocation(found);
  }, [visibleResults]);

  const mapResults = useMemo(() => visibleResults, [visibleResults]);
  const isProfessionalMode = resultMode === RESULT_MODES.professionals.key;

  if (!Array.isArray(results)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Nu am gasit rezultate de afisat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este posibil sa fi ajuns direct pe aceasta pagina, fara sa treci prin cautare.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Inapoi la cautare
        </Link>
      </div>
    );
  }

  const mapPanel = (
    <>
      {/* In modul "Specialiști" lista din stanga arata persoane, iar harta ramane pe locatii.
          Nu o golim: locatiile sunt exact locurile unde ajunge pacientul. Dar spunem ce arata,
          ca sa nu para ca pinii sunt specialistii. */}
      {isProfessionalMode && (
        <p className="mb-2 px-1 text-xs leading-relaxed text-muted-foreground">
          Harta arată clinicile și opticile găsite pentru cererea ta, nu specialiștii.
        </p>
      )}
      <ResultsMap
        results={mapResults}
        selectedId={selectedLocation?.id || null}
        onSelect={selectById}
      />
      {selectedLocation && (
        <div className="mt-3">
          <DetailPanel location={selectedLocation} onClose={() => setSelectedLocation(null)} />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inapoi
      </button>

      {/* Pe telefon harta nu poate sta langa lista, iar deasupra ei ar impinge rezultatele sub
          linia de plutire. Ramane la un buton distanta, inchisa implicit. */}
      <div className="mt-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMapOpenOnMobile((value) => !value)}
          aria-expanded={mapOpenOnMobile}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-foreground/40"
        >
          <MapIcon className="h-4 w-4" />
          {mapOpenOnMobile ? "Ascunde harta" : "Vezi pe hartă"}
        </button>
        {mapOpenOnMobile && <div className="mt-3">{mapPanel}</div>}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)] lg:items-start">
        <div className="min-w-0">
          <MatchResults
            results={results}
            meta={meta}
            compact
            onRequestCreated={() => clearPatientIntakeSession()}
            onSelectLocation={setSelectedLocation}
            selectedLocationId={selectedLocation?.id || null}
            onVisibleResultsChange={setVisibleResults}
            onResultModeChange={setResultMode}
          />
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {mapPanel}
        </aside>
      </div>
    </div>
  );
}
