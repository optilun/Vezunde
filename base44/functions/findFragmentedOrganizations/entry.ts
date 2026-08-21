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

// Audit pentru fiecare modificare din fuziune. Acelasi tipar ca in
// directoryOps/adminDataIntegrityOps.ts, ca inregistrarile sa fie citibile in
// acelasi ecran de audit ca restul operatiunilor de directory.
async function auditMerge(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
    action_type: 'organization_merge',
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
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
  //    ATENTIE - scor mai mic, deliberat: acest tipar produce si perechi legitime,
  //    distincte. Verificat pe date reale: "New Optic" (Pitesti + Sector 1) si
  //    "New Optic Medical" (Sector 6) au adrese complet diferite - sunt, cel mai
  //    probabil, firme separate cu nume asemanator. De aceea 85, nu 95, si de aceea
  //    intreaga functie e o unealta de REVIZUIRE, nu de fuziune automata.
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
    const input = await req.json().catch(() => ({}));

    // ------------------------------------------------------------------
    // ACTIUNE: fuziune. Muta locatiile din organizatia sursa in cea tinta si
    // marcheaza sursa ca inactiva. NU sterge nimic - sursa ramane in baza,
    // inactiva, ca sa poata fi refacuta manual daca fuziunea a fost gresita.
    // Fiecare mutare primeste inregistrare de audit proprie.
    // ------------------------------------------------------------------
    if (clean(input.action) === 'merge') {
      const sourceId = clean(input.source_organization_id);
      const targetId = clean(input.target_organization_id);
      if (!sourceId || !targetId) {
        return Response.json({ error: 'Ambele organizatii sunt obligatorii.' }, { status: 400 });
      }
      if (sourceId === targetId) {
        return Response.json({ error: 'Sursa si tinta nu pot fi aceeasi organizatie.' }, { status: 400 });
      }
      // Confirmare explicita, ca la restul operatiunilor ireversibile din directory.
      const expectedToken = `MERGE ${sourceId.slice(0, 8)} ${targetId.slice(0, 8)}`;
      if (clean(input.confirmation) !== expectedToken) {
        return Response.json({
          error: `Confirmare invalida. Trimite exact: ${expectedToken}`,
          expected_confirmation: expectedToken,
        }, { status: 400 });
      }

      const [source, target] = await Promise.all([
        svc.entities.ProviderOrganization.get(sourceId).catch(() => null),
        svc.entities.ProviderOrganization.get(targetId).catch(() => null),
      ]);
      if (!source) return Response.json({ error: 'Organizatia sursa nu exista.' }, { status: 404 });
      if (!target) return Response.json({ error: 'Organizatia tinta nu exista.' }, { status: 404 });

      const sourceLocations = await svc.entities.ProviderLocation
        .filter({ organization_id: sourceId }, 'name', 500).catch(() => []);

      const moved = [];
      const failed = [];
      for (const location of sourceLocations) {
        try {
          await svc.entities.ProviderLocation.update(location.id, { organization_id: targetId });
          await auditMerge(svc, user, {
            entity_type: 'ProviderLocation',
            entity_id: location.id,
            changed_fields: ['organization_id'],
            previous: { organization_id: sourceId },
            next: { organization_id: targetId },
            note: `Fuziune organizatii: "${source.name}" -> "${target.name}".`,
          });
          moved.push({ id: location.id, name: location.name || '' });
        } catch (moveError) {
          failed.push({ id: location.id, name: location.name || '', error: moveError?.message || 'eroare' });
        }
      }

      // Sursa se dezactiveaza DOAR daca toate locatiile au fost mutate. Altfel ar
      // ramane locatii legate de o organizatie inactiva - stare mai rea decat
      // cea de dinainte de fuziune.
      let sourceDeactivated = false;
      if (failed.length === 0) {
        await svc.entities.ProviderOrganization.update(sourceId, { status: 'inactiva' });
        await auditMerge(svc, user, {
          entity_type: 'ProviderOrganization',
          entity_id: sourceId,
          changed_fields: ['status'],
          previous: { status: source.status || '' },
          next: { status: 'inactiva' },
          note: `Dezactivata dupa fuziune in "${target.name}" (${moved.length} locatii mutate).`,
        });
        sourceDeactivated = true;
      }

      return Response.json({
        merged: true,
        moved_count: moved.length,
        moved,
        failed,
        source_deactivated: sourceDeactivated,
        warning: failed.length > 0
          ? 'Unele locatii nu au putut fi mutate. Organizatia sursa a ramas activa - reia fuziunea.'
          : '',
      });
    }

    // ------------------------------------------------------------------
    // IMPLICIT: scanare. Nu modifica nimic.
    // ------------------------------------------------------------------
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
