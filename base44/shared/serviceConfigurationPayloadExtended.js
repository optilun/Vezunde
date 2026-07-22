// Compatibility entry point for the V2 service catalog.
// Load the extended registry and taxonomy before the existing validator computes
// its allowed groups and operational context.
import './canonicalServiceRegistryExtended.js';
import './serviceOperationalTaxonomyExtended.js';

export {
  validateCapabilities,
  validateFunctionalUnits,
  validateRawRemovalKeys,
  validateRemovalCapabilities,
  validateRemovalUnitKeys,
  validateResourceLinks,
  validateResourceRemovals,
  validateServiceConfigurationPayload,
  validateServiceGroupObject,
  validateServiceUnitMap,
  validateSuggestions,
} from './serviceConfigurationPayload.js';
