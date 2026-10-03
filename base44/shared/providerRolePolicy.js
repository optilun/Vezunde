// Rolurile din contul unei organizatii (structura conturilor, pasul 3, 2026-10-03, aprobat de Alex).
//
// Sursa unica a matricei „rol -> ce poate”, folosita de functiile backend (base44/shared) si de
// interfata (shared/). Cele doua copii trebuie sa fie identice; verifica
// scripts/verify-account-structure-step3.mjs.
//
// Patru roluri, fara „owner selectiv”:
// - Proprietar: toata organizatia, inclusiv locatiile viitoare. Poate tot: abonamentul,
//   proprietarii si administratorii, ascunderea si inchiderea locatiilor.
// - Administrator: toata organizatia, inclusiv locatiile viitoare. Profilul organizatiei, locatii
//   noi, continut, cereri, echipa (manageri si membri). Fara abonament, fara proprietari sau
//   administratori, fara inchiderea locatiilor.
// - Manager locatie: doar locatiile bifate. Datele si continutul locatiei, program, specialisti,
//   cereri si membrii locatiilor lui.
// - Membru: doar locatiile bifate. Cererile pacientilor, programul si statusul „deschis azi”.
//
// Stocarea ramane cea existenta (ProviderMembership.role + organization_role +
// organization_wide_access). Administratorul se salveaza ca `location_manager` cu
// `organization_role: organization_admin` si `organization_wide_access: true`.

export const PROVIDER_ROLE_POLICY_VERSION = 'provider-roles-v2';

export const PROVIDER_OWNER_ROLE = 'organization_owner';
export const PROVIDER_ADMIN_ROLE = 'organization_admin';
export const PROVIDER_MANAGER_ROLE = 'location_manager';
export const PROVIDER_MEMBER_ROLE = 'location_staff';

// Ordinea conteaza: de la rolul cu cele mai multe drepturi la cel cu cele mai putine.
export const PROVIDER_ACCESS_ROLES = Object.freeze([
  PROVIDER_OWNER_ROLE,
  PROVIDER_ADMIN_ROLE,
  PROVIDER_MANAGER_ROLE,
  PROVIDER_MEMBER_ROLE,
]);

export const PROVIDER_ROLE_LABELS = Object.freeze({
  organization_owner: 'Proprietar',
  organization_admin: 'Administrator',
  location_manager: 'Manager locație',
  location_staff: 'Membru',
});

export const PROVIDER_ROLE_DESCRIPTIONS = Object.freeze({
  organization_owner: 'Toată organizația, inclusiv locațiile viitoare. Poate tot: abonamentul, proprietarii și administratorii, ascunderea sau închiderea locațiilor.',
  organization_admin: 'Toată organizația, inclusiv locațiile viitoare. Profilul organizației, locații noi, conținut, cereri și echipa. Fără abonament, fără proprietari sau administratori.',
  location_manager: 'Doar locațiile bifate. Datele și serviciile locației, programul, specialiștii, cererile și membrii acestor locații.',
  location_staff: 'Doar locațiile bifate. Răspunde la cererile pacienților și ține la zi programul și statusul „deschis azi”.',
});

export const PROVIDER_CAPABILITIES = Object.freeze([
  'organization.view',
  'organization.manage_profile',
  'organization.manage_locations',
  'organization.manage_members',
  'organization.manage_privileged_members',
  'organization.manage_settings',
  'organization.manage_billing',
  'location.view',
  'location.manage_profile',
  'location.manage_content',
  'location.manage_specialists',
  'location.manage_requests',
  'location.manage_operational_status',
  'location.manage_members',
  'location.manage_settings',
  'location.manage_lifecycle',
  'location.archive',
  'location.request_closure',
]);

const MEMBER_CAPABILITIES = [
  'organization.view',
  'location.view',
  'location.manage_requests',
  'location.manage_operational_status',
];
const MANAGER_CAPABILITIES = [
  ...MEMBER_CAPABILITIES,
  'location.manage_profile',
  'location.manage_content',
  'location.manage_specialists',
  'location.manage_members',
];
const ADMIN_CAPABILITIES = [
  ...MANAGER_CAPABILITIES,
  'organization.manage_profile',
  'organization.manage_locations',
  'organization.manage_members',
];

function ordered(capabilities) {
  const allowed = new Set(capabilities);
  return Object.freeze(PROVIDER_CAPABILITIES.filter((capability) => allowed.has(capability)));
}

export const PROVIDER_ROLE_CAPABILITIES = Object.freeze({
  organization_owner: ordered(PROVIDER_CAPABILITIES),
  organization_admin: ordered(ADMIN_CAPABILITIES),
  location_manager: ordered(MANAGER_CAPABILITIES),
  location_staff: ordered(MEMBER_CAPABILITIES),
});

// Ce rol poate da fiecare rol. Proprietarul da orice rol; administratorul doar manageri si
// membri; managerul doar membri, la locatiile lui; membrul nu invita pe nimeni.
const ASSIGNABLE_ROLES = Object.freeze({
  organization_owner: Object.freeze([...PROVIDER_ACCESS_ROLES]),
  organization_admin: Object.freeze([PROVIDER_MANAGER_ROLE, PROVIDER_MEMBER_ROLE]),
  location_manager: Object.freeze([PROVIDER_MEMBER_ROLE]),
  location_staff: Object.freeze([]),
  platform_admin: Object.freeze([...PROVIDER_ACCESS_ROLES]),
});

