import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isPublicProfessionalProfile } from '../../shared/professionalProfileStatus.js';
import { professionalTypeLabel } from '../../shared/professionalIdentity.js';
import { getManyByIds } from '../../shared/providerWorkspaceBatchQueries.js';

// 2026-10-04 (structura conturilor, pasul 5). „Salvate” in contul personal: locatii si specialisti
// salvati de pe paginile lor publice. Inainte, „Locații salvate” era doar un ecran „în pregătire”.
//
// - Se pot salva doar profiluri publice. Daca un profil nu mai e public, ramane in lista cu
//   „nu mai este public”, fara date din profil, si poate fi scos.
// - „Scoate” nu sterge randul: il marcheaza `removed`; o salvare noua il reactiveaza.
// - Lista nu are legatura cu cautarea, recomandarile sau distribuirea cererilor.

export const MY_SAVED_ITEMS_CONTRACT_VERSION = 'my-saved-items-v1';
export const MAX_SAVED_ITEMS = 200;
const ITEM_TYPES = new Set(['location', 'professional']);

function clean(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function httpUrl(value) {
  const raw = clean(value, 2000);
  return /^https:\/\//i.test(raw) ? raw : '';
}

export function isSavableLocation(location) {
  return Boolean(location?.id)
    && location.status === 'publicata'
    && location.public_visibility_status === 'approved'
    && location.active_status !== 'inactiva'
    && location.is_active !== false
    && location.profile_control_status !== 'suspended';
}

function itemView(row, record) {
  const base = { id: row.id, item_type: row.item_type, item_id: row.item_id, saved_at: row.saved_at || row.created_date || null };
  if (row.item_type === 'location') {
    if (!isSavableLocation(record)) return { ...base, available: false };
    return {
      ...base,
      available: true,
      name: clean(record.public_display_name || record.name || 'Locație', 180),
      provider_type: clean(record.provider_type, 80),
      provider_profile_type: clean(record.provider_profile_type, 80),
      // Ca pe pagina publica a locatiei (`city`); `locality_name` din SIRUTA poate avea alta scriere.
      locality: clean(record.city || record.locality_name, 120),
      photo_url: httpUrl(record.photo_url),
      url: `/furnizor/${record.id}`,
    };
  }
  if (!isPublicProfessionalProfile(record)) return { ...base, available: false };
  return {
    ...base,
    available: true,
    name: clean(record.public_display_name || record.full_name || 'Specialist', 180),
    type_label: professionalTypeLabel(record.professional_type) || 'Specialist',
    photo_url: httpUrl(record.profile_photo_url),
    url: `/specialist/${record.id}`,
  };
}

async function loadRecord(svc, itemType, itemId) {
  const entity = itemType === 'location' ? svc.entities.ProviderLocation : svc.entities.ProfessionalProfile;
  return entity.get(itemId).catch(() => null);
}

async function findRow(svc, userId, itemType, itemId) {
  const rows = await svc.entities.SavedItem.filter({ user_id: userId, item_type: itemType, item_id: itemId }, '-created_date', 5);
  return rows.find((row) => row.user_id === userId && row.item_type === itemType && row.item_id === itemId) || null;
}

async function activeRows(svc, userId) {
  const rows = await svc.entities.SavedItem.filter({ user_id: userId, status: 'active' }, '-saved_at', MAX_SAVED_ITEMS);
  return rows.filter((row) => row.user_id === userId && row.status === 'active' && ITEM_TYPES.has(row.item_type));
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);

    if (action === 'list') {
      const rows = await activeRows(svc, user.id);
      const locationIds = rows.filter((row) => row.item_type === 'location').map((row) => row.item_id);
      const professionalIds = rows.filter((row) => row.item_type === 'professional').map((row) => row.item_id);
      const [locations, professionals] = await Promise.all([
        getManyByIds(svc.entities.ProviderLocation, locationIds),
        getManyByIds(svc.entities.ProfessionalProfile, professionalIds),
      ]);
      return Response.json({
        contract_version: MY_SAVED_ITEMS_CONTRACT_VERSION,
        items: rows.map((row) => itemView(row, (row.item_type === 'location' ? locations : professionals).get(row.item_id) || null)),
      });
    }

    const itemType = clean(input.item_type, 40);
    const itemId = clean(input.item_id);
    if (!ITEM_TYPES.has(itemType) || !itemId) return Response.json({ error: 'Alege ce vrei să salvezi.' }, { status: 400 });

    if (action === 'status') {
      const row = await findRow(svc, user.id, itemType, itemId);
      return Response.json({ contract_version: MY_SAVED_ITEMS_CONTRACT_VERSION, saved: row?.status === 'active' });
    }

    if (action === 'save') {
      const record = await loadRecord(svc, itemType, itemId);
      const savable = itemType === 'location' ? isSavableLocation(record) : isPublicProfessionalProfile(record);
      if (!savable) return Response.json({ error: 'Profilul nu este public și nu poate fi salvat.' }, { status: 404 });
      const row = await findRow(svc, user.id, itemType, itemId);
      if (row?.status === 'active') return Response.json({ ok: true, saved: true });
      const active = await activeRows(svc, user.id);
      if (active.length >= MAX_SAVED_ITEMS) {
        return Response.json({ error: `Poți păstra cel mult ${MAX_SAVED_ITEMS} profiluri salvate. Scoate câteva din „Salvate”.` }, { status: 409 });
      }
      const now = new Date().toISOString();
      if (row) await svc.entities.SavedItem.update(row.id, { status: 'active', saved_at: now, removed_at: null });
      else await svc.entities.SavedItem.create({ user_id: user.id, item_type: itemType, item_id: itemId, status: 'active', saved_at: now });
      return Response.json({ ok: true, saved: true });
    }

    if (action === 'remove') {
      const row = await findRow(svc, user.id, itemType, itemId);
      if (row?.status === 'active') await svc.entities.SavedItem.update(row.id, { status: 'removed', removed_at: new Date().toISOString() });
      return Response.json({ ok: true, saved: false });
    }

    return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });
  } catch (_error) {
    return Response.json({ error: 'Salvatele nu au putut fi actualizate. Încearcă din nou.' }, { status: 500 });
  }
}
