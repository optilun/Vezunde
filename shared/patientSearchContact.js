// Datele de contact cerute la fiecare cautare, inainte de rezultate.
//
// 2026-09-27, cererea owner-ului: "la fiecare cautare sa ceara date: email, nr de telefon, nume,
// varsta. Chiar daca nu continua, macar sa ii luam datele." Deciziile owner-ului, din aceeasi zi:
//  - pasul se poate sari ("Sari peste", discret). Un acord cerut ca pret pentru rezultate nu ar fi
//    dat liber (GDPR art. 7 alin. 4), iar cine nu vrea sa lase datele ar pleca de tot;
//  - obligatorii sunt numele si emailul sau telefonul; varsta e optionala.
//
// Reguli:
//  - datele pleaca spre server doar cand pacientul apasa "Continua" cu acordul bifat. Nimic nu se
//    trimite in timp ce scrie si nimic nu se pastreaza daca sare pasul;
//  - raman la VIASEE (entitatea PatientSearchContact, acces doar pentru admin). Nu ajung la
//    locatii, la modelul AI sau in potrivire. Cererea catre locatii are acordurile ei, separate;
//  - varsta este a persoanei care completeaza sau, cand cauta pentru altcineva, a acelei persoane.
//    La copii nu o cerem: varsta copilului e deja intrebata in chestionar;
//  - sub 16 ani, datele unei persoane care cauta pentru sine le completeaza un parinte. In Romania,
//    16 ani este varsta de la care o persoana isi poate da singura acordul online;
//  - pastrare: 2026-09-28, decizia owner-ului ("nu stergem datele clientilor, le pastram"). Nu
//    exista stergere automata; datele raman pana cand persoana isi retrage acordul sau cere
//    stergerea (politica de confidentialitate, sectiunea "Datele lasate in timpul unei cautari");
//  - oferte: 2026-09-28, aprobat de owner. Acordul pentru salvare acopera doar contactul despre
//    acea cautare. Noutatile si ofertele pe email sau telefon cer un acord separat, optional si
//    nebifat implicit (GDPR art. 7; Legea 506/2004 art. 12). Refuzul nu blocheaza salvarea.
//    Nu exista o bifa "sunt de acord cu politica de confidentialitate": politica se citeste
//    (link sub bife), nu se accepta.
//
// Folosit de ecranul src/components/intake2/PatientSearchContact.jsx (validare in browser) si de
// base44/functions/createPatientRequest/entry.ts (validare pe server). Copie identica in
// base44/shared/.

export const PATIENT_SEARCH_CONTACT_MODE = 'save_search_contact';
export const PATIENT_SEARCH_CONTACT_CONSENT_VERSION = 'patient-search-contact-v1';
export const PATIENT_SEARCH_CONTACT_MARKETING_CONSENT_VERSION = 'patient-search-contact-marketing-v1';
export const PATIENT_SEARCH_CONTACT_RETENTION_POLICY_KEY = 'patient-search-contact-until-withdrawal-v1';
export const PATIENT_SEARCH_CONTACT_MIN_SELF_AGE = 16;

export class PatientSearchContactValidationError extends Error {
  constructor(message, field = '') {
    super(message);
    this.name = 'PatientSearchContactValidationError';
    this.field = field;
  }
}

function clean(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const FOR_WHOM_VALUES = new Set(['adult', 'copil', 'other_adult']);

// Aceleasi valori ca PatientRequest.for_whom. Cheia `child` din catalogul nou devine `copil`.
export function normalizeSearchContactForWhom(value) {
  const raw = clean(value, 40);
  if (raw === 'child') return 'copil';
  return FOR_WHOM_VALUES.has(raw) ? raw : '';
}

// A cui este varsta: `contact` (cine completeaza), `patient` (persoana pentru care cauta) sau
// null cand nu o cerem (copil).
export function searchContactAgeRefersTo(forWhom) {
  const who = normalizeSearchContactForWhom(forWhom);
  if (who === 'copil') return null;
  return who === 'other_adult' ? 'patient' : 'contact';
}

function normalizeAge(rawAge, ageRefersTo) {
  if (!ageRefersTo || rawAge === undefined || rawAge === null || String(rawAge).trim() === '') return null;
  const age = Number(String(rawAge).trim());
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    throw new PatientSearchContactValidationError('Scrie vârsta în ani, ca număr.', 'age');
  }
  if (ageRefersTo === 'contact' && age < PATIENT_SEARCH_CONTACT_MIN_SELF_AGE) {
    throw new PatientSearchContactValidationError('Sub 16 ani, datele le completează un părinte.', 'age');
  }
  return age;
}

/**
 * @param {{ contact?: any, search?: any, consent?: any }} [input]
 */
export function sanitizePatientSearchContact(input = {}) {
  const contact = objectOrEmpty(input.contact);
  const search = objectOrEmpty(input.search);
  const consent = objectOrEmpty(input.consent);

  const name = clean(contact.name ?? contact.contact_name, 120);
  if (name.length < 2) {
    throw new PatientSearchContactValidationError('Completează numele.', 'name');
  }
  const email = clean(contact.email ?? contact.contact_email, 254).replace(/\s/g, '').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PatientSearchContactValidationError('Adresa de email nu pare corectă.', 'email');
  }
  const phone = clean(contact.phone ?? contact.contact_phone, 32).replace(/[^0-9+()\-\s]/g, '').trim();
  const phoneDigits = phone.replace(/\D/g, '').length;
  if (phone && (phoneDigits < 7 || phoneDigits > 15)) {
    throw new PatientSearchContactValidationError('Numărul de telefon nu pare corect.', 'phone');
  }
  if (!email && !phone) {
    throw new PatientSearchContactValidationError('Completează emailul sau numărul de telefon.', 'contact');
  }

  const forWhom = normalizeSearchContactForWhom(search.for_whom);
  const ageRefersTo = searchContactAgeRefersTo(forWhom);
  const age = normalizeAge(contact.age ?? contact.age_years, ageRefersTo);

  if (consent.processing !== true) {
    throw new PatientSearchContactValidationError('Bifează acordul, ca să putem păstra datele.', 'consent');
  }
  if (consent.version !== PATIENT_SEARCH_CONTACT_CONSENT_VERSION) {
    throw new PatientSearchContactValidationError('Versiunea acordului nu este acceptată.', 'consent');
  }
  // Acordul pentru oferte e optional: doar un `true` explicit, pe textul curent, conteaza.
  const marketing = consent.marketing === true;
  if (marketing && consent.marketing_version !== PATIENT_SEARCH_CONTACT_MARKETING_CONSENT_VERSION) {
    throw new PatientSearchContactValidationError('Versiunea acordului pentru oferte nu este acceptată.', 'marketing');
  }

  return {
    contact: {
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      age_years: age,
      age_refers_to: age === null ? '' : ageRefersTo,
    },
    search: {
      intent: clean(search.intent, 80),
      intent_label: clean(search.intent_label, 120),
      for_whom: forWhom,
      city: clean(search.city, 120),
      county: clean(search.county, 120),
      locality_siruta_code: clean(search.locality_siruta_code, 40),
      timing_key: clean(search.timing_key, 60),
      search_key: clean(search.search_key, 160),
    },
    consent: {
      processing: true,
      version: PATIENT_SEARCH_CONTACT_CONSENT_VERSION,
      marketing,
      marketing_version: marketing ? PATIENT_SEARCH_CONTACT_MARKETING_CONSENT_VERSION : '',
    },
  };
}
