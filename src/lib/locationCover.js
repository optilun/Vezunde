// Coperta generata a unei locatii fara fotografie (cardurile directorului si fereastra pinului de pe
// harta): tonuri din paleta, dupa tipul locatiei. Albastru-ardezie pentru optici, nisip pentru
// clinici si cabinete, salvie pentru optometrie.
export const COVER_TONES = {
  optica_medicala: "from-[#dce4f2] via-[#eff1f5] to-[#f7f2e8]",
  laborator_optic: "from-[#dce4f2] via-[#eff1f5] to-[#f7f2e8]",
  clinica_oftalmologica: "from-[#e9e2d3] via-[#f3efe7] to-[#eef1f5]",
  cabinet_oftalmologic: "from-[#e9e2d3] via-[#f3efe7] to-[#eef1f5]",
  cabinet_optometric: "from-[#dfe8e1] via-[#eef2ee] to-[#f7f2e8]",
};

export function coverTone(providerType) {
  return COVER_TONES[providerType] || COVER_TONES.clinica_oftalmologica;
}

export const PROFILE_STATUS_LABELS = {
  verified: "Profil verificat de VIASEE",
  claimed: "Profil revendicat",
  directory: "Profil din director",
};
