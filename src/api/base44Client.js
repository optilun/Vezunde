import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

const originalInvoke = client.functions.invoke.bind(client.functions);

function empty(value) {
  return value === null || value === undefined || value === '';
}

function sameValue(left, right) {
  if (empty(left) || empty(right)) return empty(left) && empty(right);
  if (typeof left === 'number' || typeof right === 'number') {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  return String(left).trim() === String(right).trim();
}

function locationValues(location = {}) {
  return {
    public_display_name: location.public_display_name || location.name || '',
    address: location.address || '',
    public_phone: location.public_phone || location.phone_public || '',
    public_email: location.public_email || '',
    lat: location.lat ?? null,
    lng: location.lng ?? null,
    place_id: location.place_id || '',
  };
}

function organizationValues(organization = {}) {
  return {
    public_display_name: organization.public_display_name || '',
    public_description: organization.public_description || '',
    public_phone: organization.public_phone || '',
    public_email: organization.public_email || '',
    website_url: organization.website_url || organization.website || '',
    facebook_url: organization.facebook_url || '',
    instagram_url: organization.instagram_url || '',
    linkedin_url: organization.linkedin_url || '',
  };
}

function payloadMatchesCurrent(payload = {}, current = {}) {
  const entries = Object.entries(payload || {});
  return entries.length > 0 && entries.every(([key, value]) => sameValue(value, current[key]));
}

async function loadWorkspaceOverview(locationId) {
  if (!locationId) return null;
  const response = await originalInvoke('getProviderWorkspaceOverview', { location_id: locationId }).catch(() => null);
  return response?.data || null;
}

async function unchangedDraftMessage(functionName, input = {}) {
  const action = input.action;
  if (!['create_draft', 'update_draft'].includes(action) || !input.payload) return '';

  const guardsLocationDetails = functionName === 'submitProviderWorkspaceChange'
    && input.section === 'location_details'
    && input.location_id;
  const guardsOrganizationProfile = functionName === 'manageProviderOrganizationProfile'
    && input.organization_id
    && input.location_id;

  if (!guardsLocationDetails && !guardsOrganizationProfile) return '';

  const overview = await loadWorkspaceOverview(input.location_id);
  if (!overview) return '';

  if (guardsLocationDetails && payloadMatchesCurrent(input.payload, locationValues(overview.location || {}))) {
    return 'Nu exista modificari noi de salvat.';
  }

  if (guardsOrganizationProfile && payloadMatchesCurrent(input.payload, organizationValues(overview.organization || {}))) {
    return 'Nu exista modificari noi de salvat.';
  }

  return '';
}

async function guardedInvoke(functionName, input = {}, ...rest) {
  const unchangedMessage = await unchangedDraftMessage(functionName, input);
  if (unchangedMessage) {
    return { data: { error: unchangedMessage, no_changes: true, message: unchangedMessage } };
  }

  const response = await originalInvoke(functionName, input, ...rest);
  if (response?.data?.no_changes && !response.data.error) {
    return {
      ...response,
      data: {
        ...response.data,
        error: response.data.message || 'Nu exista modificari noi de salvat.',
      },
    };
  }
  return response;
}

const functions = new Proxy(client.functions, {
  get(target, property, receiver) {
    if (property === 'invoke') return guardedInvoke;
    return Reflect.get(target, property, receiver);
  },
});

export const base44 = new Proxy(client, {
  get(target, property, receiver) {
    if (property === 'functions') return functions;
    return Reflect.get(target, property, receiver);
  },
});