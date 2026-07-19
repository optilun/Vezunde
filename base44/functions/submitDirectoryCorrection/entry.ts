import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUEST_TYPES = [
  'incorrect_information',
  'location_closed',
  'location_moved',
  'duplicate_profile',
  'wrong_organization',
  'personal_data_removal',
  'other',
];
const RELATIONSHIPS = [
  'customer',
  'owner',
  'organization_representative',
  'employee',
  'professional',
  'other',
];
const ACTIVE_STATUSES = ['submitted', 'in_review', 'needs_more_info', 'approved'];
const HIGH_PRIORITY_TYPES = ['location_closed', 'personal_data_removal'];

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown, maxLength = 2000) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  return text(value, 200).toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}***@${domain}`;
}

function safeUrl(value: unknown) {
  const raw = text(value, 500);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function cleanEvidenceUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(safeUrl).filter(Boolean))].slice(0, 5);
}

function safeProposedChanges(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowedFields = ['name', 'address', 'phone', 'email', 'website', 'opening_hours', 'organization_name', 'duplicate_location_id', 'new_address'];
  const result: Record<string, string> = {};
  for (const key of allowedFields) {
    const cleaned = text((value as Record<string, unknown>)[key], 500);
    if (cleaned) result[key] = cleaned;
  }
  return result;
}

function createReference() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
  return `VCR-${token}`;
}

async function uniqueReference(svc: any) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createReference();
    const matches = await svc.entities.DirectoryCorrectionRequest.filter({ public_reference: candidate }, '-created_date', 1).catch(() => []);
    if (matches.length === 0) return candidate;
  }
  return `VCR-${Date.now().toString(36).toUpperCase()}`;
}

async function currentUser(base44: any) {
  try {
    return await base44.auth.me();
  } catch (_error) {
    return null;
  }
}

async function writeAudit(svc: any, user: any, request: any, maskedEmail: string) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'DirectoryCorrectionRequest',
    entity_id: request.id,
    action_type: 'submit_directory_correction_request',
    changed_fields: ['status', 'request_type', 'location_id', 'priority'],
    previous_values: JSON.stringify({}),
    new_values: JSON.stringify({
      status: 'submitted',
      request_type: request.request_type,
      location_id: request.location_id,
      priority: request.priority,
      public_reference: request.public_reference,
      contact_email_masked: maskedEmail,
    }),
    admin_user_id: user?.id || '',
    admin_email: maskedEmail,
    note: 'Cerere publica de corectie inregistrata. Continutul si datele de contact raman numai in entitatea dedicata, cu acces administrativ.',
    performed_at: request.submitted_at,
  });
}

async function sendConfirmation(base44: any, email: string, reference: string, locationName: string) {
  try {
    await base44.integrations.Core.SendEmail({
      to: email,
      from_name: 'VIASEE',
      subject: `Am inregistrat sesizarea ${reference}`,
      body: [
        'Buna ziua,',
        '',
        `Am inregistrat sesizarea privind profilul ${locationName}.`,
        `Referinta: ${reference}`,
        '',
        'Echipa VIASEE va verifica informatia si sursele transmise. Trimiterea cererii nu modifica automat profilul public.',
        'Pentru protejarea datelor, raspundeti la acest email si mentionati referinta daca sunt necesare completari.',
        '',
        'Echipa VIASEE',
      ].join('\n'),
    });
    return true;
  } catch (_error) {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return response({ error: 'Metoda nepermisa' }, 405);

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    if (text(payload.company_website || payload.website_honeypot, 100)) {
      return response({ success: true, reference: null });
    }
    if (payload.privacy_confirmed !== true) {
      return response({ error: 'Confirmarea privind prelucrarea datelor este obligatorie' }, 400);
    }

    const locationId = text(payload.location_id, 160);
    const requestType = text(payload.request_type, 80);
    const relationship = text(payload.relationship, 80);
    const contactName = text(payload.contact_name, 120);
    const contactEmail = normalizeEmail(payload.contact_email);
    const explanation = text(payload.explanation, 2000);
    const evidenceUrls = cleanEvidenceUrls(payload.evidence_urls);
    const proposedChanges = safeProposedChanges(payload.proposed_changes);

    if (!locationId) return response({ error: 'Locatia este obligatorie' }, 400);
    if (!REQUEST_TYPES.includes(requestType)) return response({ error: 'Tipul sesizarii este invalid' }, 400);
    if (!RELATIONSHIPS.includes(relationship)) return response({ error: 'Relatia cu locatia este invalida' }, 400);
    if (contactName.length < 2) return response({ error: 'Numele este obligatoriu' }, 400);
    if (!validEmail(contactEmail)) return response({ error: 'Email invalid' }, 400);
    if (explanation.length < 20) return response({ error: 'Descrie problema in minimum 20 de caractere' }, 400);

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location || location.profile_control_status === 'suspended') {
      return response({ error: 'Profilul locatiei nu este disponibil pentru sesizari' }, 404);
    }

    const existing = await svc.entities.DirectoryCorrectionRequest.filter({
      location_id: locationId,
      request_type: requestType,
      contact_email_normalized: contactEmail,
    }, '-submitted_at', 20).catch(() => []);
    const duplicate = existing.find((item: any) => {
      if (!ACTIVE_STATUSES.includes(item.status)) return false;
      const submittedAt = new Date(item.submitted_at || item.created_date || 0).getTime();
      return Number.isFinite(submittedAt) && Date.now() - submittedAt < 7 * 86400000;
    });
    if (duplicate) {
      return response({
        success: true,
        duplicate: true,
        reference: duplicate.public_reference,
        status: duplicate.status,
      });
    }

    const user = await currentUser(base44);
    const submittedAt = new Date().toISOString();
    const publicReference = await uniqueReference(svc);
    const priority = HIGH_PRIORITY_TYPES.includes(requestType) ? 'high' : 'normal';
    const sourceSnapshot = {
      name: location.public_display_name || location.name || '',
      provider_type: location.provider_type || '',
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      address: location.address || '',
      profile_control_status: location.profile_control_status || 'directory',
      status: location.status || '',
      active_status: location.active_status || '',
      captured_at: submittedAt,
    };

    const correction = await svc.entities.DirectoryCorrectionRequest.create({
      location_id: location.id,
      organization_id: location.organization_id || '',
      requester_user_id: user?.id || '',
      request_type: requestType,
      relationship,
      contact_name: contactName,
      contact_email_normalized: contactEmail,
      explanation,
      proposed_changes_json: JSON.stringify(proposedChanges),
      evidence_urls: evidenceUrls,
      source_snapshot_json: JSON.stringify(sourceSnapshot),
      public_reference: publicReference,
      priority,
      status: 'submitted',
      resolution_action: 'none',
      submitted_at: submittedAt,
      admin_note: '',
    });

    await writeAudit(svc, user, correction, maskEmail(contactEmail));
    const confirmationEmailSent = await sendConfirmation(
      base44,
      contactEmail,
      publicReference,
      sourceSnapshot.name || 'locatia semnalata',
    );

    return response({
      success: true,
      reference: publicReference,
      status: 'submitted',
      confirmation_email_sent: confirmationEmailSent,
    }, 201);
  } catch (error) {
    console.error('submitDirectoryCorrection failed', error);
    return response({ error: 'Sesizarea nu a putut fi inregistrata' }, 500);
  }
});
