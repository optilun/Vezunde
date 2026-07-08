import React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";

export default function ProviderLocations({ workspace, selectedLocationId, onSelect }) {
  const locById = Object.fromEntries((workspace.locations || []).map((l) => [l.id, l]));
  const selectedLocation = locById[selectedLocationId] || null;
  const mapUrl = selectedLocation ? buildGoogleMapsUrl(selectedLocation) : "";
  const embedUrl = selectedLocation ? buildGoogleMapsEmbedUrl(selectedLocation) : "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Aici vezi locatia administrata si cum apare adresa pe harta. Modificarile de adresa se fac prin review, pentru siguranta profilului.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {(workspace.memberships || []).map((m) => {
            const loc = locById[m.location_id];
            if (!loc) return null;
            const active = m.location_id === selectedLocationId;
            return (
              <div key={m.location_id} className={`rounded-xl border p-4 bg-card ${active ? "border-foreground" : "border-border"}`}>
                <div className="font-semibold text-sm">{loc.public_display_name || loc.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{loc.locality_name || loc.city} · {PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status}</div>
                {loc.address && <div className="text-xs text-muted-foreground mt-1">{loc.address}</div>}
                <div className="text-xs text-muted-foreground mt-1">Completitudine: {m.profile_completeness}%</div>
                {active ? (
                  <span className="mt-3 inline-block text-xs font-semibold text-foreground">Locatie selectata</span>
                ) : (
                  <button onClick={() => onSelect(m.location_id)} className="mt-3 text-xs font-semibold underline underline-offset-4">Selecteaza</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">Harta locatiei</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Harta este generata din adresa publicata. Pentru precizie mai buna, putem adauga ulterior coordonate exacte sau Place ID.
              </p>
            </div>
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4 shrink-0">
                Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {selectedLocation && hasMapLocation(selectedLocation) && embedUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-secondary h-72">
              <iframe
                title={`Harta ${selectedLocation.public_display_name || selectedLocation.name}`}
                src={embedUrl}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/50 p-6 text-center">
              <MapPin className="w-6 h-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Harta nu poate fi afisata inca</p>
              <p className="mt-1 text-xs text-muted-foreground">Adauga adresa locatiei ca sa putem genera linkul de harta.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}