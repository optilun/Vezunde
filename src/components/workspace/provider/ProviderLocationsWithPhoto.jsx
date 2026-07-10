import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Image, X } from "lucide-react";
import ProviderLocations from "./ProviderLocations";
import ProviderLocationPhotoCompact from "./ProviderLocationPhotoCompact";

export default function ProviderLocationsWithPhoto(props) {
  const { workspace, selectedLocationId, onSelect, onRefresh } = props;
  const containerRef = useRef(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const selectedLocation = (workspace.locations || []).find((location) => location.id === selectedLocationId) || (workspace.locations || [])[0] || null;
  const selectedLocationName = selectedLocation?.public_display_name || selectedLocation?.name || "Locație";

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const findTarget = () => {
      const sections = Array.from(root.querySelectorAll("section"));
      const configureSection = sections.find((section) => section.textContent?.includes("Configurează locația"));
      const grid = configureSection?.querySelector(".grid.gap-3");
      if (grid) {
        grid.classList.remove("md:grid-cols-3");
        grid.classList.add("md:grid-cols-2", "xl:grid-cols-4", "vezunde-location-modules");
        setPortalTarget(grid);
      }
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selectedLocationId]);

  return (
    <div ref={containerRef}>
      <style>{`
        .vezunde-location-modules > button {
          height: 100%;
        }
        .vezunde-location-modules > button > div {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
        }
        .vezunde-location-modules > button > div > div:first-child {
          align-self: start;
          margin-top: 0;
        }
        .vezunde-location-modules > button > div > div:last-child {
          min-width: 0;
        }
        .vezunde-location-modules > button > div > div:last-child > div:first-child {
          min-height: 40px;
          align-items: center;
        }
      `}</style>

      <ProviderLocations {...props} />

      {portalTarget && selectedLocation && createPortal(
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="h-full rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm"
        >
          <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-2xl bg-secondary">
              <Image className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex min-h-10 items-center justify-between gap-2">
                <div className="text-sm font-bold">Fotografie</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Adaugă fotografia principală a acestei locații.</p>
              <div className="mt-3 text-xs font-bold underline underline-offset-4">Configurează</div>
            </div>
          </div>
        </button>,
        portalTarget,
      )}

      {photoOpen && selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-2xl">
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
              <ProviderLocationPhotoCompact locationId={selectedLocation.id} onRefresh={onRefresh} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
