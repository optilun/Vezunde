from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


helper = r'''const LOCATION_DETAIL_FIELDS = [
  'public_display_name',
  'address',
  'public_phone',
  'public_email',
  'lat',
  'lng',
  'place_id',
];

const PUBLIC_PROFILE_FIELDS = [
  'public_display_name',
  'public_description',
  'public_phone',
  'public_email',
  'website_url',
  'facebook_url',
  'instagram_url',
  'linkedin_url',
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value) {
  return normalizeText(value).replace(/[\s().-]+/g, '');
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return raw;
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';
    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_error) {
    return raw.replace(/\/$/, '');
  }
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : normalizeText(value);
}

function canonicalizeGeneric(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeGeneric)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeGeneric(value[key])]),
    );
  }
  if (typeof value === 'string') return normalizeText(value);
  return value;
}

function normalizeField(section, key, value) {
  if (section === 'location_details') {
    if (key === 'lat' || key === 'lng') return normalizeCoordinate(value);
    if (key === 'public_phone') return normalizePhone(value);
    if (key === 'public_email') return normalizeEmail(value);
    return normalizeText(value);
  }
  if (section === 'public_profile') {
    if (key === 'public_phone') return normalizePhone(value);
    if (key === 'public_email') return normalizeEmail(value);
    if (['website_url', 'facebook_url', 'instagram_url', 'linkedin_url'].includes(key)) return normalizeUrl(value);
    return normalizeText(value);
  }
  return canonicalizeGeneric(value);
}

export function getCurrentSectionValues(section, entity = {}) {
  if (section === 'location_details') {
    return {
      public_display_name: entity.public_display_name || entity.name || '',
      address: entity.address || '',
      public_phone: entity.public_phone || entity.phone_public || '',
      public_email: entity.public_email || '',
      lat: entity.lat ?? null,
      lng: entity.lng ?? null,
      place_id: entity.place_id || '',
    };
  }
  if (section === 'public_profile') {
    return {
      public_display_name: entity.public_display_name || '',
      public_description: entity.public_description || '',
      public_phone: entity.public_phone || '',
      public_email: entity.public_email || '',
      website_url: entity.website_url || '',
      facebook_url: entity.facebook_url || '',
      instagram_url: entity.instagram_url || '',
      linkedin_url: entity.linkedin_url || '',
    };
  }
  return entity || {};
}

export function normalizeSubmissionPayload(section, payload = {}, options = {}) {
  if (section !== 'location_details' && section !== 'public_profile') return canonicalizeGeneric(payload || {});
  const fields = section === 'location_details' ? LOCATION_DETAIL_FIELDS : PUBLIC_PROFILE_FIELDS;
  const includeAll = options.includeAll === true;
  const result = {};
  for (const key of fields) {
    if (!includeAll && !hasOwn(payload, key)) continue;
    result[key] = normalizeField(section, key, payload?.[key]);
  }
  return result;
}

export function sameSubmissionPayload(section, left = {}, right = {}) {
  if (section === 'location_details' || section === 'public_profile') {
    const leftCanonical = normalizeSubmissionPayload(section, left, { includeAll: true });
    const rightCanonical = normalizeSubmissionPayload(section, right, { includeAll: true });
    return JSON.stringify(leftCanonical) === JSON.stringify(rightCanonical);
  }
  return JSON.stringify(canonicalizeGeneric(left || {})) === JSON.stringify(canonicalizeGeneric(right || {}));
}

export function changedSubmissionFields(section, payload = {}, currentEntity = {}) {
  const current = getCurrentSectionValues(section, currentEntity);
  const normalizedPayload = normalizeSubmissionPayload(section, payload);
  return Object.keys(normalizedPayload).filter(
    (key) => normalizeField(section, key, normalizedPayload[key]) !== normalizeField(section, key, current[key]),
  );
}

export function hasPublishedSectionChanges(section, payload = {}, currentEntity = {}) {
  return changedSubmissionFields(section, payload, currentEntity).length > 0;
}

export { LOCATION_DETAIL_FIELDS, PUBLIC_PROFILE_FIELDS };
'''
write("shared/providerWorkspaceSubmissionComparison.js", helper)

