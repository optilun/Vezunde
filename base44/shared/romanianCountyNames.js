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
