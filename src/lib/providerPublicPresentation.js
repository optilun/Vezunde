const STATUS_PRESENTATION = Object.freeze({
  directory: Object.freeze({
    label: "Profil din director",
    description: "Informatii de baza colectate din surse publice. VIASEE nu a confirmat acest profil cu furnizorul.",
  }),
  claimed: Object.freeze({
    label: "Profil revendicat",
    description: "Profil administrat de furnizor, aflat inaintea verificarii complete VIASEE.",
  }),
  verified: Object.freeze({
    label: "Profil verificat de VIASEE",
    description: "Identitatea si controlul profilului au fost verificate de VIASEE.",
  }),
});

const CLAIM_LOCATION_FIELDS = [
  "id",
  "name",
  "public_display_name",
  "provider_type",
  "provider_profile_type",
  "city",
  "county",
  "locality_siruta_code",
];

export function getPublicProfilePresentation(status) {
  return STATUS_PRESENTATION[status] || STATUS_PRESENTATION.directory;
}

export function buildClaimLocationState(location = {}) {
  const selectedLocation = {};
  for (const field of CLAIM_LOCATION_FIELDS) {
    if (location[field] !== undefined && location[field] !== null && location[field] !== "") {
      selectedLocation[field] = location[field];
    }
  }
  return { selectedLocation };
}

export function buildDirectoryReportHref(location = {}) {
  const name = String(location.name || "Profil fara nume").trim();
  const id = String(location.id || "necunoscut").trim();
  const subject = `Corectie profil VIASEE: ${name}`;
  const body = [
    `Profil: ${name}`,
    `ID locatie: ${id}`,
    `Pagina: /furnizor/${id}`,
    "",
    "Descrie informatia care trebuie corectata sau motivul pentru care profilul trebuie eliminat:",
  ].join("\n");
  return `mailto:contact@viasee.ro?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const PUBLIC_PROFILE_PRESENTATION = STATUS_PRESENTATION;