# submitProviderWorkspaceChange
path = "base44/functions/submitProviderWorkspaceChange/entry.ts"
text = read(path)
text = replace_once(
    text,
    "} from '../../../shared/canonicalServiceRegistryExtended.js';\n",
    "} from '../../../shared/canonicalServiceRegistryExtended.js';\nimport {\n  hasPublishedSectionChanges,\n  sameSubmissionPayload,\n} from '../../../shared/providerWorkspaceSubmissionComparison.js';\n",
    "submit import",
)
text = replace_once(
    text,
    """function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (value === undefined) return null;
  return value;
}

function stableStringify(value) { return JSON.stringify(canonicalize(value)); }
function samePayload(left, right) { return stableStringify(left || {}) === stableStringify(right || {}); }

function sameScalar(left, right) {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;
  if (typeof left === 'number' || typeof right === 'number') {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  return cleanString(left) === cleanString(right);
}

""",
    "",
    "submit local comparison helpers",
)
text = replace_once(
    text,
    """  if (section === 'public_profile') {
    if (!access.loc.organization_id) return true;
    const organization = await svc.entities.ProviderOrganization.get(access.loc.organization_id).catch(() => null);
    if (!organization) return true;
    return Object.entries(cleanPayload).some(([key, value]) => !sameScalar(value, organization[key]));
  }

  if (section === 'location_details') {
    const current = {
      address: access.loc.address || '',
      public_display_name: access.loc.public_display_name || access.loc.name || '',
      public_phone: access.loc.public_phone || access.loc.phone_public || '',
      public_email: access.loc.public_email || '',
      lat: access.loc.lat ?? null,
      lng: access.loc.lng ?? null,
      place_id: access.loc.place_id || '',
    };
    return Object.entries(cleanPayload).some(([key, value]) => !sameScalar(value, current[key]));
  }
""",
    """  if (section === 'public_profile') {
    if (!access.loc.organization_id) return true;
    const organization = await svc.entities.ProviderOrganization.get(access.loc.organization_id).catch(() => null);
    if (!organization) return true;
    return hasPublishedSectionChanges('public_profile', cleanPayload, organization);
  }

  if (section === 'location_details') {
    const currentLocation = await svc.entities.ProviderLocation.get(access.location_id).catch(() => access.loc);
    return hasPublishedSectionChanges('location_details', cleanPayload, currentLocation || access.loc);
  }
""",
    "submit published comparison",
)
text = text.replace(
    "const identical = samePayload(parsePayloadJson(own.payload_json), result.clean);",
    "const identical = sameSubmissionPayload(payload.section, parsePayloadJson(own.payload_json), result.clean);",
)
text = text.replace(
    "if (keeper.submitted_by_user_id === user.id && samePayload(parsePayloadJson(keeper.payload_json), result.clean))",
    "if (keeper.submitted_by_user_id === user.id && sameSubmissionPayload(payload.section, parsePayloadJson(keeper.payload_json), result.clean))",
)
text = text.replace(
    "if (samePayload(parsePayloadJson(submission.payload_json), result.clean) && submission.status === 'draft')",
    "if (sameSubmissionPayload(payload.section, parsePayloadJson(submission.payload_json), result.clean) && submission.status === 'draft')",
)
text = text.replace(
    "const duplicate = otherPending.find((row) => samePayload(parsePayloadJson(row.payload_json), validation.clean));",
    "const duplicate = otherPending.find((row) => sameSubmissionPayload(submission.section, parsePayloadJson(row.payload_json), validation.clean));",
)
text = replace_once(
    text,
    "if (identical) return Response.json({ submission: sanitizeSubmission(own), resumed: true, unchanged: true });",
    "if (identical) return Response.json({ submission: sanitizeSubmission(own), resumed: true, unchanged: true, message: 'Draftul existent a fost incarcat.' });",
    "submit existing draft message",
)
text = replace_once(
    text,
    "return Response.json({ submission: sanitizeSubmission(keeper), resumed: true, duplicate: true });",
    "return Response.json({ submission: sanitizeSubmission(keeper), resumed: true, duplicate: true, message: 'Draftul existent a fost incarcat.' });",
    "submit race duplicate message",
)
text = replace_once(
    text,
    "return Response.json({ success: true, unchanged: true, submission: sanitizeSubmission(submission) });",
    "return Response.json({ success: true, unchanged: true, submission: sanitizeSubmission(submission), message: 'Draftul existent a fost incarcat.' });",
    "submit unchanged update message",
)
write(path, text)

