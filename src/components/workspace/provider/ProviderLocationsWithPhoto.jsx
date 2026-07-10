import React, { useState } from "react";
import { ArrowRight, Image, X } from "lucide-react";
import ProviderLocations from "./ProviderLocations";
import ProviderLocationPhotos from "./ProviderLocationPhotos";

export default function ProviderLocationsWithPhoto(props) {
  const { workspace, selectedLocationId, onSelect, onRefresh } = props;
  const [photoOpen, setPhotoOpen] = useState(false);
  const selectedLocation = (workspace.locations || []).find((location) => location.id === selectedLocationId) || (workspace.locations || [])[0] || null;
  const selectedLocationName = selectedLocation?.public_display_name || selectedLocation?.name || "Locație";

  return (
    <div className="space-y-5">
      <ProviderLocations {...props} />

      {selectedLocation && (
        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                <Image className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold">Fotografie</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Adaugă fotografia principală a acestei locații. Fotografia apare public numai după verificare.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Configurează <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {photoOpen && selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{selectedLocationName}</div>
                <h2 className="font-heading text-xl font-extrabold tracking-tight">Fotografia locației</h2>
              </div>
              <button
                type="button"
                onClick={() => setPhotoOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary"
                aria-label="Închide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <ProviderLocationPhotos
                workspace={workspace}
                selectedLocationId={selectedLocation.id}
                onSelectLocation={onSelect}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
