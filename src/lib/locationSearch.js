import { base44 } from "@/api/base44Client";

// Adaptor de cautare locatii pentru fluxul de revendicare.
// Cauta in ProviderLocation dupa nume, oras, adresa sau telefon public.
// Arhitectura permite adaugarea ulterioara a Google Places Autocomplete:
// un al doilea provider care returneaza acelasi format (cu place_id).
let cache = null;

export async function searchLocations(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  if (!cache) cache = await base44.entities.ProviderLocation.list(null, 200);
  return cache
    .filter((loc) =>
      [loc.name, loc.city, loc.address, loc.phone_public]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    )
    .slice(0, 8)
    .map((loc) => ({ ...loc, phone: loc.phone_public }));
}