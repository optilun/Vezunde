export const COMMUNICATION_EVENT_CATALOG_VERSION = 'communication-events-v1';

export const COMMUNICATION_EVENT_KEYS = Object.freeze({
  PROVIDER_LEAD_AVAILABLE: 'provider_lead_available',
  PATIENT_PROVIDER_RESPONSE_RECEIVED: 'patient_provider_response_received',
});

const EVENT_DEFINITIONS = Object.freeze({
  [COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
    recipient_type: 'provider_user',
    channel: 'email',
    priority: 'high',
    template_version: 'provider-lead-available-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'high',
    template_version: 'patient-provider-response-v1',
  }),
});

const PROVIDER_LEAD_NOTIFICATION_ROLES = new Set(['organization_owner', 'location_manager']);

const RESPONSE_LABELS = Object.freeze({
  can_help: 'poate ajuta',
  needs_details: 'are nevoie de cateva detalii suplimentare',
  cannot_help: 'nu poate prelua aceasta cerere',
});

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

export function communicationEventDefinition(eventKey) {
  return EVENT_DEFINITIONS[clean(eventKey, 100)] || null;
}

export function canReceiveProviderLeadEmail(role) {
  return PROVIDER_LEAD_NOTIFICATION_ROLES.has(clean(role, 80));
}

export function buildProviderLeadAvailableEmail({ locationName, city, intentLabel }) {
  const safeLocation = clean(locationName) || 'locatia ta';
  const safeCity = clean(city) || 'localitatea selectata';
  const safeIntent = clean(intentLabel) || 'o cerere noua';
  return {
    subject: `Cerere noua relevanta pentru ${safeLocation}`,
    body: [
      'Buna ziua,',
      '',
      `O cerere noua relevanta este disponibila pentru ${safeLocation}.`,
      `Categorie: ${safeIntent}`,
      `Localitate: ${safeCity}`,
      '',
      'Datele de contact ale clientului nu sunt incluse. Deschide VIASEE si acceseaza Inbox furnizor pentru detalii si actiunile permise planului locatiei.',
      '',
      'Acest email nu confirma o programare si nu contine recomandari medicale.',
      '',
      'Echipa VIASEE',
    ].join('\n'),
  };
}

export function buildPatientProviderResponseEmail({ publicReference, locationName, responseType }) {
  const safeReference = clean(publicReference, 120);
  const safeLocation = clean(locationName) || 'O locatie';
  const responseLabel = RESPONSE_LABELS[clean(responseType, 80)] || 'a trimis un raspuns';
  return {
    subject: `Raspuns nou la cererea VIASEE${safeReference ? ` ${safeReference}` : ''}`,
    body: [
      'Buna ziua,',
      '',
      `${safeLocation} ${responseLabel}.`,
      safeReference ? `Referinta cererii: ${safeReference}` : '',
      '',
      'Revino in pagina cererii din acelasi browser si foloseste butonul de actualizare pentru a vedea raspunsul structurat.',
      'Datele tale de contact nu sunt distribuite prin acest email. Distribuirea lor necesita acord separat pentru fiecare locatie.',
      '',
      'Acest mesaj nu reprezinta un diagnostic, o recomandare medicala sau confirmarea unei programari.',
      '',
      'Echipa VIASEE',
    ].filter(Boolean).join('\n'),
  };
}
