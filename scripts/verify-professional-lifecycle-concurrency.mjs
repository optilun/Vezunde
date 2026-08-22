import assert from 'node:assert/strict';
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

function createMockService(lockRow) {
  let nextId = 1;
  const rows = [lockRow];
  return {
    entities: {
      ProfessionalLifecycleLock: {
        async filter(query) {
          return rows.filter((row) => matches(row, query));
        },
        async create(data) {
          const row = { id: `lock-${nextId++}`, ...data };
          rows.push(row);
          return row;
        },
        async updateMany(query, update) {
          const matched = rows.filter((row) => matches(row, query));
          if (matched.length !== 1) return { success: true, updated: 0, has_more: false };
          applyUpdate(matched[0], update);
          return { success: true, updated: 1, has_more: false };
        },
      },
    },
  };
}

const user = { id: 'user-1', email: 'specialist@example.com' };
const lockRow = { id: 'lock-0', email: user.email };
const svc = createMockService(lockRow);
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
assert.equal(lockRow.lock_token, ownedLock.token, 'another token must not release the lock');
assert.equal(await releaseProfessionalLifecycleLock(svc, ownedLock), true);

lockRow.lock_token = 'stale-token';
lockRow.lock_at = new Date(Date.now() - PROFESSIONAL_LIFECYCLE_LOCK_TTL_MS - 1000).toISOString();
const recoveredLock = await acquireProfessionalLifecycleLock(svc, user);
assert.ok(recoveredLock, 'stale locks must be recoverable');
assert.notEqual(recoveredLock.token, 'stale-token');
await releaseProfessionalLifecycleLock(svc, recoveredLock);

const invitationSource = await readFile(new URL('../base44/functions/professionalInvitationOps/entry.ts', import.meta.url), 'utf8');
const profileSource = await readFile(new URL('../base44/functions/manageMyProfessionalProfile/entry.ts', import.meta.url), 'utf8');
const lockEntitySchema = JSON.parse(await readFile(new URL('../base44/entities/ProfessionalLifecycleLock.jsonc', import.meta.url), 'utf8'));

for (const source of [invitationSource, profileSource]) {
  assert.match(source, /acquireProfessionalLifecycleLock/);
  assert.match(source, /releaseProfessionalLifecycleLock/);
  assert.match(source, /finally {/);
}

const lockIndex = invitationSource.indexOf('const lifecycleLock = await acquireProfessionalLifecycleLock');
const profileLookupIndex = invitationSource.indexOf('svc.entities.ProfessionalProfile.filter({ user_id: user.id }', lockIndex);
const assignmentWriteIndex = invitationSource.indexOf('svc.entities.ProfessionalLocationAssignment.create(assignmentData)', lockIndex);
assert.ok(lockIndex > -1, 'invitation acceptance lock is missing');
assert.ok(profileLookupIndex > lockIndex, 'profile lookup must run under the lifecycle lock');
assert.ok(assignmentWriteIndex > lockIndex, 'assignment creation must run under the lifecycle lock');

for (const fieldName of ['email', 'lock_token', 'lock_at']) {
  assert.ok(lockEntitySchema.properties[fieldName], fieldName + ' is missing from ProfessionalLifecycleLock schema');
}
for (const op of ['create', 'read', 'update', 'delete']) {
  assert.equal(lockEntitySchema.rls?.[op]?.user_condition?.role, 'admin', `ProfessionalLifecycleLock ${op} must be restricted to admin (service role bypasses RLS)`);
}

console.log('Professional lifecycle concurrency checks passed.');
