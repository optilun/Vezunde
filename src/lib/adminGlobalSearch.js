// Căutarea globală din panoul de admin (Ctrl/Cmd+K, 2026-10-07): găsește secțiuni, locații, organizații,
// revendicări și tichete, și spune unde trebuie dus fiecare rezultat (secțiune + sub-tab + ?id=).
// Fără React, ca să poată fi verificată din scripts/.
import { buildLocationIndex, buildSearchIndex, normalizeSearch, searchIndex, searchTokens } from "./adminSearch.js";
import { claimStatusLabel, profileControlLabel } from "./adminLabels.js";

export const GLOBAL_LIMITS = Object.freeze({ section: 6, location: 6, organization: 4, claim: 4, ticket: 4 });

const REVIEWABLE_CLAIM_STATUSES = new Set(["in_asteptare", "needs_more_info"]);

const TICKET_STATUS_LABELS = {
  open: "Deschis",
  in_progress: "În lucru",
  waiting_user: "Așteaptă utilizatorul",
  resolved: "Rezolvat",
  closed: "Închis",
};

// Prefixul din ?id= care înseamnă „toate locațiile acestei organizații” (Profiluri).
export const ORGANIZATION_ID_PREFIX = "org:";

export function buildGlobalIndexes({ locations = [], organizations = [], claims = [], tickets = [] } = {}) {
  const organizationName = new Map(organizations.map((organization) => [organization.id, organization.public_display_name || organization.name || ""]));
  const locationCount = new Map();
  for (const location of locations) {
    if (location.organization_id) locationCount.set(location.organization_id, (locationCount.get(location.organization_id) || 0) + 1);
  }
  return {
    locations: buildLocationIndex(locations.map((location) => ({ ...location, organization_name: organizationName.get(location.organization_id) || "" }))),
    organizations: buildSearchIndex(
      organizations.map((organization) => ({ ...organization, location_count: locationCount.get(organization.id) || 0 })),
      {
        name: (organization) => organization.public_display_name || organization.name,
        parts: (organization) => [organization.public_display_name, organization.name, organization.legal_name, organization.public_email],
        phones: (organization) => [organization.public_phone],
      },
    ),
    claims: buildSearchIndex(claims, {
      name: (claim) => claim.business_name || claim.contact_name,
      parts: (claim) => [claim.business_name, claim.contact_name, claim.email],
      phones: (claim) => [claim.phone],
    }),
    tickets: buildSearchIndex(tickets, {
      name: (ticket) => ticket.subject,
      parts: (ticket) => [ticket.subject, ticket.requester_name, ticket.requester_email],
    }),
  };
}

const placeOf = (location) => {
  const city = location.city || location.locality_name || "";
  const county = location.county || location.county_name || "";
  return [city, county && county !== city ? county : ""].filter(Boolean).join(", ");
};

function locationResult(location) {
  const control = location.profile_control_status;
  const subtitle = [placeOf(location), location.phone_public || location.public_phone, control && control !== "directory" ? profileControlLabel(control) : ""].filter(Boolean).join(" · ");
  return {
    key: `location:${location.id}`,
    type: "location",
    title: location.public_display_name || location.name || "Locație fără nume",
    subtitle: subtitle || "fără localitate",
    target: { section: "profiluri", tab: "", id: location.id },
  };
}

function organizationResult(organization) {
  const count = organization.location_count || 0;
  return {
    key: `organization:${organization.id}`,
    type: "organization",
    title: organization.public_display_name || organization.name || "Organizație fără nume",
    subtitle: `Organizație · ${count} ${count === 1 ? "locație" : "locații"}`,
    target: { section: "profiluri", tab: "", id: `${ORGANIZATION_ID_PREFIX}${organization.id}` },
  };
}

function claimResult(claim) {
  return {
    key: `claim:${claim.id}`,
    type: "claim",
    title: claim.business_name || claim.contact_name || "Revendicare",
    subtitle: [claimStatusLabel(claim.status), claim.contact_name, claim.email].filter(Boolean).join(" · "),
    target: { section: "revendicari", tab: REVIEWABLE_CLAIM_STATUSES.has(claim.status) ? "" : "istoric", id: claim.id },
  };
}

function ticketResult(ticket) {
  return {
    key: `ticket:${ticket.id}`,
    type: "ticket",
    title: ticket.subject || "Tichet fără subiect",
    subtitle: [TICKET_STATUS_LABELS[ticket.status || "open"] || "Deschis", ticket.requester_name || ticket.requester_email].filter(Boolean).join(" · "),
    target: { section: "support_tickets", tab: "", id: ticket.id },
  };
}

// sections: [{ key, label, count? }] din meniu. Fără text scris se arată doar secțiunile (un meniu rapid).
// Întoarce grupuri: [{ key, label, items: [{ key, type, title, subtitle, badge?, target }], total }]
export function searchEverything(indexes, query, sections = [], limits = GLOBAL_LIMITS) {
  const tokens = searchTokens(query);
  const groups = [];

  // Fără text, meniul rapid arată toate secțiunile; cu text, doar primele potriviri.
  const sectionItems = sections
    .filter((section) => tokens.every((token) => normalizeSearch(section.label).includes(token)))
    .slice(0, tokens.length === 0 ? sections.length : limits.section)
    .map((section) => ({
      key: `section:${section.key}`,
      type: "section",
      title: section.label,
      subtitle: "",
      badge: section.count > 0 ? String(section.count) : "",
      target: { section: section.key, tab: "", id: "" },
    }));
  if (sectionItems.length > 0) groups.push({ key: "sections", label: "Secțiuni", items: sectionItems, total: sectionItems.length });
  if (tokens.length === 0) return groups;

  const add = (key, label, index, limit, toResult) => {
    if (!index) return;
    const { items, total } = searchIndex(index, query, { limit });
    if (items.length > 0) groups.push({ key, label, items: items.map(toResult), total });
  };
  add("locations", "Locații", indexes.locations, limits.location, locationResult);
  add("organizations", "Organizații", indexes.organizations, limits.organization, organizationResult);
  add("claims", "Revendicări", indexes.claims, limits.claim, claimResult);
  add("tickets", "Tichete", indexes.tickets, limits.ticket, ticketResult);
  return groups;
}
