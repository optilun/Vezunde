import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

const invitationPath = 'base44/functions/professionalInvitationOps/entry.ts';
const profilePath = 'base44/functions/manageMyProfessionalProfile/entry.ts';
const userSchemaPath = 'base44/entities/User.jsonc';
const workflowPath = '.github/workflows/provider-onboarding-ci.yml';
const helperPath = 'shared/professionalLifecycleLock.js';
const testPath = 'scripts/verify-professional-lifecycle-concurrency.mjs';

function addImport(source, importText) {
  if (source.includes(importText.trim())) return source;
  const firstNewline = source.indexOf('\n');
  if (firstNewline < 0) throw new Error('Import anchor not found');
  return `${source.slice(0, firstNewline + 1)}${importText}${source.slice(firstNewline + 1)}`;
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label} anchors not found`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

const sharedImport = `import {\n  acquireProfessionalLifecycleLock,\n  releaseProfessionalLifecycleLock,\n} from '../../../shared/professionalLifecycleLock.js';\n`;

const acceptFunction = `async function acceptInvitation(svc, user, payload, req) {
  const urlToken = new URL(req.url).searchParams.get('token');
  const rawToken = cleanString(payload.token || payload.invitation_token || urlToken);
  if (!rawToken) return response({ error: 'Tokenul invitatiei este obligatoriu' }, 400);
  if (user.is_verified === false || user.email_verified === false || user.email_verified === 'false') {
    return response({ error: 'Emailul contului trebuie verificat inainte de acceptare' }, 403);
  }

  const matches = await svc.entities.ProfessionalInvitation.filter({
    secure_token_hash: await hashToken(rawToken),
  }, '-created_date', 2);
  const invitation = matches[0] || null;
  if (!invitation) return response({ error: 'Invitatie invalida' }, 404);

  if (invitation.status === 'accepted') {
    if (invitation.accepted_by_user_id !== user.id) return response({ error: 'Invitatia a fost acceptata de alt cont' }, 403);
    return response({ success: true, already_accepted: true, professional_id: invitation.professional_id || null });
  }
  if (invitation.status !== 'pending') return response({ error: 'Invitatia nu mai este activa' }, 400);
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await svc.entities.ProfessionalInvitation.update(invitation.id, { status: 'expired' });
    return response({ error: 'Invitatia a expirat' }, 400);
  }
  if (normalizeEmail(user.email) !== invitation.invited_email_normalized) {
    return response({ error: 'Invitatia este destinata altui email' }, 403);
  }

  const lifecycleLock = await acquireProfessionalLifecycleLock(svc, user);
  if (!lifecycleLock) {
    return response({ error: 'Profilul profesional este deja procesat intr-o alta solicitare. Reincearca.' }, 409);
  }

  try {
    const currentInvitation = await svc.entities.ProfessionalInvitation.get(invitation.id).catch(() => null);
    if (!currentInvitation) return response({ error: 'Invitatia nu mai exista' }, 404);
    if (currentInvitation.status === 'accepted') {
      if (currentInvitation.accepted_by_user_id !== user.id) {
        return response({ error: 'Invitatia a fost acceptata de alt cont' }, 403);
      }
      return response({
        success: true,
        already_accepted: true,
        professional_id: currentInvitation.professional_id || null,
      });
    }
    if (currentInvitation.status !== 'pending') return response({ error: 'Invitatia nu mai este activa' }, 400);
    if (new Date(currentInvitation.expires_at).getTime() <= Date.now()) {
      await svc.entities.ProfessionalInvitation.update(currentInvitation.id, { status: 'expired' });
      return response({ error: 'Invitatia a expirat' }, 400);
    }
    if (normalizeEmail(user.email) !== currentInvitation.invited_email_normalized) {
      return response({ error: 'Invitatia este destinata altui email' }, 403);
    }

    const locationContext = await loadAcceptableInvitationLocation(svc, currentInvitation);
    if (locationContext.error) return response({ error: locationContext.error }, locationContext.status);
    const location = locationContext.location;

    const profiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
    let profile = profiles[0] || null;
    const displayName = cleanString(user.full_name || user.name) || normalizeEmail(user.email).split('@')[0];

    if (profile && profile.professional_type && profile.professional_type !== currentInvitation.professional_type) {
      return response({
        error: 'Contul are deja un alt tip profesional. Modificarea identitatii profesionale necesita verificare VIASEE.',
      }, 409);
    }

    if (!profile) {
      profile = await svc.entities.ProfessionalProfile.create({
        user_id: user.id,
        full_name: displayName,
        public_display_name: displayName,
        professional_type: currentInvitation.professional_type,
        role: ROLE_BY_TYPE[currentInvitation.professional_type],
        specializations: [],
        professional_bio: '',
        public_email: '',
        accepts_independent_requests: false,
        verification_status: 'unverified',
        public_visibility_status: 'draft',
        profile_completeness: 20,
        profile_updated_at: new Date().toISOString(),
        is_public: false,
      });
    } else if (!profile.user_id) {
      profile = await svc.entities.ProfessionalProfile.update(profile.id, { user_id: user.id });
    }

    const existingAssignments = await svc.entities.ProfessionalLocationAssignment.filter({
      professional_id: profile.id,
      location_id: currentInvitation.location_id,
    }, '-created_date', 10);
    const assignmentData = {
      professional_id: profile.id,
      location_id: currentInvitation.location_id,
      professional_type: profile.professional_type || currentInvitation.professional_type,
      source_invitation_id: currentInvitation.id,
      confirmed_by_professional_at: new Date().toISOString(),
      active_status: 'activ',
      public_status: 'privat',
    };

    let assignment;
    if (existingAssignments[0]) {
      assignment = await svc.entities.ProfessionalLocationAssignment.update(existingAssignments[0].id, assignmentData);
    } else {
      assignment = await svc.entities.ProfessionalLocationAssignment.create(assignmentData);
    }

    const acceptedAt = new Date().toISOString();
    await svc.entities.ProfessionalInvitation.update(currentInvitation.id, {
      status: 'accepted',
      accepted_by_user_id: user.id,
      accepted_at: acceptedAt,
      professional_id: profile.id,
    });

    await writeAudit(svc, user, {
      entity_type: 'ProfessionalInvitation',
      entity_id: currentInvitation.id,
      action_type: 'accept_professional_invitation',
      changed_fields: ['status', 'accepted_by_user_id', 'professional_id'],
      previous: { status: currentInvitation.status },
      next: {
        status: 'accepted',
        professional_id: profile.id,
        location_id: currentInvitation.location_id,
        assignment_public_status: 'privat',
      },
      note: 'Specialistul a confirmat asocierea. Nu s-a creat ProviderMembership si profilul nu a fost publicat.',
    });

    return response({
      success: true,
      professional: {
        id: profile.id,
        full_name: profile.full_name,
        professional_type: profile.professional_type,
        public_visibility_status: profile.public_visibility_status || 'draft',
        verification_status: profile.verification_status || 'unverified',
      },
      assignment: {
        id: assignment.id,
        location_id: assignment.location_id,
        active_status: assignment.active_status,
        public_status: assignment.public_status,
      },
      location: {
        id: location.id,
        name: location.public_display_name || location.name,
        city: location.locality_name || location.city || '',
      },
    });
  } finally {
    await releaseProfessionalLifecycleLock(svc, lifecycleLock);
  }
}`;

const createProfileBlock = `    if (action === 'create_profile') {
      if (profile) {
        return res({
          success: true,
          already_exists: true,
          professional_id: profile.id,
          professional_type: profile.professional_type,
        });
      }

      const professionalType = text(payload.professional_type);
      if (!PROFESSIONAL_TYPES.includes(professionalType)) {
        return res({ error: 'Selecteaza un tip profesional valid' }, 400);
      }
      const checkedName = plain(payload.full_name, 'Numele complet', 120, true);
      if (checkedName.error) return res({ error: checkedName.error }, 400);

      const lifecycleLock = await acquireProfessionalLifecycleLock(svc, user);
      if (!lifecycleLock) {
        return res({ error: 'Profilul profesional este deja procesat intr-o alta solicitare. Reincearca.' }, 409);
      }

      try {
        const lockedProfiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 5);
        const lockedProfile = lockedProfiles[0] || null;
        if (lockedProfile) {
          return res({
            success: true,
            already_exists: true,
            professional_id: lockedProfile.id,
            professional_type: lockedProfile.professional_type,
          });
        }

        const draft = {
          public_display_name: checkedName.value,
          professional_bio: '',
          specializations: [],
          profile_photo_url: '',
          public_website_url: '',
          linkedin_url: '',
          facebook_url: '',
          instagram_url: '',
          public_phone: '',
          public_email: '',
          accepts_independent_requests: false,
        };
        const now = new Date().toISOString();
        const created = await svc.entities.ProfessionalProfile.create({
          user_id: user.id,
          full_name: checkedName.value,
          public_display_name: checkedName.value,
          role: ROLE_BY_TYPE[professionalType],
          professional_type: professionalType,
          specializations: [],
          professional_bio: '',
          public_email: '',
          accepts_independent_requests: false,
          verification_status: 'unverified',
          public_visibility_status: 'draft',
          profile_review_status: 'draft',
          pending_profile_json: JSON.stringify(draft),
          profile_completeness: completeness(draft, professionalType),
          profile_updated_at: now,
          is_public: false,
        });
        await audit(
          svc,
          user,
          created.id,
          'create_professional_profile',
          {},
          { professional_type: professionalType, profile_review_status: 'draft' },
          'Utilizatorul si-a creat profilul profesional independent. Nu au fost create organizatii, acces administrativ sau asocieri la locatii.'
        );
        return res({
          success: true,
          professional_id: created.id,
          professional_type: professionalType,
          profile_review_status: 'draft',
        }, 201);
      } finally {
        await releaseProfessionalLifecycleLock(svc, lifecycleLock);
      }
    }`;

let invitationSource = await readFile(invitationPath, 'utf8');
invitationSource = addImport(invitationSource, sharedImport);
invitationSource = replaceBetween(
  invitationSource,
  'async function acceptInvitation(svc, user, payload, req) {',
  '\n\nDeno.serve(',
  acceptFunction,
  'professional invitation acceptance'
);
await writeFile(invitationPath, invitationSource);

let profileSource = await readFile(profilePath, 'utf8');
profileSource = addImport(profileSource, sharedImport);
profileSource = replaceBetween(
  profileSource,
  "    if (action === 'create_profile') {",
  "\n\n    if (!profile) return res({ error: 'Nu exista un profil profesional asociat acestui cont' }, 404);",
  createProfileBlock,
  'professional profile creation'
);
await writeFile(profilePath, profileSource);

const userSchema = JSON.parse(await readFile(userSchemaPath, 'utf8'));
const internalFieldRls = {
  read: { user_condition: { role: 'admin' } },
  write: { user_condition: { role: 'admin' } },
};
userSchema.properties.professional_lifecycle_lock_token = {
  type: 'string',
  description: 'Blocare interna pentru operatiile atomice ale profilului profesional',
  rls: internalFieldRls,
};
userSchema.properties.professional_lifecycle_lock_at = {
  type: 'string',
  format: 'date-time',
  description: 'Momentul blocarii interne pentru operatiile profilului profesional',
  rls: internalFieldRls,
};
await writeFile(userSchemaPath, `${JSON.stringify(userSchema, null, 2)}\n`);

const helperSource = `export const PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS = 5 * 60 * 1000;

