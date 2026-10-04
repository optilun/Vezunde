// 2026-10-04 (structura conturilor, pasul 5). Cererea de pacient se deschide si din cont, fara
// linkul din email.
//
// Pana acum, pagina cererii se deschidea doar cu tokenul din linkul securizat (hash-ul lui sta in
// `PatientRequestContact.access_token_hash`). Un pacient logat, pe alt dispozitiv, nu isi putea
// deschide propria cerere. Acum, contul care a trimis cererea (`requester_user_id`, pus de server
// la creare) poate cere un acces nou: un token aleator, valabil 30 de zile, al carui hash se
// adauga in `account_access_grants`. Linkul din email ramane valabil, neschimbat.
//
// Toate functiile cererii verifica tokenul prin `findPatientRequestContactForToken`: intai ca
// inainte (hash-ul linkului), apoi printre accesele din cont neexpirate.

export const ACCOUNT_ACCESS_GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_ACCOUNT_ACCESS_GRANTS = 5;

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function activeAccountAccessGrants(contact, now = Date.now()) {
  const grants = Array.isArray(contact?.account_access_grants) ? contact.account_access_grants : [];
  return grants.filter((grant) => {
    const expiresAt = Date.parse(String(grant?.expires_at || ''));
    return clean(grant?.token_hash, 128).length === 64 && Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export function contactMatchesAccessTokenHash(contact, tokenHash, now = Date.now()) {
  if (!contact || !tokenHash) return false;
  if (contact.access_token_hash === tokenHash) return true;
  return activeAccountAccessGrants(contact, now).some((grant) => grant.token_hash === tokenHash);
}

// Intoarce contactul activ al cererii pentru token sau null. Interogarea veche ramane prima, deci
// linkurile din email merg exact ca inainte.
export async function findPatientRequestContactForToken(svc, requestId, accessToken, sort = null) {
  const token = clean(accessToken, 200);
  if (!svc || !requestId || !token) return null;
  const tokenHash = await sha256Hex(token);
  const direct = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    access_token_hash: tokenHash,
    status: 'active',
  }, sort, 2);
  if (direct[0]) return direct[0];
  const rows = await svc.entities.PatientRequestContact.filter({ request_id: requestId, status: 'active' }, sort, 10);
  return rows.find((contact) => contact.request_id === requestId && contactMatchesAccessTokenHash(contact, tokenHash)) || null;
}

export function createAccountAccessToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

// Lista noua de accese: cel nou primul, doar cele neexpirate, cel mult MAX_ACCOUNT_ACCESS_GRANTS
// (cate un dispozitiv pe rand; cel mai vechi iese primul).
export function nextAccountAccessGrants(contact, { tokenHash, userId, now = Date.now() }) {
  const grant = {
    token_hash: tokenHash,
    user_id: clean(userId, 120),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ACCOUNT_ACCESS_GRANT_TTL_MS).toISOString(),
  };
  return [grant, ...activeAccountAccessGrants(contact, now)].slice(0, MAX_ACCOUNT_ACCESS_GRANTS);
}