// Randurile tabelului „Ce poate fiecare rol”, in ordinea in care le citeste un client.
export const PROVIDER_ROLE_MATRIX = Object.freeze([
  { key: 'scope', label: 'Locații', values: { organization_owner: 'Toate, și cele viitoare', organization_admin: 'Toate, și cele viitoare', location_manager: 'Doar cele bifate', location_staff: 'Doar cele bifate' } },
  { key: 'requests', label: 'Răspunde la cererile pacienților', capability: 'location.manage_requests' },
  { key: 'hours', label: 'Program și statusul „deschis azi”', capability: 'location.manage_operational_status' },
  { key: 'content', label: 'Datele, serviciile și fotografiile locației', capability: 'location.manage_content' },
  { key: 'specialists', label: 'Specialiștii afișați la locație', capability: 'location.manage_specialists' },
  { key: 'location_members', label: 'Invită membri la locațiile lui', capability: 'location.manage_members' },
  { key: 'organization', label: 'Profilul organizației și locații noi', capability: 'organization.manage_profile' },
  { key: 'team', label: 'Manageri și membri în toată organizația', capability: 'organization.manage_members' },
  { key: 'privileged', label: 'Proprietari și administratori', capability: 'organization.manage_privileged_members' },
  { key: 'billing', label: 'Abonament și facturare', capability: 'organization.manage_billing' },
  { key: 'lifecycle', label: 'Ascunderea sau închiderea locațiilor', capability: 'location.manage_lifecycle' },
]);

function clean(value) {
  return String(value || '').trim();
}

export function normalizeProviderAccessRole(value) {
  const role = clean(value);
  if (role === 'owner') return PROVIDER_OWNER_ROLE;
  if (role === 'admin') return PROVIDER_ADMIN_ROLE;
  if (role === 'manager') return PROVIDER_MANAGER_ROLE;
  if (role === 'staff' || role === 'member') return PROVIDER_MEMBER_ROLE;
  return PROVIDER_ACCESS_ROLES.includes(role) ? role : '';
}

// Rolul de acces al unui rand ProviderMembership (rolul salvat + marcajul de administrator).
// Pastreaza comportamentul vechi: o valoare necunoscuta se intoarce neschimbata.
export function providerAccessRoleFromMembership(membership) {
  if (!membership) return '';
  if (clean(membership.organization_role) === PROVIDER_ADMIN_ROLE && membership.organization_wide_access === true) return PROVIDER_ADMIN_ROLE;
  const storedRole = clean(membership.role);
  if (storedRole === 'owner') return PROVIDER_OWNER_ROLE;
  if (storedRole === 'manager') return PROVIDER_MANAGER_ROLE;
  if (storedRole === 'staff') return PROVIDER_MEMBER_ROLE;
  return storedRole;
}

export function storedRoleForProviderAccessRole(role) {
  const normalized = normalizeProviderAccessRole(role);
  return normalized === PROVIDER_ADMIN_ROLE ? PROVIDER_MANAGER_ROLE : normalized;
}

export function organizationRoleMarkerForProviderAccessRole(role) {
  return normalizeProviderAccessRole(role) === PROVIDER_ADMIN_ROLE ? PROVIDER_ADMIN_ROLE : 'none';
}

export function providerRoleRank(role) {
  const index = PROVIDER_ACCESS_ROLES.indexOf(normalizeProviderAccessRole(role));
  return index === -1 ? PROVIDER_ACCESS_ROLES.length : index;
}

export function highestProviderAccessRole(roles = []) {
  const normalized = new Set((Array.isArray(roles) ? roles : []).map(normalizeProviderAccessRole).filter(Boolean));
  return PROVIDER_ACCESS_ROLES.find((role) => normalized.has(role)) || '';
}

export function capabilitiesForProviderRoles(roles = []) {
  const allowed = new Set();
  for (const role of Array.isArray(roles) ? roles : [roles]) {
    for (const capability of PROVIDER_ROLE_CAPABILITIES[normalizeProviderAccessRole(role)] || []) allowed.add(capability);
  }
  return PROVIDER_CAPABILITIES.filter((capability) => allowed.has(capability));
}

export function providerRoleHasCapability(role, capability) {
  return (PROVIDER_ROLE_CAPABILITIES[normalizeProviderAccessRole(role)] || []).includes(capability);
}

// Proprietarul si administratorul acopera mereu toata organizatia, inclusiv locatiile viitoare.
export function providerRoleCoversOrganization(role) {
  const normalized = normalizeProviderAccessRole(role);
  return normalized === PROVIDER_OWNER_ROLE || normalized === PROVIDER_ADMIN_ROLE;
}

export function assignableProviderRoles(actorRole) {
  const key = clean(actorRole) === 'platform_admin' ? 'platform_admin' : normalizeProviderAccessRole(actorRole);
  return [...(ASSIGNABLE_ROLES[key] || [])];
}

export function canAssignProviderRole(actorRole, role) {
  const normalized = normalizeProviderAccessRole(role);
  return Boolean(normalized) && assignableProviderRoles(actorRole).includes(normalized);
}

// Cine poate schimba accesul cuiva: doar cine i-ar putea da rolul pe care il are acum.
// O persoana fara rol in organizatie poate fi adaugata de oricine poate da macar un rol.
export function canManageProviderMember(actorRole, targetCurrentRole = '') {
  const target = normalizeProviderAccessRole(targetCurrentRole);
  if (!target) return assignableProviderRoles(actorRole).length > 0;
  return canAssignProviderRole(actorRole, target);
}

// Pentru tabelul din interfata: ce afiseaza o celula (text sau da/nu).
export function providerRoleMatrixCell(row, role) {
  if (row?.values) return row.values[normalizeProviderAccessRole(role)] || '';
  return providerRoleHasCapability(role, row?.capability);
}