# manageProviderOrganizationProfile
path = "base44/functions/manageProviderOrganizationProfile/entry.ts"
text = read(path)
text = replace_once(
    text,
    "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';\n",
    "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';\nimport {\n  hasPublishedSectionChanges,\n  sameSubmissionPayload,\n} from '../../../shared/providerWorkspaceSubmissionComparison.js';\n",
    "organization import",
)
text = replace_once(
    text,
    """function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value ?? '';
}

function samePayload(left, right) {
  return JSON.stringify(canonicalize(left || {})) === JSON.stringify(canonicalize(right || {}));
}

function hasPublishedChanges(organization, values) {
  return Object.entries(values).some(([key, value]) => clean(value) !== clean(organization[key]));
}

""",
    "",
    "organization local comparison helpers",
)
text = text.replace(
    "hasPublishedChanges(access.organization, validation.values)",
    "hasPublishedSectionChanges('public_profile', validation.values, access.organization)",
)
text = text.replace(
    "const identical = samePayload(parsePayload(own.payload_json), validation.values);",
    "const identical = sameSubmissionPayload('public_profile', parsePayload(own.payload_json), validation.values);",
)
text = text.replace(
    "samePayload(previous, validation.values)",
    "sameSubmissionPayload('public_profile', previous, validation.values)",
)
text = text.replace(
    "message: 'Draftul existent contine deja aceste valori.'",
    "message: 'Draftul existent a fost incarcat.'",
)
text = text.replace(
    "message: 'Draftul contine deja aceste valori.'",
    "message: 'Draftul existent a fost incarcat.'",
)
text = text.replace(
    "message: 'Profilul organizatiei este deja in verificare.'",
    "message: 'Aceasta modificare este deja in verificare.'",
)
old_create = """      const submission = await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: organizationId,
        location_id: access.anchorLocation.id,
        access_origin: 'provider_workspace',
        section: 'public_profile',
        item_key: `organization:${organizationId}`,
        payload_json: JSON.stringify(validation.values),
        status: 'draft',
        submitted_by_user_id: user.id,
      });
      await audit(svc, user, submission, 'create_organization_profile_draft', {}, validation.values);
      return res({ submission: safeSubmission(submission) });
"""
new_create = """      const submission = await svc.entities.ProviderWorkspaceSubmission.create({
        organization_id: organizationId,
        location_id: access.anchorLocation.id,
        access_origin: 'provider_workspace',
        section: 'public_profile',
        item_key: `organization:${organizationId}`,
        payload_json: JSON.stringify(validation.values),
        status: 'draft',
        submitted_by_user_id: user.id,
      });

      // Re-read after create so two near-simultaneous requests converge on one active row.
      const activeAfterCreate = await listActive(svc, organizationId);
      const keeper = activeAfterCreate[0] || submission;
      if (keeper.id !== submission.id) {
        await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
        if (keeper.submitted_by_user_id === user.id && sameSubmissionPayload('public_profile', parsePayload(keeper.payload_json), validation.values)) {
          return res({ submission: safeSubmission(keeper), resumed: true, duplicate: true, message: keeper.status === 'pending_review' ? 'Aceasta modificare este deja in verificare.' : 'Draftul existent a fost incarcat.' });
        }
        return res({ error: 'Exista deja o alta modificare activa pentru profilul organizatiei.' }, 409);
      }

      await audit(svc, user, submission, 'create_organization_profile_draft', {}, validation.values);
      return res({ submission: safeSubmission(submission) });
"""
text = replace_once(text, old_create, new_create, "organization post-create race guard")
write(path, text)

# adminWorkspaceReview: block no-op location approval
path = "base44/functions/adminWorkspaceReview/entry.ts"
text = read(path)
text = replace_once(
    text,
    "} from '../../../shared/canonicalServiceRegistryExtended.js';\n",
    "} from '../../../shared/canonicalServiceRegistryExtended.js';\nimport { hasPublishedSectionChanges } from '../../../shared/providerWorkspaceSubmissionComparison.js';\n",
    "admin workspace import",
)
needle = """      const validation = validatePayload(submission.section, parsedPayload);
      if (!validation.valid) return Response.json(validation.body, { status: validation.status });
      const note = cleanString(payload.note);
"""
replacement = """      const validation = validatePayload(submission.section, parsedPayload);
      if (!validation.valid) return Response.json(validation.body, { status: validation.status });
      if (submission.section === 'location_details') {
        const currentLocation = await svc.entities.ProviderLocation.get(submission.location_id).catch(() => null);
        if (currentLocation && !hasPublishedSectionChanges('location_details', validation.clean, currentLocation)) {
          return Response.json({
            error: 'Cererea nu contine modificari reale fata de datele publicate.',
            no_changes: true,
          }, { status: 409 });
        }
      }
      const note = cleanString(payload.note);
"""
text = replace_once(text, needle, replacement, "admin workspace no-op approval guard")
write(path, text)

