// Afișarea adresei, fără să schimbăm ce e salvat (2026-10-04, audit cont organizație, #16).
//
// Adresele vin cum au fost introduse sau importate: uneori cu majuscule („STR. MIHAI VITEAZU NR. 5”)
// sau cu un marcaj rămas fără valoare la final („…, ET.”). Aici doar le curățăm la afișare.
// Funcția exista înainte doar în pagina publică (ProviderProfile.jsx) și transforma greșit
// „Strada X” în „Str. ada X”; acum o folosesc și pagina publică, și contul organizației.

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAllUpperCase(value) {
  const raw = String(value || "");
  return raw === raw.toLocaleUpperCase("ro-RO") && raw !== raw.toLocaleLowerCase("ro-RO");
}

function toTitleCase(value) {
  return String(value || "")
    .toLocaleLowerCase("ro-RO")
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator, letter) => `${separator}${letter.toLocaleUpperCase("ro-RO")}`);
}

// Doar textul scris integral cu majuscule devine „Titlu”; restul rămâne cum l-a scris furnizorul.
export function titleCaseAddress(value) {
  const raw = String(value || "").trim();
  return isAllUpperCase(raw) ? toTitleCase(raw) : raw;
}

export function formatStreetAddress(address, city) {
  let value = String(address || "").trim().replace(/\s+/g, " ");
  if (!value) return "";

  if (city) {
    const cityPrefix = new RegExp(`^(?:sat(?:ul)?\\s+)?${escapeRegExp(city)}\\s*,\\s*`, "i");
    value = value.replace(cityPrefix, "");
  }

  // Decidem înainte de curățare: „STR.” devine „Str.” și textul n-ar mai părea scris cu majuscule.
  const upperCase = isAllUpperCase(value);
  value = value
    // Marcaje rămase fără valoare la final: „, ET.”, „AP.”, „SC.”, „BL.”.
    .replace(/(?:,\s*)?\b(?:ET|AP|SC|BL)\.?\s*$/i, "")
    // Doar abrevierea („STR.”, „STR ”), nu începutul unui cuvânt („Strada”, „Nrăvan”).
    .replace(/\bSTR(?:\.|\b)\s*/gi, "Str. ")
    .replace(/\bNR(?:\.|\b)\s*/gi, "nr. ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*$/, "")
    .trim();

  return (upperCase ? toTitleCase(value) : value)
    .replace(/\bNr\.\s*/g, "nr. ")
    .replace(/\bStr\.\s*/g, "Str. ")
    .trim();
}

function uniqueParts(parts) {
  const unique = [];
  for (const part of parts) {
    const text = String(part || "").trim();
    if (text && !unique.some((item) => item.toLocaleLowerCase("ro-RO") === text.toLocaleLowerCase("ro-RO"))) unique.push(text);
  }
  return unique;
}

// Adresa completă a unei locații: stradă, localitate, județ, fără repetări.
export function formatLocationAddress(location = {}, fallback = "") {
  const city = location?.locality_name || location?.city || "";
  const streets = [location?.address, location?.address_line1, location?.street_address].map((value) => formatStreetAddress(value, city));
  const places = [location?.locality_name, location?.city, location?.county_name, location?.county].map(titleCaseAddress);
  return uniqueParts([...streets, ...places]).join(", ") || fallback;
}
