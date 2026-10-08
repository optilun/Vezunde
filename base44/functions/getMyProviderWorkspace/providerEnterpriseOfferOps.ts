// Oferte Enterprise (structura conturilor, pasul 4, 2026-10-04, aprobat de Alex).
//
// Adminul VIASEE face oferta: organizatia, suma lunara si contractul PDF (fisier privat). Proprietarul
// organizatiei vede oferta in facturare, citeste contractul, il accepta si plateste cu cardul
// (createProviderCheckoutSession cu offer_id). De atunci Stripe incaseaza automat suma in fiecare luna.
//
// Actiuni admin: admin_search_organizations, admin_create, admin_list, admin_cancel.
// Actiune proprietar sau admin: contract_url (link temporar catre contract).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { safeBillingReturnBaseUrl } from '../../shared/providerBillingPolicy.js';
import {
  authorizeOrganizationBillingOwner,
  billableLocationCount,
  loadOrganizationLocations,
} from '../../shared/providerOrganizationBilling.js';
import { PROVIDER_OWNER_ROLE, providerAccessRoleFromMembership } from '../../shared/providerRolePolicy.js';

const MAX_MONTHLY_RON = 100000;

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function normalize(value) { return clean(value, 300).toLocaleLowerCase('ro').normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function offerView(offer, organizationName = '') {
  return {
    id: offer.id, organization_id: offer.organization_id, organization_name: organizationName,
    monthly_amount_ron: Number(offer.monthly_amount_ron) || 0, status: offer.status, note: offer.note || '',
    contract_file_name: offer.contract_file_name || 'Contract.pdf', expires_at: offer.expires_at || null,
    created_date: offer.created_date || null, contract_accepted_at: offer.contract_accepted_at || null,
    accepted_at: offer.accepted_at || null, stripe_subscription_id: offer.stripe_subscription_id || '',
  };
}

async function audit(svc, user, offer, actionType, next, note) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderEnterpriseOffer', entity_id: offer.id, action_type: actionType,
    changed_fields: Object.keys(next || {}), previous_values: '{}', new_values: JSON.stringify(next || {}),
    admin_user_id: user.id, admin_email: user.email || '', note: note || '', performed_at: new Date().toISOString(),
  }).catch(() => null);
}

async function organizationOwners(svc, organizationId) {
  const locations = await loadOrganizationLocations(svc, organizationId);
  const locationIds = new Set(locations.map((location) => location.id));
  const rows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId, status: 'active' }, '-created_date', 500).catch(() => []);
  const ids = [...new Set(rows.filter((row) => providerAccessRoleFromMembership(row) === PROVIDER_OWNER_ROLE
    && (row.organization_id === organizationId || locationIds.has(row.location_id))).map((row) => row.user_id).filter(Boolean))];
  const users = [];
  for (const id of ids.slice(0, 5)) {
    const user = await svc.entities.User.get(id).catch(() => null);
    if (user?.email) users.push(user);
  }
  return users;
}

