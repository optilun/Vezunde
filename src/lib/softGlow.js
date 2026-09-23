// Halou colorat moale, fara filtru blur.
//
// Inainte halourile de pe home erau dreptunghiuri colorate cu `blur-3xl` (blur de 64px). Filtrul
// se recalcula la fiecare cadru de derulare (masurat: ~850 ms de desenare la o derulare pe desktop,
// fata de ~350 ms fara halouri). Acelasi aspect se obtine cu un gradient radial, care se deseneaza
// aproape gratuit (~385 ms). Comparat pixel cu pixel cu varianta blur: diferenta medie sub un nivel
// de culoare, maxim ~12 din 255, doar in marginea haloului.
//
// Elementul care poarta gradientul trebuie sa fie cu SOFT_GLOW_BLEED_PX mai mare pe fiecare latura
// decat forma care se estompa inainte (blur-ul de 64px se intinde vizibil ~128px in afara formei).
// Un parinte cu overflow-hidden (foaia home-ului) il taie, deci nu apare derulare orizontala.

export const SOFT_GLOW_BLEED_PX = 128;

// Profilul unui dreptunghi estompat gaussian (sigma 64px), masurat de la centru spre margine.
const PROFILE = [
  [0, 0.92],
  [25, 0.855],
  [51, 0.5],
  [76, 0.158],
  [95, 0.02],
];

/** @param {string} rgb ex. "190 169 200"  @param {number} alpha opacitatea culorii (ca in bg-[#...]/32) */
export function softGlowBackground(rgb, alpha) {
  const stops = PROFILE.map(([at, factor]) => `rgb(${rgb} / ${Number((alpha * factor).toFixed(4))}) ${at}%`);
  return `radial-gradient(closest-side, ${stops.join(", ")}, rgb(${rgb} / 0) 100%)`;
}
