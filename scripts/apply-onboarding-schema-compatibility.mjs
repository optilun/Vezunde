import fs from 'node:fs';

function replaceExact(file, from, to) {
  const current = fs.readFileSync(file, 'utf8');
  if (!current.includes(from)) throw new Error(`Pattern missing in ${file}`);
  fs.writeFileSync(file, current.replace(from, to));
}

replaceExact(
  'base44/functions/submitProviderClaim/entry.ts',
  `            claimant_relationship: claimantRelationship,\n            requested_membership_role: requestedMembershipRole,\n            business_name: l.name,`,
  `            claimant_relationship: claimantRelationship,\n            business_name: l.name,`,
);

replaceExact(
  'base44/functions/submitProviderClaim/entry.ts',
  `      claimant_relationship: claimantRelationship,\n      requested_membership_role: requestedMembershipRole,\n      business_name: businessName,`,
  `      claimant_relationship: claimantRelationship,\n      business_name: businessName,`,
);

replaceExact(
  'base44/functions/adminProviderClaimReview/entry.ts',
  `    const requestedRole = clean(\n      claim.requested_membership_role ||\n      submitted.requested_membership_role ||`,
  `    const requestedRole = clean(\n      submitted.requested_membership_role ||`,
);

replaceExact(
  'base44/functions/adminProviderClaimReview/entry.ts',
  `    await svc.entities.ProviderClaimRequest.update(claim.id, {\n      status: 'aprobata',\n      requested_membership_role: requestedRole,\n      approved_membership_role: approvedRole,\n      reviewed_at: new Date().toISOString(),\n      review_notes: note,\n    });`,
  `    const updatedSubmitted = {\n      ...submitted,\n      requested_membership_role: requestedRole,\n      approved_membership_role: approvedRole,\n    };\n    await svc.entities.ProviderClaimRequest.update(claim.id, {\n      status: 'aprobata',\n      submitted_payload: JSON.stringify(updatedSubmitted),\n      reviewed_at: new Date().toISOString(),\n      review_notes: note,\n    });`,
);

console.log('Applied onboarding schema compatibility patch.');
