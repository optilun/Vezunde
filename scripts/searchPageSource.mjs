// Sursa paginii /cauta pentru verificari. Nu este o verificare (nu incepe cu `verify-`).
//
// 2026-09-29 (audit /cauta, D3): Search.jsx a fost impartit in hook-uri. Verificarile care citeau
// doar Search.jsx citesc acum pagina impreuna cu hook-urile ei, in aceasta ordine: pagina intai,
// ca `indexOf` sa gaseasca tot ce a ramas in pagina acolo unde era.
import { readFileSync } from 'node:fs';

export const SEARCH_PAGE_FILES = [
  'src/pages/Search.jsx',
  'src/hooks/useSearchResults.js',
  'src/hooks/useSearchUrlSync.js',
  'src/hooks/useStickySearchControls.js',
  'src/hooks/useRememberScroll.js',
  'src/hooks/useDebouncedValue.js',
  'src/lib/searchLinkedState.js',
];

export function readSearchPage() {
  return SEARCH_PAGE_FILES
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
    .join('\n');
}
