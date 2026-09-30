// Ajutor pentru verificarile care citesc sursa ecranului de recomandari (nu este o verificare:
// numele nu incepe cu `verify-`, deci verify-all nu il ruleaza).
//
// 2026-09-30. MatchResults.jsx a fost taiat: extinderea zonei (useRecommendationExpansion),
// grupurile pe aria cautarii (ResultScopeGroups), sectiunile extinse (RecommendationExtendedSections)
// si impartirea pe bucketuri (recommendationSections). Regulile pe care verificarile le pazesc
// (Top 3 doar dupa result_bucket, extinderea cheama aceleasi functii, evenimentele de analitica,
// grila) nu s-au schimbat - doar locul lor -, deci verificarile citesc impreuna aceste fisiere.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MATCH_RESULTS_FILES = [
  'src/components/intake2/MatchResults.jsx',
  'src/components/intake2/ResultScopeGroups.jsx',
  'src/components/intake2/RecommendationExtendedSections.jsx',
  'src/hooks/useRecommendationExpansion.js',
  'src/lib/recommendationSections.js',
];

export function readMatchResultsSource() {
  return MATCH_RESULTS_FILES.map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n');
}
