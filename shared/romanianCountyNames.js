// Copie pentru frontend a base44/shared/romanianCountyNames.js (aceeasi logica, verificata de
// scripts/verify-search-filters-scroll-focus.mjs). Serverul de dezvoltare Vite nu serveste nimic din
// base44/ (@base44/vite-plugin: fs.deny), deci codul din src/ nu poate importa direct de acolo;
// altfel /cauta (si orice pagina cu localityQuickPicks) nu se mai incarca in previzualizare.

const COUNTY_NAMES = {
  Arges: 'Argeș', Bacau: 'Bacău', 'Bistrita-Nasaud': 'Bistrița-Năsăud', Botosani: 'Botoșani',
  Brasov: 'Brașov', Braila: 'Brăila', Bucuresti: 'București', Buzau: 'Buzău',
  'Caras-Severin': 'Caraș-Severin', Calarasi: 'Călărași', Constanta: 'Constanța',
  Dambovita: 'Dâmbovița', Galati: 'Galați', Ialomita: 'Ialomița', Iasi: 'Iași',
  Maramures: 'Maramureș', Mehedinti: 'Mehedinți', Mures: 'Mureș', Neamt: 'Neamț',
  Salaj: 'Sălaj', Timis: 'Timiș', Valcea: 'Vâlcea',
};

export function prettyCountyName(value) {
  const raw = String(value || '').trim();
  const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COUNTY_NAMES[key] || raw;
}
