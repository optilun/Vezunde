export const PROVIDER_STATUS_CENTER_CONTRACT_VERSION = 'provider-status-center-v1';

function clean(value) {
  return String(value || '').trim();
}

function hasFeature(entitlement, featureKey) {
  return Array.isArray(entitlement?.feature_keys) && entitlement.feature_keys.includes(featureKey);
}

export function buildProviderStatusCenter({ location = {}, entitlement = {}, counters = {} } = {}) {
  const published = location.status === 'publicata' && location.is_active !== false;
  const suspended = location.profile_control_status === 'suspended';
  const controlled = ['claimed', 'verified'].includes(clean(location.profile_control_status));
  const verified = location.profile_control_status === 'verified' || location.verification_state === 'verified';
  const pro = entitlement.plan_code === 'pro' && ['active', 'trialing'].includes(clean(entitlement.status));
  const activeLeadCount = Number(counters.active) || 0;

  const capabilities = [
    {
      key: 'directory_visibility',
      label: 'Profil public',
      state: published && !suspended ? 'active' : 'blocked',
      detail: suspended
        ? 'Profilul este suspendat si nu poate fi afisat public.'
        : published
          ? 'Locatia este publicata in director.'
          : 'Locatia nu este publicata momentan.',
    },
    {
      key: 'lead_preview',
      label: 'Rezumat leaduri',
      state: published && !suspended ? 'active' : 'blocked',
      detail: published && !suspended
        ? 'Rezumatul anonim al cererilor eligibile este disponibil.'
        : 'Leadurile nu sunt disponibile cat timp locatia nu este publica.',
    },
    {
      key: 'lead_response',
      label: 'Raspuns la cereri',
      state: pro && hasFeature(entitlement, 'provider_leads.respond') ? 'active' : 'limited',
      detail: pro
        ? 'Locatia poate trimite raspunsuri structurate.'
        : 'Raspunsurile structurate necesita plan Pro activ.',
    },
    {
      key: 'full_details',
      label: 'Detalii complete',
      state: pro && hasFeature(entitlement, 'provider_leads.full_details') ? 'conditional' : 'limited',
      detail: pro
        ? 'Disponibile numai pentru leadurile Top 3 eligibile.'
        : 'Detaliile complete necesita plan Pro si eligibilitate Top 3.',
    },
    {
      key: 'controlled_chat',
      label: 'Chat VIASEE',
      state: pro && hasFeature(entitlement, 'provider_chat.access') ? 'conditional' : 'limited',
      detail: pro
        ? 'Chatul devine activ numai dupa deschiderea explicita de catre client.'
        : 'Chatul controlat necesita plan Pro.',
    },
    {
      key: 'phone_access',
      label: 'Acces la telefon',
      state: pro && hasFeature(entitlement, 'provider_contact.access_after_consent') ? 'conditional' : 'limited',
      detail: pro
        ? 'Telefonul poate fi accesat numai dupa acord separat al clientului.'
        : 'Accesul la telefon necesita plan Pro si acordul clientului.',
    },
  ];

  const blockers = [];
  if (!published) blockers.push('Locatia nu este publicata.');
  if (suspended) blockers.push('Profilul este suspendat.');
  if (!controlled) blockers.push('Profilul nu este inca revendicat sau verificat.');
  if (!pro) blockers.push('Planul curent este Free.');

  return {
    contract_version: PROVIDER_STATUS_CENTER_CONTRACT_VERSION,
    overall_state: suspended ? 'blocked' : published ? (pro ? 'ready' : 'limited') : 'setup_required',
    overall_label: suspended
      ? 'Acces blocat'
      : published
        ? (pro ? 'Locatie pregatita' : 'Locatie activa cu acces limitat')
        : 'Configurare necesara',
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
