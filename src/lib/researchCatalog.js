// MODULE 3F - internal research catalog (admin UI labels only).

export const RESEARCH_STATUS_LABELS = {
  new: "Nou",
  in_progress: "In lucru",
  ready_for_review: "Gata de review",
  published: "Publicat (research)",
  rejected: "Respins",
  needs_recheck: "Necesita re-verificare",
};

export const CHECKLIST_ITEMS = [
  { key: "website_identified", label: "Website identificat" },
  { key: "contact_page_identified", label: "Pagina oficiala de contact identificata" },
  { key: "phone_checked", label: "Telefon public verificat" },
  { key: "address_checked", label: "Adresa publica verificata" },
  { key: "schedule_checked", label: "Program public verificat" },
  { key: "services_checked", label: "Servicii verificate" },
  { key: "source_dates_saved", label: "Datele surselor salvate" },
  { key: "duplicate_checked", label: "Duplicate verificate" },
  { key: "ready_for_review", label: "Gata pentru review" },
];

export const EVIDENCE_CONFIDENCE_LABELS = { low: "Scazuta", medium: "Medie", high: "Ridicata" };
export const EVIDENCE_STATUS_LABELS = { active: "Activa", superseded: "Inlocuita", rejected: "Respinsa" };

export const MISSING_FIELD_LABELS = {
  website: "website",
  phone_public: "telefon public",
  address: "adresa",
  opening_hours: "program",
  description: "descriere",
};

// CSV template fields — preparation only, no import exists in this module.
export const CSV_TEMPLATE_FIELDS = [
  { key: "source_url", required: true, doc: "URL-ul exact al sursei publice oficiale (obligatoriu, http/https, fara Google Maps/Places)." },
  { key: "source_checked_at", required: true, doc: "Data la care sursa a fost verificata (format YYYY-MM-DD)." },
  { key: "source_type", required: true, doc: "site_oficial / registru_public / director_public / alta_sursa_publica." },
  { key: "org_name", required: true, doc: "Numele organizatiei." },
  { key: "location_name", required: true, doc: "Numele locatiei." },
  { key: "provider_type", required: true, doc: "Tip furnizor din taxonomia Vezunde (ex: optica_medicala)." },
  { key: "city", required: true, doc: "Orasul locatiei." },
  { key: "county", required: true, doc: "Judetul locatiei." },
  { key: "address", required: true, doc: "Adresa publica completa." },
  { key: "phone_public", required: false, doc: "Telefon public afisat de furnizor." },
  { key: "public_email", required: false, doc: "Email public afisat de furnizor." },
  { key: "website", required: false, doc: "Website-ul oficial al locatiei." },
  { key: "opening_hours", required: false, doc: "Programul public, ca text." },
  { key: "description", required: false, doc: "Descriere scurta, factuala." },
  { key: "data_confidence", required: false, doc: "low / medium / high (implicit medium)." },
  { key: "notes", required: false, doc: "Note interne despre sursa." },
];