# adminOrganizationProfileReview: block no-op organization approval
path = "base44/functions/adminOrganizationProfileReview/entry.ts"
text = read(path)
text = replace_once(
    text,
    "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';\n",
    "import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';\nimport { hasPublishedSectionChanges } from '../../../shared/providerWorkspaceSubmissionComparison.js';\n",
    "admin organization import",
)
needle = """      const validation = validatePayload(parsePayload(submission.payload_json));
      if (validation.error) return res(validation, 400);
      const previous = Object.fromEntries(FIELDS.map((key) => [key, organization[key] || '']));
"""
replacement = """      const validation = validatePayload(parsePayload(submission.payload_json));
      if (validation.error) return res(validation, 400);
      if (!hasPublishedSectionChanges('public_profile', validation.values, organization)) {
        return res({
          error: 'Cererea nu contine modificari reale fata de profilul publicat.',
          no_changes: true,
        }, 409);
      }
      const previous = Object.fromEntries(FIELDS.map((key) => [key, organization[key] || '']));
"""
text = replace_once(text, needle, replacement, "admin organization no-op approval guard")
write(path, text)

# Remove global Base44 client Proxy. Backend remains source of truth.
write(
    "src/api/base44Client.js",
    """import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});
""",
)

# Provider profile UX
path = "src/components/workspace/provider/ProviderProfilePublic.jsx"
text = read(path)
old = """    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMessage("Draft salvat. In acest moment apare in Prezentare generala la Necesita actiune, dar nu intra in admin pana nu il trimiti spre review.");
    await loadDraft();
    await onRefresh?.();
"""
new = """    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de salvat.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else if (data.resumed || data.unchanged) setMessage(data.message || "Draftul existent a fost incarcat.");
    else setMessage("Draft salvat. In acest moment apare in Prezentare generala la Necesita actiune, dar nu intra in admin pana nu il trimiti spre review.");
    await loadDraft();
    await onRefresh?.();
"""
text = replace_once(text, old, new, "profile save UX")
old = """    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMessage("Profilul organizatiei a fost trimis spre review. Acum apare si in admin la Modificari workspace.");
    await loadDraft();
    await onRefresh?.();
"""
new = """    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de trimis.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else setMessage("Profilul organizatiei a fost trimis spre review. Acum apare si in admin la Modificari workspace.");
    await loadDraft();
    await onRefresh?.();
"""
text = replace_once(text, old, new, "profile submit UX")
write(path, text)

# Provider locations UX
path = "src/components/workspace/provider/ProviderLocations.jsx"
text = read(path)
old = """    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMessage("Draft salvat. Trimite-l spre review cand este pregatit.");
    await loadDraft();
"""
new = """    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de salvat.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else if (data.resumed || data.unchanged) setMessage(data.message || "Draftul existent a fost incarcat.");
    else setMessage("Draft salvat. Trimite-l spre review cand este pregatit.");
    await loadDraft();
    await onRefresh?.();
"""
text = replace_once(text, old, new, "location save UX")
old = """    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMessage("Modificarile locatiei au fost trimise spre review.");
    await loadDraft();
"""
new = """    setSaving(false);
    const data = response.data || {};
    if (data.error) { setMessage(data.error); return; }
    if (data.no_changes) setMessage(data.message || "Nu exista modificari noi de trimis.");
    else if (data.duplicate || data.already_pending) setMessage(data.message || "Aceasta modificare este deja in verificare.");
    else setMessage("Modificarile locatiei au fost trimise spre review.");
    await loadDraft();
    await onRefresh?.();
"""
text = replace_once(text, old, new, "location submit UX")
write(path, text)

