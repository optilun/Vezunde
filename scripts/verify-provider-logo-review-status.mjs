import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../base44/entities/ProviderOrganization.jsonc', import.meta.url), 'utf8');
const submit = await readFile(new URL('../base44/functions/submitProviderLogoForReview/entry.ts', import.meta.url), 'utf8');
const review = await readFile(new URL('../base44/functions/reviewProfileChanges/entry.ts', import.meta.url), 'utf8');
const getter = await readFile(new URL('../base44/functions/getProviderLogoReviewStatus/entry.ts', import.meta.url), 'utf8');
const notice = await readFile(new URL('../src/components/workspace/provider/ProviderLogoReviewStatus.jsx', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../src/components/workspace/provider/ProviderProfilePublic.js', import.meta.url), 'utf8');

assert.match(schema, /"logo_review_status"/);
assert.match(schema, /"pending_review"/);
assert.match(schema, /"approved"/);
assert.match(schema, /"rejected"/);
assert.match(schema, /"logo_review_note"/);

assert.match(submit, /logo_review_status:\s*'pending_review'/);
assert.match(submit, /Exista deja un logo in verificare/);
assert.match(submit, /changed_fields:\s*\['logo_url', 'logo_review_status'\]/);

assert.match(review, /logo_review_status:\s*'approved'/);
assert.match(review, /logo_review_status:\s*'rejected'/);
assert.match(review, /logo_review_note:/);
assert.match(review, /approve_organization_logo/);

assert.match(getter, /profile_review_is_separate:\s*true/);
assert.match(getter, /Doar ownerul organizatiei poate vedea starea logo-ului/);
assert.match(notice, /Logo în verificare/);
assert.match(notice, /Logo neaprobat/);
assert.match(notice, /Datele text ale profilului pot avea un alt status/);
assert.match(adapter, /ProviderProfilePublicWithLogoStatus/);

console.log('Provider logo review status checks passed.');
