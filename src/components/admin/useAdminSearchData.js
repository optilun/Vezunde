import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Datele pentru căutarea globală (2026-10-07). Se citesc o singură dată la prima deschidere (doar câmpurile
// necesare: ~1.600 de locații + organizații + ultimele revendicări și tichete) și rămân în memorie 5 minute.
// Dacă o sursă nu răspunde, restul căutării merge, iar fereastra spune ce lipsește.
const TTL_MS = 5 * 60 * 1000;
let cache = null;
let inflight = null;

const SOURCES = [
  {
    key: "locations",
    label: "locațiile",
    load: () => base44.entities.ProviderLocation.list("name", 5000, 0, [
      "id", "name", "public_display_name", "city", "locality_name", "county", "county_name", "address",
      "organization_id", "status", "profile_control_status", "phone_public", "public_phone", "public_email",
    ]),
  },
  {
    key: "organizations",
    label: "organizațiile",
    load: () => base44.entities.ProviderOrganization.list("name", 5000, 0, ["id", "name", "public_display_name", "legal_name", "public_phone", "public_email"]),
  },
  {
    key: "claims",
    label: "revendicările",
    load: () => base44.entities.ProviderClaimRequest.list("-created_date", 300, 0, ["id", "business_name", "contact_name", "email", "phone", "status"]),
  },
  {
    key: "tickets",
    label: "tichetele",
    load: () => base44.entities.SupportTicket.list("-updated_date", 300, 0, ["id", "subject", "requester_name", "requester_email", "status"]),
  },
];

async function fetchAll() {
  const results = await Promise.allSettled(SOURCES.map((source) => source.load()));
  const data = {};
  const failed = [];
  results.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === "fulfilled" && Array.isArray(result.value)) data[source.key] = result.value;
    else {
      data[source.key] = [];
      failed.push(source.label);
    }
  });
  return { data, failed, loadedAt: Date.now() };
}

export function loadAdminSearchData({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return Promise.resolve(cache);
  if (!force && inflight) return inflight;
  inflight = fetchAll()
    .then((result) => {
      // Un eșec total nu se păstrează (următoarea deschidere încearcă din nou).
      if (result.failed.length < SOURCES.length) cache = result;
      return result;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

// Încarcă datele când fereastra de căutare se deschide.
export function useAdminSearchData(active) {
  const [state, setState] = useState(() => ({ data: cache?.data || null, failed: cache?.failed || [], loading: false }));

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: !(cache && Date.now() - cache.loadedAt < TTL_MS) }));
    loadAdminSearchData().then((result) => {
      if (!cancelled) setState({ data: result.data, failed: result.failed, loading: false });
    });
    return () => { cancelled = true; };
  }, [active]);

  return state;
}