# Verification scripts
comparison_test = r'''import assert from 'node:assert/strict';
import {
  hasPublishedSectionChanges,
  sameSubmissionPayload,
} from '../shared/providerWorkspaceSubmissionComparison.js';

const location = {
  public_display_name: 'Lunera Optic Store',
  address: 'SAT GIROC, STR. CUPIDON, NR.40, ET.',
  public_phone: '',
  phone_public: '0721152307',
  public_email: 'contact@optilun.com',
  lat: null,
  lng: null,
  place_id: '',
};

assert.equal(hasPublishedSectionChanges('location_details', {
  public_display_name: ' Lunera Optic Store ',
  address: 'SAT GIROC, STR. CUPIDON, NR.40, ET.',
  public_phone: '0721 152 307',
  public_email: 'CONTACT@OPTILUN.COM',
  lat: '',
  lng: undefined,
  place_id: null,
}, location), false, 'location_details identical values must be a no-op');

assert.equal(sameSubmissionPayload('location_details', { lat: null, lng: '', place_id: undefined }, { lat: '', lng: null, place_id: '' }), true, 'optional empty values must be equivalent');
assert.equal(hasPublishedSectionChanges('location_details', { address: 'Alta adresa' }, location), true, 'real address change must be detected');

const organization = {
  public_display_name: 'Lunera Optic Store',
  public_description: 'Descriere',
  public_phone: '0721152307',
  public_email: 'contact@optilun.com',
  website_url: 'https://optilun.com/',
  facebook_url: '',
  instagram_url: '',
  linkedin_url: '',
};
assert.equal(hasPublishedSectionChanges('public_profile', {
  public_display_name: 'Lunera Optic Store',
  public_description: 'Descriere',
  public_phone: '0721-152-307',
  public_email: 'CONTACT@OPTILUN.COM',
  website_url: 'optilun.com',
  facebook_url: null,
  instagram_url: '',
  linkedin_url: undefined,
}, organization), false, 'public_profile identical values must be a no-op');
assert.equal(hasPublishedSectionChanges('public_profile', { public_description: 'Descriere noua' }, organization), true, 'real organization change must be detected');

console.log('provider submission comparison: 5 checks passed');
'''
write("scripts/verify-provider-submission-comparison.mjs", comparison_test)

backend_test = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const submit = read('base44/functions/submitProviderWorkspaceChange/entry.ts');
const organization = read('base44/functions/manageProviderOrganizationProfile/entry.ts');
const adminLocation = read('base44/functions/adminWorkspaceReview/entry.ts');
const adminOrganization = read('base44/functions/adminOrganizationProfileReview/entry.ts');
const client = read('src/api/base44Client.js');

const checks = [
  [submit.includes("hasPublishedSectionChanges('location_details'"), 'location create/update/submit compares published values'],
  [submit.includes("sameSubmissionPayload(submission.section"), 'location pending duplicates use canonical comparison'],
  [submit.includes("status: 'withdrawn'"), 'location no-op drafts can be withdrawn'],
  [organization.includes("hasPublishedSectionChanges('public_profile'"), 'organization compares canonical published values'],
  [organization.includes('activeAfterCreate'), 'organization has post-create race guard'],
  [organization.includes("status: 'withdrawn'"), 'organization no-op drafts can be withdrawn'],
  [adminLocation.includes('Cererea nu contine modificari reale fata de datele publicate.'), 'admin blocks no-op location approval'],
  [adminOrganization.includes('Cererea nu contine modificari reale fata de profilul publicat.'), 'admin blocks no-op organization approval'],
  [!client.includes('new Proxy'), 'global Base44 client Proxy was removed'],
];
for (const [condition, message] of checks) assert.equal(condition, true, message);
console.log(`provider submission backend: ${checks.length} checks passed`);
'''
write("scripts/verify-provider-submission-backend.mjs", backend_test)

package_path = ROOT / "package.json"
package_data = json.loads(package_path.read_text(encoding="utf-8"))
package_data["scripts"]["test:provider-submissions"] = "node scripts/verify-provider-submission-comparison.mjs && node scripts/verify-provider-submission-backend.mjs"
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Remove the one-shot applicator and workflow from the resulting commit.
(ROOT / "scripts/apply-provider-workspace-idempotency.py").unlink(missing_ok=True)
(ROOT / ".github/workflows/apply-provider-workspace-idempotency.yml").unlink(missing_ok=True)

print("Provider workspace idempotency changes applied.")
