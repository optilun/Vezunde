export const COMMUNICATION_EVENT_CATALOG_VERSION = 'communication-events-v2';

export const COMMUNICATION_EVENT_KEYS = Object.freeze({
  PROVIDER_LEAD_AVAILABLE: 'provider_lead_available',
  PATIENT_REQUEST_RECEIVED: 'patient_request_received',
  PATIENT_REQUEST_DISTRIBUTED: 'patient_request_distributed',
  PATIENT_PROVIDER_RESPONSE_RECEIVED: 'patient_provider_response_received',
  PATIENT_REQUEST_RESOLVED: 'patient_request_resolved',
  PATIENT_REQUEST_CLOSED: 'patient_request_closed',
});

const EVENT_DEFINITIONS = Object.freeze({
  [COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
    recipient_type: 'provider_user',
    channel: 'email',
    priority: 'high',
    template_version: 'provider-lead-available-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RECEIVED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RECEIVED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'normal',
    template_version: 'patient-request-received-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_DISTRIBUTED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_DISTRIBUTED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'normal',
    template_version: 'patient-request-distributed-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'high',
    template_version: 'patient-provider-response-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RESOLVED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RESOLVED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'normal',
    template_version: 'patient-request-resolved-v1',
  }),
  [COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_CLOSED]: Object.freeze({
    event_key: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_CLOSED,
    recipient_type: 'patient_contact',
    channel: 'email',
    priority: 'normal',
    template_version: 'patient-request-closed-v1',
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

function patientReferenceLine(publicReference) {
  const reference = clean(publicReference, 120);
  return reference ? `Referinta cererii: ${reference}` : '';
}

function patientEmail({ subject, publicReference, lines }) {
  return {
    subject,
    body: [
      'Buna ziua,',
      '',
      ...lines,
      patientReferenceLine(publicReference),
      '',
      'Revino in pagina securizata a cererii pentru status, raspunsuri si actiunile disponibile.',
      'VIASEE nu distribuie automat numarul tau de telefon si nu confirma programari prin aceste mesaje.',
      '',
      'Echipa VIASEE',
    ].filter(Boolean).join('\n'),
  };
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

export function buildPatientRequestReceivedEmail({ publicReference, city }) {
  const safeCity = clean(city) || 'localitatea selectata';
  return patientEmail({
    subject: `Cererea VIASEE a fost salvata${clean(publicReference, 120) ? ` - ${clean(publicReference, 120)}` : ''}`,
    publicReference,
    lines: [
      'Cererea ta a fost salvata in siguranta.',
      `Zona selectata: ${safeCity}.`,
      'Cererea nu este trimisa locatiilor pana cand confirmi separat distribuirea.',
    ],
  });
}

export function buildPatientRequestDistributedEmail({ publicReference, leadCount }) {
  const count = Math.max(0, Number(leadCount) || 0);
  return patientEmail({
    subject: `Cererea VIASEE a fost distribuita${clean(publicReference, 120) ? ` - ${clean(publicReference, 120)}` : ''}`,
    publicReference,
    lines: [
      count === 1
        ? 'Rezumatul cererii a fost pus la dispozitia unei locatii eligibile.'
        : `Rezumatul cererii a fost pus la dispozitia a ${count} locatii eligibile.`,
      'Datele complete si telefonul raman protejate conform acordurilor tale.',
    ],
  });
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

export function buildPatientRequestLifecycleEmail({ publicReference, state }) {
  const resolved = state === 'resolved';
  return patientEmail({
    subject: `${resolved ? 'Cererea VIASEE a fost marcata ca rezolvata' : 'Cererea VIASEE a fost inchisa'}${clean(publicReference, 120) ? ` - ${clean(publicReference, 120)}` : ''}`,
    publicReference,
    lines: [
      resolved
        ? 'Ai marcat cererea ca rezolvata. Raspunsurile si istoricul raman disponibile.'
        : 'Ai inchis cererea. Locatiile nu mai pot trimite raspunsuri sau mesaje noi.',
      'Aceasta actiune nu reprezinta confirmarea unei programari sau a unui rezultat medical.',
    ],
  });
}
