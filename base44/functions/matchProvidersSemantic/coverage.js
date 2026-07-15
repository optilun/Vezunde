export function getRecommendationCoverageStatus({
  resultCount = 0,
  localProviderCount = 0,
  configuredMatchingProviderCount = 0,
} = {}) {
  if (resultCount > 0) return 'results_found';
  if (localProviderCount === 0) return 'no_local_providers';
  if (configuredMatchingProviderCount === 0) return 'local_service_data_missing';
  return 'no_eligible_local_results';
}