const RETRY_DELAYS_MS = [0, 60, 100, 160, 240, 360, 520, 760];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function createLockToken() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireProfessionalLifecycleLock(svc, user) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;

  const token = createLockToken();
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const now = Date.now();
    const staleBefore = new Date(now - PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS).toISOString();
    const result = await svc.entities.User.updateMany({
      email,
      $or: [
        { professional_lifecycle_lock_token: { $exists: false } },
        { professional_lifecycle_lock_token: '' },
        { professional_lifecycle_lock_at: { $exists: false } },
        { professional_lifecycle_lock_at: { $lt: staleBefore } },
      ],
    }, {
      $set: {
        professional_lifecycle_lock_token: token,
        professional_lifecycle_lock_at: new Date(now).toISOString(),
      },
    });

    if (Number(result?.updated || 0) === 1) return { email, token };
  }

  return null;
}

export async function releaseProfessionalLifecycleLock(svc, lock) {
  if (!lock?.email || !lock?.token) return false;
  try {
    const result = await svc.entities.User.updateMany({
      email: lock.email,
      professional_lifecycle_lock_token: lock.token,
    }, {
      $unset: {
        professional_lifecycle_lock_token: '',
        professional_lifecycle_lock_at: '',
      },
    });
    return Number(result?.updated || 0) === 1;
  } catch (_error) {
    return false;
  }
}
`;
await mkdir('shared', { recursive: true });
await writeFile(helperPath, helperSource);

const testSource = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS,
  acquireProfessionalLifecycleLock,
  releaseProfessionalLifecycleLock,
} from '../shared/professionalLifecycleLock.js';

function matches(record, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matches(record, branch));
    const actual = record[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$exists' in expected) return expected.$exists ? actual !== undefined : actual === undefined;
      if ('$lt' in expected) return actual !== undefined && actual < expected.$lt;
    }
    return actual === expected;
  });
}

function applyUpdate(record, update) {
  for (const [key, value] of Object.entries(update.$set || {})) record[key] = value;
  for (const key of Object.keys(update.$unset || {})) delete record[key];
}

function createMockService(userRow) {
  return {
    entities: {
      User: {
        async updateMany(query, update) {
          if (!matches(userRow, query)) return { success: true, updated: 0, has_more: false };
          applyUpdate(userRow, update);
          return { success: true, updated: 1, has_more: false };
        },
      },
    },
  };
}

const user = { id: 'user-1', email: 'specialist@example.com' };
const userRow = { id: user.id, email: user.email };
const svc = createMockService(userRow);
const profiles = [];

async function createProfileOnce() {
  const lock = await acquireProfessionalLifecycleLock(svc, user);
  assert.ok(lock, 'each caller should acquire the lock after the previous caller releases it');
  try {
    if (profiles[0]) return profiles[0];
    await new Promise((resolve) => setTimeout(resolve, 40));
    const profile = { id: 'professional-1', user_id: user.id };
    profiles.push(profile);
    return profile;
  } finally {
    await releaseProfessionalLifecycleLock(svc, lock);
  }
}

const [first, second] = await Promise.all([createProfileOnce(), createProfileOnce()]);
assert.equal(profiles.length, 1, 'concurrent profile creation must produce one profile');
assert.equal(first.id, second.id, 'both callers must resolve to the same profile');

const ownedLock = await acquireProfessionalLifecycleLock(svc, user);
assert.ok(ownedLock, 'owner lock should be acquired');
assert.equal(await releaseProfessionalLifecycleLock(svc, { ...ownedLock, token: 'wrong-token' }), false);
assert.equal(userRow.professional_lifecycle_lock_token, ownedLock.token, 'another token must not release the lock');
assert.equal(await releaseProfessionalLifecycleLock(svc, ownedLock), true);

userRow.professional_lifecycle_lock_token = 'stale-token';
userRow.professional_lifecycle_lock_at = new Date(Date.now() - PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS - 1000).toISOString();
const recoveredLock = await acquireProfessionalLifecycleLock(svc, user);
assert.ok(recoveredLock, 'stale locks must be recoverable');
assert.notEqual(recoveredLock.token, 'stale-token');
await releaseProfessionalLifecycleLock(svc, recoveredLock);

const invitationSource = await readFile(new URL('../base44/functions/professionalInvitationOps/entry.ts', import.meta.url), 'utf8');
const profileSource = await readFile(new URL('../base44/functions/manageMyProfessionalProfile/entry.ts', import.meta.url), 'utf8');
const userSchema = JSON.parse(await readFile(new URL('../base44/entities/User.jsonc', import.meta.url), 'utf8'));

for (const source of [invitationSource, profileSource]) {
  assert.match(source, /acquireProfessionalLifecycleLock/);
  assert.match(source, /releaseProfessionalLifecycleLock/);
  assert.match(source, /finally \{/);
}

const lockIndex = invitationSource.indexOf('const lifecycleLock = await acquireProfessionalLifecycleLock');
const profileLookupIndex = invitationSource.indexOf('svc.entities.ProfessionalProfile.filter({ user_id: user.id }', lockIndex);
const assignmentWriteIndex = invitationSource.indexOf('svc.entities.ProfessionalLocationAssignment.create(assignmentData)', lockIndex);
assert.ok(lockIndex > -1, 'invitation acceptance lock is missing');
assert.ok(profileLookupIndex > lockIndex, 'profile lookup must run under the lifecycle lock');
assert.ok(assignmentWriteIndex > lockIndex, 'assignment creation must run under the lifecycle lock');

for (const fieldName of ['professional_lifecycle_lock_token', 'professional_lifecycle_lock_at']) {
  const field = userSchema.properties[fieldName];
  assert.ok(field, fieldName + ' is missing from User schema');
  assert.equal(field.rls?.read?.user_condition?.role, 'admin');
  assert.equal(field.rls?.write?.user_condition?.role, 'admin');
}

console.log('Professional lifecycle concurrency checks passed.');
`;
await writeFile(testPath, testSource);

