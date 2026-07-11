import {
  CANONICAL_SERVICE_KEYS,
  SERVICE_GROUPS,
  getCanonicalServiceDefinition,
  getServiceGroupLayout,
} from '../../../shared/canonicalServiceRegistryExtended.js';
import {
  getProviderServiceSections,
  getPublicNeedSections,
} from '../../../shared/serviceOperationalTaxonomyExtended.js';

function clean(value) {
  return String(value || '').trim();
}

Deno.serve(async (request) => {
  try {
    const payload = request.method === 'GET'
      ? Object.fromEntries(new URL(request.url).searchParams.entries())
      : await request.json().catch(() => ({}));
    const profileType = clean(payload.profile_type);
    const providerType = clean(payload.provider_type);
    const patientFacingOnly = payload.patient_facing_only === true
      || String(payload.patient_facing_only || '').toLowerCase() === 'true';
    const layout = getServiceGroupLayout(profileType, providerType);
    const visibleGroups = new Set([...layout.primary, ...layout.secondary]);

    const definitions = CANONICAL_SERVICE_KEYS
      .map((key) => getCanonicalServiceDefinition(key))
      .filter(Boolean)
      .filter((definition) => !profileType || visibleGroups.has(definition.group))
      .filter((definition) => !patientFacingOnly || definition.patient_facing !== false);

    const groups = Object.fromEntries(
      Object.entries(SERVICE_GROUPS)
        .filter(([group]) => !profileType || visibleGroups.has(group))
        .map(([group, config]) => [group, {
          key: group,
          label: config.label,
          helper: config.helper,
          service_keys: definitions
            .filter((definition) => definition.group === group)
            .map((definition) => definition.key),
        }]),
    );

    return Response.json({
      catalog_version: 2,
      profile_type: profileType || null,
      provider_type: providerType || null,
      group_layout: layout,
      groups,
      service_definitions: Object.fromEntries(
        definitions.map((definition) => [definition.key, definition]),
      ),
      provider_sections: getProviderServiceSections()
        .filter((section) => section.items.some((item) => definitions.some((definition) => definition.key === item.id))),
      public_need_sections: getPublicNeedSections(),
      search_metadata: {
        field: 'search_keywords',
        hidden_from_provider_form: true,
        resolver_function: 'matchProvidersSemantic',
      },
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'Nu am putut încărca catalogul semantic.',
    }, { status: 500 });
  }
});
