const STATUS_PRESENTATION = Object.freeze({
  directory: Object.freeze({
    label: "Profil nerevendicat",
    description: "Informații din surse publice. Profilul nu este administrat de furnizor, iar afișarea nu reprezintă un parteneriat sau o recomandare VIASEE.",
  }),
  claimed: Object.freeze({
    label: "Profil revendicat",
    description: "Profil administrat de furnizor, aflat înaintea verificării complete VIASEE.",
  }),
  verified: Object.freeze({
    label: "Profil verificat de VIASEE",
    description: "Identitatea și controlul profilului au fost verificate de VIASEE.",
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

export const PUBLIC_PROFILE_PRESENTATION = STATUS_PRESENTATION;
