import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Image, X } from "lucide-react";
import ProviderLocations from "./ProviderLocations";
import ProviderLocationPhotoCompact from "./ProviderLocationPhotoCompact";
import ProviderAddLocationFlow from "./ProviderAddLocationFlow";

export default function ProviderLocationsWithPhoto(props) {
  const { workspace, selectedLocationId, onSelect, onRefresh } = props;
  const capabilities = new Set(workspace.current_user_capabilities || []);
  const canManagePhoto = capabilities.has("location.manage_content");
  const canAddLocation = capabilities.has("organization.manage_locations");
  const containerRef = useRef(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const selectedLocation =
    (workspace.locations || []).find(
      (location) => location.id === selectedLocationId,
    ) ||
    (workspace.locations || [])[0] ||
    null;
  const selectedLocationName =
    selectedLocation?.public_display_name || selectedLocation?.name || "Locatie";
  const organization =
    (workspace.organizations || []).find(
      (item) => item.id === selectedLocation?.organization_id,
    ) ||
    workspace.organizations?.[0] ||
    null;
  const organizationName =
    organization?.public_display_name ||
    organization?.name ||
    selectedLocation?.organization_name ||
    selectedLocationName;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const layoutCompactMap = () => {
      const editButton = Array.from(root.querySelectorAll("button")).find(
        (button) =>
          String(button.textContent || "").includes("Editeaza datele"),
      );
      const summarySection = editButton?.closest("section");
      if (!summarySection) return;

      summarySection.classList.add("vezunde-location-summary");
      summarySection.firstElementChild?.classList.add(
        "vezunde-location-summary-header",
      );

      const detailGrid = Array.from(summarySection.children).find((element) => {
        const text = String(element.textContent || "");
        return (
          element.classList.contains("grid") &&
          text.includes("Adresa") &&
          text.includes("Telefon") &&
          text.includes("Email public")
        );
      });
      detailGrid?.classList.add("vezunde-location-summary-details");

      const mapToggle = Array.from(
        summarySection.querySelectorAll("button"),
      ).find((button) => {
        const text = String(button.textContent || "");
        return text.includes("Vezi pe harta") || text.includes("Ascunde harta");
      });

      if (mapToggle) {
        mapToggle.classList.add("vezunde-location-map-toggle");
        mapToggle.parentElement?.classList.add(
          "vezunde-location-map-actions",
        );
        if (
          String(mapToggle.textContent || "").includes("Vezi pe harta") &&
          mapToggle.dataset.autoOpened !== "true"
        ) {
          mapToggle.dataset.autoOpened = "true";
          window.requestAnimationFrame(() => mapToggle.click());
        }
      }

      const mapFrame = summarySection.querySelector('iframe[title^="Harta "]');
      const mapPanel = mapFrame?.parentElement?.parentElement;
      mapPanel?.classList.add("vezunde-location-map");
    };

    const findTarget = () => {
      const sections = Array.from(root.querySelectorAll("section"));
      const configureSection = sections.find((section) => {
        const content = section.textContent || "";
        return (
          content.includes("Configureaza locatia") ||
          content.includes("Configureaza locatia")
        );
      });
      const grid = configureSection?.querySelector(".grid.gap-3");
      if (grid && canManagePhoto) {
        grid.classList.remove("md:grid-cols-3");
        grid.classList.add(
          "sm:grid-cols-2",
          "xl:grid-cols-4",
          "vezunde-location-modules",
        );
        setPortalTarget(grid);
      } else {
        grid?.classList.remove(
          "sm:grid-cols-2",
          "xl:grid-cols-4",
          "vezunde-location-modules",
        );
        if (grid) grid.classList.add("md:grid-cols-3");
        setPortalTarget(null);
      }

      layoutCompactMap();
    };

    const interceptAddLocation = (event) => {
      const link = event.target.closest('a[href="/adauga-sau-revendica"]');
      if (!canAddLocation || !link || !root.contains(link)) return;
      event.preventDefault();
      event.stopPropagation();
      setAddLocationOpen(true);
    };

    findTarget();
    root.addEventListener("click", interceptAddLocation, true);
    const observer = new MutationObserver(findTarget);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("click", interceptAddLocation, true);
      observer.disconnect();
    };
  }, [canAddLocation, canManagePhoto, selectedLocationId]);

  useEffect(() => {
    if (!canManagePhoto) setPhotoOpen(false);
    if (!canAddLocation) setAddLocationOpen(false);
  }, [canAddLocation, canManagePhoto]);

  useEffect(() => {
    if (!photoOpen && !addLocationOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setPhotoOpen(false);
      setAddLocationOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [photoOpen, addLocationOpen]);

  return (
    <div ref={containerRef} className="min-w-0">
      <style>{`
        .vezunde-location-modules { align-items: stretch; }
        .vezunde-location-modules > button { height: 100%; min-width: 0; }
        .vezunde-location-modules > button > div {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
          height: 100%;
        }
        .vezunde-location-modules > button > div > div:first-child { align-self: start; margin-top: 0; }
        .vezunde-location-modules > button > div > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .vezunde-location-modules > button > div > div:last-child > div:first-child { min-height: 40px; align-items: center; }
        .vezunde-location-modules > button > div > div:last-child > p { min-height: 64px; }
        .vezunde-location-modules > button > div > div:last-child > div:last-child { margin-top: auto; padding-top: 12px; }

        .vezunde-location-map-toggle { display: none !important; }
        .vezunde-location-map {
          margin-top: 1rem !important;
          overflow: hidden;
        }
        .vezunde-location-map > div { height: 190px !important; }

        @media (min-width: 1024px) {
          .vezunde-location-summary {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            column-gap: 2rem;
            align-items: start;
          }
          .vezunde-location-summary > * { grid-column: 1; }
          .vezunde-location-summary > .vezunde-location-summary-header {
            grid-column: 1 / -1;
          }
          .vezunde-location-summary > .vezunde-location-summary-details {
            margin-top: 1rem !important;
          }
          .vezunde-location-summary > .vezunde-location-map-actions {
            margin-top: 0.25rem !important;
          }
          .vezunde-location-summary > .vezunde-location-map {
            grid-column: 2;
            grid-row: 2 / span 4;
            width: 100%;
            margin-top: 1.25rem !important;
          }
          .vezunde-location-summary > .vezunde-location-map > div {
            height: 210px !important;
          }
        }

        @media (max-width: 639px) {
          .vezunde-location-modules > button > div > div:last-child > p { min-height: 0; }
          .vezunde-location-modules > button > div > div:last-child > div:first-child { min-height: 0; }
          .vezunde-location-map > div { height: 180px !important; }
        }
      `}</style>

      <ProviderLocations {...props} />

      {canManagePhoto &&
        portalTarget &&
        selectedLocation &&
        createPortal(
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="h-full min-h-28 rounded-[14px] border border-foreground/20 bg-background p-4 text-left transition-colors hover:border-foreground/45 hover:bg-white/45"
          >
            <div className="grid h-full grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full border border-foreground/10 bg-secondary/70">
                <Image className="h-4 w-4" />
              </div>
              <div className="flex h-full min-w-0 flex-col">
                <div className="flex min-h-10 items-center justify-between gap-2">
                  <div className="text-sm font-bold">Fotografie locatie</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1.5 min-h-16 text-sm leading-relaxed text-muted-foreground">
                  Adauga fotografia principala a acestei locatii.
                </p>
                <div className="mt-auto pt-3 text-sm font-bold underline underline-offset-4">
                  Configureaza
                </div>
              </div>
            </div>
          </button>,
          portalTarget,
        )}

      {canManagePhoto && photoOpen && selectedLocation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPhotoOpen(false);
          }}
        >
          <div
            className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-background shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[28px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="safe-area-top flex items-start justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-muted-foreground">
                  {selectedLocationName}
                </div>
                <h2 className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
                  Fotografia locatiei
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPhotoOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary"
                aria-label="Inchide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
              <ProviderLocationPhotoCompact locationId={selectedLocation.id} />
            </div>
          </div>
        </div>
      )}

      {canAddLocation && addLocationOpen && selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
          <div className="flex max-h-[98dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-background shadow-2xl sm:max-h-[94vh] sm:max-w-4xl sm:rounded-[28px]">
            <div className="safe-area-top flex items-start justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-muted-foreground">
                  {organizationName}
                </div>
                <h2 className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
                  Adauga o locatie noua
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAddLocationOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary"
                aria-label="Inchide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
              <ProviderAddLocationFlow
                anchorLocationId={selectedLocation.id}
                organizationName={organizationName}
                onClose={() => setAddLocationOpen(false)}
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
