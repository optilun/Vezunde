import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scanare proactiva a organizatiilor fragmentate (2026-08-19).
//
// Context: motorul existent (findProviderIdentityCandidates) e REACTIV - verifica o
// locatie noua fata de director, in momentul adaugarii. Nu exista nimic care sa
// scaneze ce e DEJA in director. Verificat pe datele reale: exista organizatii
// duplicate, inclusiv cazuri cu nume identic caracter cu caracter
// ("Spitalul Clinic de Urgenta Sf. Pantelimon" x2, cu aceeasi locatie, aceeasi
// adresa, sub doua organizatii diferite).
//
// Functia NU modifica nimic. Returneaza doar perechi candidate, cu dovezi, pentru
// revizuire umana in panoul de admin. Fuziunea ramane o decizie de admin.

function clean(value) {
  return String(value || '').trim();
}

function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value) {
  return normalizeName(value).split(' ').filter((token) => token.length >= 3);
}

// Numele contin frecvent doua branduri separate prin "/" ("Daniels Optic / Ochelarium").
// Le tratam ca alias-uri: doua organizatii sunt aceeasi daca ORICARE alias se potriveste.
function aliasesOf(value) {
  return clean(value)
    .split('/')
    .map((part) => normalizeName(part))
    .filter((part) => part.length > 0);
}

const GENERIC_TOKENS = new Set([
  'optica', 'optic', 'optik', 'clinica', 'clinic', 'cabinet', 'spitalul', 'spital',
  'centrul', 'centru', 'medical', 'medicala', 'policlinica', 'judetean', 'judeteana',
  'urgenta', 'oftalmologie', 'oftalmologic', 'municipal', 'municipala', 'ambulatoriu',
  'sectia', 'vedere', 'lentile', 'clinice', 'srl',
]);

function hasOwnBrand(tokens) {
  return tokens.some((token) => !GENERIC_TOKENS.has(token));
}

// Scor intre doua nume de organizatie. Returneaza { score, reason } sau null.
function compareOrganizations(leftName, rightName) {
  const leftNorm = normalizeName(leftName);
  const rightNorm = normalizeName(rightName);
  if (!leftNorm || !rightNorm) return null;

  // 1. Nume identic dupa normalizare - cel mai grav caz.
  if (leftNorm === rightNorm) {
    return { score: 100, reason: 'nume identic dupa normalizare' };
  }

  // 2. Alias comun ("A / B" vs "B / A", sau "A" vs "A / B").
  const leftAliases = aliasesOf(leftName);
  const rightAliases = aliasesOf(rightName);
  for (const leftAlias of leftAliases) {
    for (const rightAlias of rightAliases) {
      if (leftAlias === rightAlias && hasOwnBrand(leftAlias.split(' ').filter((t) => t.length >= 3))) {
        return { score: 95, reason: `alias comun: "${leftAlias}"` };
      }
    }
  }

  // 3. Un nume il contine integral pe celalalt, la nivel de cuvinte
  //    ("Claroptic" in "Claroptic Iris"; "Top Optica" in "Top Optica Boutique").
  const leftTokens = nameTokens(leftName);
  const rightTokens = nameTokens(rightName);
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  if (shorter.length >= 1 && hasOwnBrand(shorter)) {
    const isPrefix = shorter.every((token, index) => longer[index] === token);
    if (isPrefix) {
      return { score: 85, reason: 'un nume este prefixul celuilalt' };
    }
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara.' }, { status: 401 });
    if (clean(user.role) !== 'admin') {
      return Response.json({ error: 'Acces permis doar administratorilor.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const organizations = await svc.entities.ProviderOrganization.list(null, 1000).catch(() => []);

    const pairs = [];
    for (let i = 0; i < organizations.length; i += 1) {
      for (let j = i + 1; j < organizations.length; j += 1) {
        const match = compareOrganizations(organizations[i].name, organizations[j].name);
        if (!match) continue;
        pairs.push({
          score: match.score,
          reason: match.reason,
          organizations: [
            { id: organizations[i].id, name: organizations[i].name || '' },
            { id: organizations[j].id, name: organizations[j].name || '' },
          ],
        });
      }
    }

    pairs.sort((left, right) => right.score - left.score);
    const limited = pairs.slice(0, 100);

    // Pentru fiecare pereche, atasam locatiile - dovada concreta pentru admin.
    // Locatii cu aceeasi adresa in ambele organizatii = duplicat aproape sigur.
    const enriched = [];
    for (const pair of limited) {
      const [left, right] = pair.organizations;
      const [leftLocations, rightLocations] = await Promise.all([
        svc.entities.ProviderLocation.filter({ organization_id: left.id }, 'name', 50).catch(() => []),
        svc.entities.ProviderLocation.filter({ organization_id: right.id }, 'name', 50).catch(() => []),
      ]);
      const rightAddresses = new Set(rightLocations.map((location) => normalizeName(location.address)).filter(Boolean));
      const sharedAddresses = leftLocations
        .filter((location) => rightAddresses.has(normalizeName(location.address)))
        .map((location) => location.address);

      enriched.push({
        ...pair,
        // Adresa comuna ridica scorul la certitudine: aceeasi cladire, doua organizatii.
        score: sharedAddresses.length > 0 ? 100 : pair.score,
        shared_addresses: sharedAddresses.slice(0, 5),
        organizations: [
          { ...left, location_count: leftLocations.length, locations: leftLocations.slice(0, 5).map((l) => ({ id: l.id, name: l.name, city: l.city, status: l.status })) },
          { ...right, location_count: rightLocations.length, locations: rightLocations.slice(0, 5).map((l) => ({ id: l.id, name: l.name, city: l.city, status: l.status })) },
        ],
      });
    }

    enriched.sort((left, right) => right.score - left.score);

    return Response.json({
      scanned_organizations: organizations.length,
      candidate_pairs: enriched,
      total_found: pairs.length,
      truncated: pairs.length > limited.length,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Scanarea a esuat.' }, { status: 500 });
  }
});
