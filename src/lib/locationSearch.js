import { base44 } from "@/api/base44Client";

// Adaptor de cautare locatii.
// Astazi cauta in locatiile demo Vezunde (nume, oras, adresa, telefon public).
// Arhitectura permite inlocuirea/completarea ulterioara cu Google Places Autocomplete:
// este suficient sa se adauge un al doilea provider care returneaza acelasi format.
let cache = null;

export async function searchLocations(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  if (!cache) cache = await base44.entities.Location.list();
  return cache
    .filter((loc) =>
      [loc.name, loc.city, loc.address, loc.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    )
    .slice(0, 8);
}