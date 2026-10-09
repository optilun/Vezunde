export const PROVIDER_STATUS_CENTER_CONTRACT_VERSION = 'provider-status-center-v1';

/**
 * @typedef {Object} ProviderStatusLocation
 * @property {string=} status
 * @property {boolean=} is_active
 * @property {string=} profile_control_status
 * @property {string=} verification_state
 */

/**
 * @typedef {Object} ProviderStatusEntitlement
 * @property {string=} plan_code
 * @property {string=} status
 * @property {string[]=} feature_keys
 */

/**
 * @typedef {Object} ProviderStatusCounters
 * @property {number=} active
 * @property {number=} new
 * @property {number=} history
 */

/** @param {unknown} value */
function clean(value) {
  return String(value || '').trim();
}

/**
 * @param {ProviderStatusEntitlement} entitlement
 * @param {string} featureKey
 */
function hasFeature(entitlement, featureKey) {
  return Array.isArray(entitlement.feature_keys) && entitlement.feature_keys.includes(featureKey);
}

/**
 * @param {{
 *   location?: ProviderStatusLocation,
 *   entitlement?: ProviderStatusEntitlement,
 *   counters?: ProviderStatusCounters
 * }=} input
 */
export function buildProviderStatusCenter(input = {}) {
  const {
    location = {},
    entitlement = {},
    counters = {},
  } = input;
  const published = location.status === 'publicata' && location.is_active !== false;
  const suspended = location.profile_control_status === 'suspended';
  const controlled = ['claimed', 'verified'].includes(clean(location.profile_control_status));
  const verified = location.profile_control_status === 'verified' || location.verification_state === 'verified';
  const pro = entitlement.plan_code === 'pro' && ['active', 'trialing'].includes(clean(entitlement.status));
  const activeLeadCount = Number(counters.active) || 0;
  // 2026-10-09 (audit Top 3, T1): comutatorul „Primesc cereri de la clienți”. Oprit doar cand
  // locatia spune explicit asta; fara campuri (date vechi sau partiale) nu blocam nimic.
  const intakeOff = (location.request_intake_status !== undefined && location.request_intake_status !== null
    && clean(location.request_intake_status) !== 'active')
    || location.accepts_patients_directly === false;

  const capabilities = [
    {
      key: 'directory_visibility',
      label: 'Profil public',
      state: published && !suspended ? 'active' : 'blocked',
      detail: suspended
        ? 'Profilul este suspendat și nu poate fi afișat public.'
        : published
          ? 'Locația este publicată în director.'
          : 'Locația nu este publicată momentan.',
    },
    {
      key: 'lead_preview',
      label: 'Rezumatul cererilor',
      state: published && !suspended && !intakeOff ? 'active' : 'blocked',
      detail: !published || suspended
        ? 'Cererile nu sunt disponibile cât timp locația nu este publică.'
        : intakeOff
          ? 'Primirea cererilor este oprită. O pornești din „Primesc cereri de la clienți”.'
          : 'Rezumatul anonim al cererilor eligibile este disponibil.',
    },
    {
      key: 'lead_response',
      label: 'Răspuns la cereri',
      state: pro && hasFeature(entitlement, 'provider_leads.respond') ? 'active' : 'limited',
      detail: pro
        ? 'Locația poate trimite răspunsuri structurate.'
        : 'Răspunsurile structurate necesită plan Pro activ.',
    },
    {
      key: 'full_details',
      label: 'Detalii complete',
      state: pro && hasFeature(entitlement, 'provider_leads.full_details') ? 'conditional' : 'limited',
      detail: pro
        ? 'Disponibile numai pentru cererile eligibile din Top 3.'
        : 'Detaliile complete necesită plan Pro și eligibilitate Top 3.',
    },
    {
      key: 'controlled_chat',
      label: 'Chat VIASEE',
      state: pro && hasFeature(entitlement, 'provider_chat.access') ? 'conditional' : 'limited',
      detail: pro
        ? 'Chatul devine activ numai după ce clientul îl deschide.'
        : 'Chatul controlat necesită plan Pro.',
    },
    {
      key: 'phone_access',
      label: 'Acces la telefon',
      state: pro && hasFeature(entitlement, 'provider_contact.access_after_consent') ? 'conditional' : 'limited',
      detail: pro
        ? 'Telefonul poate fi accesat numai după acordul separat al clientului.'
        : 'Accesul la telefon necesită plan Pro și acordul clientului.',
    },
  ];

  const blockers = [];
  if (!published) blockers.push('Locația nu este publicată.');
  if (suspended) blockers.push('Profilul este suspendat.');
  if (!controlled) blockers.push('Profilul nu este încă revendicat sau verificat.');
  if (intakeOff) blockers.push('Primirea cererilor este oprită.');
  if (!pro) blockers.push('Planul curent este Free.');

  return {
    contract_version: PROVIDER_STATUS_CENTER_CONTRACT_VERSION,
    overall_state: suspended ? 'blocked' : published ? (pro ? 'ready' : 'limited') : 'setup_required',
    overall_label: suspended
      ? 'Acces blocat'
      : published
        ? (pro ? 'Locație pregătită' : 'Locație activă cu acces limitat')
        : 'Configurare necesară',
    profile: {
      published,
      controlled,
      verified,
      control_status: clean(location.profile_control_status) || 'directory',
    },
    plan: {
      code: clean(entitlement.plan_code) || 'free',
      status: clean(entitlement.status) || 'free',
    },
    counters: {
      active_leads: activeLeadCount,
      new_leads: Number(counters.new) || 0,
      history_leads: Number(counters.history) || 0,
    },
    capabilities,
    blockers,
  };
}
