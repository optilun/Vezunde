import fs from 'node:fs';

const submit = fs.readFileSync('base44/functions/submitProviderClaim/entry.ts', 'utf8');
const review = fs.readFileSync('base44/functions/adminProviderClaimReview/entry.ts', 'utf8');

const failures = [];
const reject = (condition, message) => { if (condition) failures.push(message); };
const expect = (condition, message) => { if (!condition) failures.push(message); };

reject(/ProviderClaimRequest\.create\([\s\S]*?requested_membership_role\s*:/m.test(submit), 'submitProviderClaim nu trebuie sa scrie requested_membership_role ca field');
reject(/ProviderClaimRequest\.update\([\s\S]*?approved_membership_role\s*:/m.test(review), 'adminProviderClaimReview nu trebuie sa scrie approved_membership_role ca field');
expect(submit.includes('requested_membership_role: requestedMembershipRole'), 'rolul solicitat trebuie pastrat in submitted_payload');
expect(review.includes('approved_membership_role: approvedRole'), 'rolul aprobat trebuie pastrat in submitted_payload');
expect(review.includes('submitted_payload: JSON.stringify(updatedSubmitted)'), 'admin review trebuie sa salveze payloadul actualizat');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('PASS onboarding schema compatibility');
