// Initialele de pe coperta cardului de specialist (2026-09-30): prima si ultima parte a numelui,
// fara titulaturi („Dr. Andreea Popescu” -> AP, nu DP).
//
// Raspunsul motorului de specialisti poarta `display_name`, iar professionalInitials() din
// shared/professionalIdentity.js citeste `public_display_name` (formatul profilului), deci nu se
// poate folosi direct pe rezultate: coperta ar arata „?” in loc de initiale. Fisier pur, fara
// importuri, ca sa fie testabil in Node.
const TITLES = /^(dr|prof|conf|șef|sef|asist|doc|lect|med|drd)\.?$/i;

export function monogram(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  const words = parts.filter((part) => !TITLES.test(part));
  const use = words.length > 0 ? words : parts;
  if (use.length === 0) return '?';
  if (use.length === 1) return use[0].slice(0, 2).toLocaleUpperCase('ro-RO');
  return `${use[0][0]}${use[use.length - 1][0]}`.toLocaleUpperCase('ro-RO');
}

export default monogram;
