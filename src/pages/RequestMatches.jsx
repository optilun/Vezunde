import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import MatchResults from "@/components/intake2/MatchResults";
import LocationThumb, { typeVisual } from "@/components/results/LocationThumb";
import TrustBadge from "@/components/results/TrustBadge";
import { clearPatientIntakeSession } from "@/lib/patientIntakeSession";

// Panou de detalii, populat cand pacientul apasa pe un card din lista.
// Ramane doar o previzualizare compacta - profilul complet e o pagina separata,
// la care se ajunge explicit prin "Vezi profilul complet".
function DetailPanel({ location }) {
  if (!location) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-secondary/20 p-6 text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Apasă pe o locație din listă ca să vezi detaliile aici.
        </p>
      </div>
    );
  }

  const visual = typeVisual(location.provider_type);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start gap-3.5">
        <LocationThumb name={location.name} photoUrl={location.photo_url} providerType={location.provider_type} size="md" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{visual.label}</div>
          <h2 className="mt-1 font-display text-lg font-bold leading-tight text-foreground">{location.name}</h2>
        </div>
      </div>

      {location.profile_control_status && (
        <div className="mt-3">
          <TrustBadge status={location.profile_control_status} />
        </div>
      )}

      <div className="mt-4 space-y-2.5 text-sm text-foreground/85">
        {location.address && (
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
        <div className="mt-4 flex flex-wrap gap-1.5">
          {location.public_services.slice(0, 6).map((service) => (
            <span key={service.key || service.label} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground/75">
              {service.label || service.key}
            </span>
          ))}
        </div>
      )}

      {location.routing_reason && (
        <p className="mt-4 rounded-2xl bg-secondary/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {location.routing_reason}
        </p>
      )}

      <Link
        to={`/furnizor/${location.id}`}
        className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Inapoi
      </button>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
        <div className="min-w-0">
          <MatchResults
            results={results}
            meta={meta}
            onRequestCreated={() => clearPatientIntakeSession()}
            onSelectLocation={setSelectedLocation}
            selectedLocationId={selectedLocation?.id || null}
          />
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <DetailPanel location={selectedLocation} />
        </aside>
      </div>
    </div>
  );
}
