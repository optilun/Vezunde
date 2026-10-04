import { locationLocalityFields } from "./locationMapPosition.js";

// Resolve SIRUTA on the server on save, submit AND approval; client labels are never authority.
export async function resolveLocationLocality(svc, payload = {}, { required = false } = {}) {
  if (!("locality_siruta_code" in payload) && !("city" in payload) && !("county" in payload) && !required) return { value: payload };
  const code = String(payload.locality_siruta_code || "").trim();
  if (!code) return { error: "Selectează localitatea din lista oficială." };
  const rows = await svc.entities.GeographicLocality.filter({ siruta_code: code, is_active: true }, "id", 2);
  const geo = rows?.[0];
  if (!geo) return { error: "Localitatea selectată nu mai este disponibilă. Alege-o din nou." };
  const fields = locationLocalityFields(geo);
  return { value: { ...payload, city: fields.city, county: fields.county, locality_siruta_code: fields.locality_siruta_code }, fields };
}
