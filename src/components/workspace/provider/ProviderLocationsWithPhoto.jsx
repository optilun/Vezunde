import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Image, X } from "lucide-react";
import ProviderLocations from "./ProviderLocations";
import ProviderLocationPhotoCompact from "./ProviderLocationPhotoCompact";
import ProviderAddLocationFlow from "./ProviderAddLocationFlow";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

function plainLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function locationAddress(location) {
  const parts = [
    location?.address,
    location?.address_line1,
    location?.street_address,
    location?.locality_name,
    location?.city,
    location?.county_name,
    location?.county,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(", ") || "Adresa nu este completata";
}

function locationTypeLabel(location) {
  return plainLabel(
    PROVIDER_PROFILE_TYPES[location?.provider_profile_type] ||
      PROVIDER_PROFILE_TYPES[location?.organization_type] ||
      PROVIDER_TYPES[location?.provider_type] ||
      "Locatie",
  );
}

function isVerifiedLocation(location) {
  return [
    location?.profile_control_status,
    location?.verification_state,
    location?.trust_state,
  ].includes("verified");
}

function textNode(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

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

    const layoutLocationCards = () => {
      const locationSection = Array.from(root.querySelectorAll("section")).find(
        (section) =>
          Array.from(section.querySelectorAll("h2")).some(
            (heading) =>
              String(heading.textContent || "").trim() === "Puncte de lucru",
          ),
      );
      const grid = locationSection?.querySelector(".grid");
      if (!grid) return;

      grid.classList.add("vezunde-location-selector-grid");
      const cards = Array.from(grid.children).filter(
        (element) => element.tagName === "BUTTON",
      );

      cards.forEach((card, index) => {
        const location = (workspace.locations || [])[index];
        if (!location) return;

        const active = location.id === selectedLocation?.id;
        const typeLabel = locationTypeLabel(location);
        const verified = isVerifiedLocation(location);
        const name =
          location.public_display_name || location.name || "Locatie fara nume";
        const address = locationAddress(location);
        const signature = JSON.stringify({
          id: location.id,
          active,
          typeLabel,
          verified,
          name,
          address,
        });

        card.classList.add("vezunde-location-selector-card");
        card.classList.toggle("is-active", active);
        card.dataset.locationId = location.id || "";
        card.children[1]?.classList.add(
          "vezunde-location-card-original-copy",
        );

        let custom = card.querySelector(
          ":scope > .vezunde-location-card-custom",
        );
        if (!custom) {
          custom = document.createElement("div");
          custom.className = "vezunde-location-card-custom";
        }
        if (custom.dataset.signature === signature) {
          if (!custom.parentElement) card.appendChild(custom);
          return;
        }

        custom.dataset.signature = signature;
        custom.replaceChildren();

        const meta = document.createElement("div");
        meta.className = "vezunde-location-card-meta";
        meta.appendChild(
          textNode("span", "vezunde-location-card-type", typeLabel),
        );
        if (verified) {
          meta.appendChild(
            textNode("span", "vezunde-location-card-verified", "✓ Verificata"),
          );
        }
        if (active) {
          meta.appendChild(
            textNode("span", "vezunde-location-card-selected", "Selectata"),
          );
        }

        custom.appendChild(meta);
        custom.appendChild(
          textNode("h3", "vezunde-location-card-title", name),
        );

        const addressRow = document.createElement("div");
        addressRow.className = "vezunde-location-card-address";
        addressRow.appendChild(
          textNode("span", "vezunde-location-card-pin", "⌖"),
        );
        addressRow.appendChild(textNode("span", "", address));
        custom.appendChild(addressRow);

        const manage = document.createElement("div");
        manage.className = "vezunde-location-card-manage";
        manage.appendChild(textNode("span", "", "Gestioneaza"));
        manage.appendChild(
          textNode("span", "vezunde-location-card-arrow", "›"),
        );
        custom.appendChild(manage);

        if (!custom.parentElement) card.appendChild(custom);
      });
    };

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

      layoutLocationCards();
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
  }, [
    canAddLocation,
    canManagePhoto,
    selectedLocationId,
    selectedLocation?.id,
    workspace.locations,
  ]);

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
        .vezunde-location-selector-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(280px, 340px)) !important;
          justify-content: start;
          gap: 1rem !important;
        }
        .vezunde-location-selector-card {
          display: flex;
          width: 100%;
          max-width: 340px;
          min-width: 0;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgb(23 23 23 / 0.24) !important;
          border-radius: 6px !important;
          background: hsl(var(--background)) !important;
          padding: 14px 14px 0 !important;
          text-align: left;
          box-shadow: none !important;
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .vezunde-location-selector-card:hover {
          transform: translateY(-1px);
          border-color: rgb(23 23 23 / 0.48) !important;
        }
        .vezunde-location-selector-card.is-active {
          border-color: rgb(23 23 23 / 0.48) !important;
          box-shadow: 0 0 0 1px rgb(23 23 23 / 0.05) !important;
        }
        .vezunde-location-selector-card > div:first-child {
          width: 100%;
          aspect-ratio: 16 / 8.4 !important;
          overflow: hidden;
          border: 1px solid rgb(23 23 23 / 0.12) !important;
          border-radius: 2px !important;
          background: hsl(var(--secondary) / 0.45);
        }
        .vezunde-location-selector-card > div:first-child > span {
          display: none !important;
        }
        .vezunde-location-selector-card > div:first-child img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vezunde-location-card-original-copy {
          display: none !important;
        }
        .vezunde-location-card-custom {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          padding-top: 12px;
        }
        .vezunde-location-card-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          min-height: 22px;
          font-size: 12px;
          line-height: 1.35;
        }
        .vezunde-location-card-type {
          color: #345bc8;
          font-weight: 600;
        }
        .vezunde-location-card-verified {
          color: #315c3a;
          font-weight: 600;
        }
        .vezunde-location-card-selected {
          color: hsl(var(--foreground));
          font-weight: 800;
        }
        .vezunde-location-card-title {
          margin-top: 7px;
          overflow-wrap: anywhere;
          font-size: 18px;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
          color: hsl(var(--foreground));
        }
        .vezunde-location-card-address {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 7px;
          margin-top: 8px;
          color: hsl(var(--muted-foreground));
          font-size: 13px;
          line-height: 1.55;
        }
        .vezunde-location-card-pin {
          flex: 0 0 auto;
          margin-top: 1px;
          color: hsl(var(--foreground) / 0.68);
          font-size: 15px;
        }
        .vezunde-location-card-manage {
          display: flex;
          min-height: 47px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 14px -14px 0;
          border-top: 1px solid rgb(23 23 23 / 0.14);
          padding: 12px 14px;
          color: hsl(var(--foreground));
          font-size: 14px;
          font-weight: 700;
        }
        .vezunde-location-card-arrow {
          font-size: 24px;
          font-weight: 400;
          line-height: 1;
        }

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
            grid-template-columns: minmax(0, 1fr) 320px;
            column-gap: 1.5rem;
            align-items: start;
          }
          .vezunde-location-summary > * { grid-column: 1; }
          .vezunde-location-summary > .vezunde-location-summary-header {
            grid-column: 1;
            grid-row: 1;
          }
          .vezunde-location-summary > .vezunde-location-summary-details {
            margin-top: 0.75rem !important;
          }
          .vezunde-location-summary > .vezunde-location-map-actions {
            margin-top: 0 !important;
          }
          .vezunde-location-summary > .vezunde-location-map {
            grid-column: 2;
            grid-row: 1 / span 4;
            align-self: start;
            width: 100%;
            margin-top: 0 !important;
          }
          .vezunde-location-summary > .vezunde-location-map > div {
            height: 190px !important;
          }
        }

        @media (max-width: 639px) {
          .vezunde-location-selector-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .vezunde-location-selector-card {
            max-width: none;
          }
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
