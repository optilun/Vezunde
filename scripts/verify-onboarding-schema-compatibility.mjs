import fs from 'node:fs';

const submit = fs.readFileSync('base44/functions/submitProviderClaim/entry.ts', 'utf8');
const review = fs.readFileSync('base44/functions/directoryOps/adminProviderClaimReview.ts', 'utf8');

const failures = [];
const reject = (condition, message) => { if (condition) failures.push(message); };
const expect = (condition, message) => { if (!condition) failures.push(message); };

// Extrage argumentele fiecarui apel `.create(` / `.update(` pe o entitate anume,
// respectand parantezele. Varianta veche folosea /create\([\s\S]*?camp:/ care sarea
// peste inchiderea apelului si prindea si campuri din Response.json sau din alte
// obiecte de mai jos in fisier - false pozitive garantate (2026-08-06).
function entityWriteBodies(source, entityName) {
  const bodies = [];
  const callPattern = new RegExp(`${entityName}\\.(create|update)\\(`, 'g');
  let match;
  while ((match = callPattern.exec(source)) !== null) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(source.slice(start, index + 1));
  }
  return bodies;
}

const writesField = (source, entityName, field) =>
  entityWriteBodies(source, entityName).some((body) => new RegExp(`${field}\\s*:`).test(body));

reject(writesField(submit, 'ProviderClaimRequest', 'requested_membership_role'), 'submitProviderClaim nu trebuie sa scrie requested_membership_role ca field');
reject(writesField(review, 'ProviderClaimRequest', 'approved_membership_role'), 'adminProviderClaimReview nu trebuie sa scrie approved_membership_role ca field');
expect(submit.includes('requested_membership_role: requestedMembershipRole'), 'rolul solicitat trebuie pastrat in submitted_payload');
expect(review.includes('approved_membership_role: approvedRole'), 'rolul aprobat trebuie pastrat in submitted_payload');
expect(review.includes('submitted_payload: JSON.stringify(updatedSubmitted)'), 'admin review trebuie sa salveze payloadul actualizat');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('PASS onboarding schema compatibility');