let workflow = await readFile(workflowPath, 'utf8');
const pathAnchor = '      - "base44/entities/ProfessionalInvitation.jsonc"\n';
if (!workflow.includes('base44/entities/User.jsonc')) {
  if (!workflow.includes(pathAnchor)) throw new Error('Workflow entity path anchor not found');
  workflow = workflow.replace(pathAnchor, `${pathAnchor}      - "base44/entities/User.jsonc"\n`);
}
const functionAnchor = '      - "base44/functions/professionalInvitationOps/**"\n';
if (!workflow.includes('base44/functions/manageMyProfessionalProfile/**')) {
  if (!workflow.includes(functionAnchor)) throw new Error('Workflow function path anchor not found');
  workflow = workflow.replace(functionAnchor, `${functionAnchor}      - "base44/functions/manageMyProfessionalProfile/**"\n      - "shared/professionalLifecycleLock.js"\n`);
}
const scriptAnchor = '      - "scripts/verify-professional-invitation-acceptance.mjs"\n';
if (!workflow.includes('scripts/verify-professional-lifecycle-concurrency.mjs')) {
  if (!workflow.includes(scriptAnchor)) throw new Error('Workflow script path anchor not found');
  workflow = workflow.replace(scriptAnchor, `${scriptAnchor}      - "scripts/verify-professional-lifecycle-concurrency.mjs"\n`);
}
const stepAnchor = `      - name: Professional invitation acceptance checks
        run: node scripts/verify-professional-invitation-acceptance.mjs
`;
if (!workflow.includes('Professional lifecycle concurrency checks')) {
  if (!workflow.includes(stepAnchor)) throw new Error('Workflow step anchor not found');
  workflow = workflow.replace(stepAnchor, `${stepAnchor}      - name: Professional lifecycle concurrency checks\n        run: node scripts/verify-professional-lifecycle-concurrency.mjs\n`);
}
await writeFile(workflowPath, workflow);

await rm('scripts/apply-professional-lifecycle-concurrency-patch.mjs');
await rm('.github/workflows/apply-professional-lifecycle-concurrency-patch.yml');