async function notifyOwners(base44, svc, organization, offer, baseUrl) {
  const owners = await organizationOwners(svc, organization.id);
  const link = `${baseUrl}/contul-meu?mode=provider&s=settings&tab=billing&organization=${encodeURIComponent(organization.id)}`;
  const name = organization.public_display_name || organization.name || 'organizatia ta';
  let sent = 0;
  for (const owner of owners) {
    try {
      await base44.integrations.Core.SendEmail({
        to: owner.email,
        from_name: 'VIASEE',
        subject: `Oferta VIASEE Enterprise pentru ${name}`,
        body: [
          'Buna ziua,',
          '',
          `Ai primit oferta VIASEE Enterprise pentru ${name}: ${Number(offer.monthly_amount_ron).toLocaleString('ro-RO')} lei pe luna.`,
          'Contractul si butonul de acceptare sunt in contul tau, la Setari -> Abonament si facturare:',
          link,
          '',
          'Dupa ce accepti contractul, platesti o singura data cu cardul; suma se incaseaza apoi automat in fiecare luna.',
          '',
          'Echipa VIASEE',
        ].join('\n'),
      });
      sent++;
    } catch (_error) { /* notificarea e best effort; oferta ramane vizibila in cont */ }
  }
  return sent;
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return res({ error: 'Autentificare necesară.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action, 60);

    if (action === 'contract_url') {
      const offer = await svc.entities.ProviderEnterpriseOffer.get(clean(input.offer_id, 120)).catch(() => null);
      if (!offer) return res({ error: 'Oferta nu a fost găsită.' }, 404);
      const authorized = await authorizeOrganizationBillingOwner(svc, user, { organizationId: offer.organization_id });
      if (authorized.error) return res({ error: authorized.error }, authorized.status);
      const signed = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: offer.contract_file_uri, expires_in: 900 }).catch(() => null);
      const url = signed?.signed_url || signed?.url || '';
      if (!url) return res({ error: 'Contractul nu poate fi deschis acum. Reîncearcă.' }, 502);
      return res({ url });
    }

    if (user.role !== 'admin') return res({ error: 'Acces rezervat administratorului.' }, 403);

    if (action === 'admin_search_organizations') {
      const query = normalize(input.q);
      if (query.length < 2) return res({ organizations: [] });
      const organizations = [];
      for (let skip = 0; skip < 6000; skip += 500) {
        const page = await svc.entities.ProviderOrganization.filter({}, 'name', 500, skip);
        organizations.push(...page);
        if (page.length < 500) break;
      }
      const matches = organizations
        .filter((organization) => normalize(`${organization.public_display_name || ''} ${organization.name || ''} ${organization.legal_name || ''}`).includes(query) || organization.id === clean(input.q, 120))
        .slice(0, 15);
      const result = [];
      for (const organization of matches) {
        const locations = await loadOrganizationLocations(svc, organization.id);
        result.push({ id: organization.id, name: organization.public_display_name || organization.name || organization.id, legal_name: organization.legal_name || '', active_location_count: billableLocationCount(locations) });
      }
      return res({ organizations: result });
    }

    if (action === 'admin_list') {
      const query = clean(input.organization_id, 120) ? { organization_id: clean(input.organization_id, 120) } : {};
      const offers = await svc.entities.ProviderEnterpriseOffer.filter(query, '-created_date', 100);
      const names = new Map();
      for (const offer of offers) {
        if (!names.has(offer.organization_id)) {
          const organization = await svc.entities.ProviderOrganization.get(offer.organization_id).catch(() => null);
          names.set(offer.organization_id, organization?.public_display_name || organization?.name || offer.organization_id);
        }
      }
      return res({ offers: offers.map((offer) => offerView(offer, names.get(offer.organization_id))) });
    }

    if (action === 'admin_create') {
      const organizationId = clean(input.organization_id, 120);
      const organization = organizationId ? await svc.entities.ProviderOrganization.get(organizationId).catch(() => null) : null;
      if (!organization) return res({ error: 'Alege organizația.' }, 400);
      const amount = Math.round(Number(String(input.monthly_amount_ron ?? '').replace(',', '.')) * 100) / 100;
      if (!Number.isFinite(amount) || amount < 1 || amount > MAX_MONTHLY_RON) return res({ error: 'Suma lunară trebuie să fie între 1 și 100.000 lei.' }, 400);
      const contractFileUri = clean(input.contract_file_uri, 2000);
      if (!contractFileUri) return res({ error: 'Încarcă contractul (PDF) înainte de a trimite oferta.' }, 400);
      const validDays = Math.min(Math.max(Number(input.valid_days) || 30, 1), 180);
      const now = new Date();
      // O singura oferta deschisa pe organizatie: cele nefolosite inca devin inlocuite. Ofertele deja
      // acceptate (cu abonament) nu se ating.
      const open = await svc.entities.ProviderEnterpriseOffer.filter({ organization_id: organization.id, status: 'sent' }, '-created_date', 50);
      for (const previous of open) await svc.entities.ProviderEnterpriseOffer.update(previous.id, { status: 'superseded' });
      const offer = await svc.entities.ProviderEnterpriseOffer.create({
        organization_id: organization.id,
        monthly_amount_ron: amount,
        currency: 'ron',
        contract_file_uri: contractFileUri,
        contract_file_name: clean(input.contract_file_name, 200) || 'Contract.pdf',
        note: clean(input.note, 1000),
        status: 'sent',
        expires_at: new Date(now.getTime() + validDays * 86400000).toISOString(),
        created_by_user_id: user.id,
      });
      await audit(svc, user, offer, 'create_enterprise_offer', { organization_id: organization.id, monthly_amount_ron: amount, valid_days: validDays, superseded: open.map((row) => row.id) }, 'Oferta Enterprise trimisa');
      const notified = await notifyOwners(base44, svc, organization, offer, safeBillingReturnBaseUrl(input.app_base_url));
      return res({ offer: offerView(offer, organization.public_display_name || organization.name || ''), notified_owner_count: notified, superseded_count: open.length });
    }

    if (action === 'admin_cancel') {
      const offer = await svc.entities.ProviderEnterpriseOffer.get(clean(input.offer_id, 120)).catch(() => null);
      if (!offer) return res({ error: 'Oferta nu a fost găsită.' }, 404);
      if (offer.status !== 'sent') return res({ error: 'Doar o ofertă neacceptată poate fi retrasă. Un abonament activ se gestionează din Stripe.' }, 409);
      await svc.entities.ProviderEnterpriseOffer.update(offer.id, { status: 'canceled', canceled_at: new Date().toISOString(), canceled_by_user_id: user.id });
      await audit(svc, user, offer, 'cancel_enterprise_offer', { status: 'canceled' }, 'Oferta Enterprise retrasa');
      return res({ ok: true });
    }

    return res({ error: 'Acțiune necunoscută.' }, 400);
  } catch (_error) {
    return res({ error: 'Ofertele Enterprise nu au putut fi actualizate. Reîncearcă.' }, 500);
  }
}
