import React from "react";

function organizationName(context) {
  return context?.organization?.public_display_name || context?.organization?.name || "Organizatie";
}

function contextLocations(context, memberships = []) {
  if (context?.locations?.length) return context.locations;
  const ids = new Set();
  return memberships.filter((membership) => {
    if (!membership.location_id || ids.has(membership.location_id)) return false;
    ids.add(membership.location_id);
    return true;
  }).map((membership) => ({ id: membership.location_id, name: membership.location_name }));
}

export default function LocationSwitcher({
  organizationContexts = [],
  selectedOrganizationId = "",
  memberships = [],
  selectedLocationId,
  showLocations = true,
  onSelectOrganization,
  onSelect,
}) {
  const activeContext = organizationContexts.find((context) => context.organization?.id === selectedOrganizationId)
    || organizationContexts[0]
    || null;
  const locations = contextLocations(activeContext, memberships);

  return (
    <div className="mb-6 space-y-2">
      {organizationContexts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Organizatie</span>
          {organizationContexts.map((context) => {
            const id = context.organization?.id || "";
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectOrganization?.(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${id === selectedOrganizationId ? "border-foreground bg-foreground text-white" : "border-border text-muted-foreground hover:border-foreground/40"}`}
              >
                {organizationName(context)}
              </button>
            );
          })}
        </div>
      )}
      {showLocations && locations.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {organizationContexts.length > 1 && <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Locatie</span>}
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${location.id === selectedLocationId ? "border-foreground bg-foreground text-white" : "border-border text-muted-foreground hover:border-foreground/40"}`}
            >
              {location.public_display_name || location.name || "Locatie"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
