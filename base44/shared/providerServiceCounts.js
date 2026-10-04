// Numărul de servicii aprobate ale unei locații (2026-10-04, audit cont organizație, #18).
//
// Prezentarea arăta „26 servicii publicate”, iar modulul Servicii 21. Două cauze:
// 1. „Opțiunile locației” (grupa business_attributes: consultații la domiciliu, testare la sediul
//    firmelor etc.) sunt rânduri LocationService, dar modulul Servicii le arată separat de servicii.
// 2. LocationSpecialization este oglinda serviciilor din grupa „specialties” (vezi applyServices în
//    directoryOps/adminServiceConfigurationReview.ts); adunate, se numărau de două ori.
// Aici se numără cheile unice și se separă opțiunile locației. Nu decide nimic despre potrivire.
import { getCanonicalServiceDefinition } from './canonicalServiceRegistryExtended.js';

function clean(value) {
  return String(value || '').trim();
}

function approvedServiceKeys(services = [], specialties = []) {
  const keys = new Set();
  for (const row of services || []) keys.add(clean(row?.service_key) || `service:${row?.id}`);
  for (const row of specialties || []) keys.add(clean(row?.specialization_key) || `specialty:${row?.id}`);
  return keys;
}

export function isLocationOptionServiceKey(key) {
  return getCanonicalServiceDefinition(key)?.group === 'business_attributes';
}

// Totalul (servicii + opțiunile locației), fără dubluri. Folosit și de regula de completare.
export function countApprovedServiceKeys(services = [], specialties = []) {
  return approvedServiceKeys(services, specialties).size;
}

// Ca în modulul Servicii: serviciile oferite, separat de opțiunile locației.
export function splitApprovedServiceCounts(services = [], specialties = []) {
  let options = 0;
  let offered = 0;
  for (const key of approvedServiceKeys(services, specialties)) {
    if (isLocationOptionServiceKey(key)) options += 1;
    else offered += 1;
  }
  return { services: offered, location_options: options };
}
