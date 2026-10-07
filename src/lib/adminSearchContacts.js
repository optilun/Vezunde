// Datele de contact lasate de pacienti la cautare, in panoul de admin (2026-09-28, cererea
// owner-ului: "sa le vad si eu in panoul de admin, in contul de admin de pe viasee").
// Regulile de colectare sunt in shared/patientSearchContact.js. Aici: etichete, filtre, numaratori
// si randurile pentru export, fara React, ca sa poata fi verificate din scripts/.

export const SEARCH_CONTACT_FOLLOW_UP_OPTIONS = Object.freeze([
  { value: "nou", label: "Nou" },
  { value: "contactat", label: "Contactat" },
  { value: "fara_raspuns", label: "Fără răspuns" },
  { value: "nu_mai_contacta", label: "Nu mai contacta" },
]);

const FOLLOW_UP_LABELS = Object.fromEntries(SEARCH_CONTACT_FOLLOW_UP_OPTIONS.map((option) => [option.value, option.label]));

export const SEARCH_CONTACT_FOR_WHOM_LABELS = Object.freeze({
  adult: "Pentru sine",
  copil: "Pentru un copil",
  other_adult: "Pentru altcineva",
});

export const SEARCH_CONTACT_TIMING_LABELS = Object.freeze({
  cat_mai_repede: "Cât mai repede",
  zilele_urmatoare: "În următoarele zile",
  saptamana_aceasta: "Săptămâna aceasta",
  nu_e_urgent: "Nu e urgent",
});

export function searchContactFollowUp(row) {
  return FOLLOW_UP_LABELS[row?.follow_up_status] ? row.follow_up_status : "nou";
}

export function searchContactFollowUpLabel(row) {
  return FOLLOW_UP_LABELS[searchContactFollowUp(row)];
}

// Tonul insignei de urmărire (tokenii semantici ai panoului): „Nou” cere o acțiune de la tine.
const FOLLOW_UP_TONES = { nou: "info", contactat: "success", fara_raspuns: "warning", nu_mai_contacta: "neutral" };
export function searchContactFollowUpTone(row) {
  return FOLLOW_UP_TONES[searchContactFollowUp(row)];
}

// Cine poate primi oferte: a bifat acordul separat, nu s-a dezabonat si nu a cerut sa nu mai fie
// contactat. Legea 506/2004: fara acord, fara oferte pe email sau SMS.
export function canReceiveSearchContactOffers(row) {
  return row?.marketing_consent === true
    && !row?.marketing_unsubscribed_at
    && searchContactFollowUp(row) !== "nu_mai_contacta"
    && (row?.status || "active") === "active";
}

export function searchContactAgeLabel(row) {
  const age = Number(row?.age_years);
  if (!Number.isInteger(age) || age <= 0) return "—";
  if (row?.age_refers_to === "patient") return `${age} ani (persoana pentru care a căutat)`;
  return `${age} ani`;
}

export function searchContactPlaceLabel(row) {
  return [row?.city, row?.county].map((value) => String(value || "").trim()).filter(Boolean).join(", ") || "—";
}

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function searchContactMatches(row, query) {
  const needle = normalized(query).trim();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 3 && String(row?.contact_phone || "").replace(/\D/g, "").includes(digits)) return true;
  return [
    row?.contact_name,
    row?.contact_email,
    row?.contact_phone,
    row?.intent_label,
    row?.city,
    row?.county,
    row?.follow_up_note,
  ].some((value) => normalized(value).includes(needle));
}

export function filterSearchContacts(rows, { status = "all", query = "", offersOnly = false } = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (status !== "all" && searchContactFollowUp(row) !== status) return false;
    if (offersOnly && !canReceiveSearchContactOffers(row)) return false;
    return searchContactMatches(row, query);
  });
}

export function countSearchContacts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = { total: list.length, offers: 0, linked: 0 };
  for (const option of SEARCH_CONTACT_FOLLOW_UP_OPTIONS) counts[option.value] = 0;
  for (const row of list) {
    counts[searchContactFollowUp(row)] += 1;
    if (canReceiveSearchContactOffers(row)) counts.offers += 1;
    if (row?.linked_request_id) counts.linked += 1;
  }
  return counts;
}

export const SEARCH_CONTACT_CSV_HEADER = Object.freeze([
  "Data",
  "Nume",
  "Telefon",
  "Email",
  "Vârsta",
  "Pentru cine",
  "Nevoie",
  "Localitate",
  "Termen",
  "Poate primi oferte",
  "A salvat o cerere",
  "Status",
  "Notă",
]);

export function searchContactCsvRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => [
    String(row?.created_date || "").slice(0, 16).replace("T", " "),
    row?.contact_name || "",
    row?.contact_phone || "",
    row?.contact_email || "",
    searchContactAgeLabel(row) === "—" ? "" : searchContactAgeLabel(row),
    SEARCH_CONTACT_FOR_WHOM_LABELS[row?.for_whom] || "",
    row?.intent_label || "",
    searchContactPlaceLabel(row) === "—" ? "" : searchContactPlaceLabel(row),
    SEARCH_CONTACT_TIMING_LABELS[row?.timing_key] || "",
    canReceiveSearchContactOffers(row) ? "Da" : "Nu",
    row?.linked_request_id ? "Da" : "Nu",
    searchContactFollowUpLabel(row),
    row?.follow_up_note || "",
  ]);
}
