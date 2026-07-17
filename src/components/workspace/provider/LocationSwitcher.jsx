import React from "react";

function organizationName(context) {
  return context?.organization?.public_display_name || context?.organization?.name || "Organizație";
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
    <div className="mb-6 space-y-3 rounded-[18px] border border-foreground/10 bg-card p-3 shadow-[0_10px_30px_rgba(23,23,23,0.03)] sm:p-4">
      {organizationContexts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">Organizație</span>
          {organizationContexts.map((context) => {
            const id = context.organization?.id || "";
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectOrganization?.(id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${id === selectedOrganizationId ? "border-foreground bg-foreground text-white" : "border-border text-muted-foreground hover:border-foreground/40"}`}
              >
                {organizationName(context)}
              </button>
            );
          })}
        </div>
      )}
      {showLocations && locations.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {organizationContexts.length > 1 && <span className="mr-1 text-xs font-semibold text-muted-foreground">Locație</span>}
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelect(location.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${location.id === selectedLocationId ? "border-foreground bg-foreground text-white" : "border-border text-muted-foreground hover:border-foreground/40"}`}
            >
              {location.public_display_name || location.name || "Locație"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
