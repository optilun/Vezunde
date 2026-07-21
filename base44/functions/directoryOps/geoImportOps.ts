import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3F.2 - Romania Geographic Foundation. Admin-only import of the approved SIRUTA CSV.
const APPROVED_CHECKSUM = '4b35cf16e50fd8b7301e84714f2d352ed33f384669f719039f21569338bccbac';
const APPROVED_ROWS = 16978;
const APPROVED_SOURCE_VERSION = 'siruta_an-2025';
const EXPECTED_COLUMNS = ['siruta_code', 'name', 'official_name', 'normalized_name', 'locality_type', 'siruta_level', 'siruta_type_code', 'postal_code', 'county_code', 'county_name', 'uat_code', 'uat_name', 'parent_siruta_code', 'environment', 'region_code', 'county_sort_key', 'locality_sort_key', 'nuts_code', 'is_active', 'aliases', 'data_source', 'source_version', 'source_url'];
const CHUNK_SIZE = 3000;

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else { field += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (c === '\r') { /* skip */ }
    else { field += c; }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

async function loadCsv(fileUrl) {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error('Nu am putut descarca fisierul CSV (' + resp.status + ').');
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const raw = parseCsv(text);
  const header = raw[0].map((h) => h.trim());
  const rows = raw.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { checksum, header, rows };
}

async function fetchExistingCodes(sr) {
  // Map siruta_code -> record id for upsert / deactivation decisions.
  const map = new Map();
  let skip = 0;
  for (let i = 0; i < 60; i++) {
    const page = await sr.GeographicLocality.list('-created_date', 500, skip);
    const before = map.size;
    for (const rec of page) map.set(rec.siruta_code, rec.id);
    if (page.length < 500 || map.size === before) break;
    skip += 500;
  }
  return map;
}

function validate({ checksum, header, rows }, existingMap) {
  const critical = [];
  const check = (ok, label) => critical.push({ label, ok });

  check(checksum === APPROVED_CHECKSUM, 'Checksum SHA-256 corespunde fisierului aprobat');
  check(rows.length === APPROVED_ROWS, 'Numar exact de randuri: ' + APPROVED_ROWS + ' (gasit: ' + rows.length + ')');
  const missingCols = EXPECTED_COLUMNS.filter((c) => !header.includes(c));
  const extraCols = header.filter((c) => !EXPECTED_COLUMNS.includes(c));
  check(missingCols.length === 0 && extraCols.length === 0 && header.length === 23,
    'Exact 23 coloane asteptate, fara coloane neasteptate' + (missingCols.length ? ' (lipsesc: ' + missingCols.join(',') + ')' : '') + (extraCols.length ? ' (neasteptate: ' + extraCols.join(',') + ')' : ''));

  const codes = new Set();
  let dupCount = 0;
  let invalidRows = 0;
  let missingType = 0;
  let missingCounty = 0;
  const byLevel = {};
  const byType = {};
  for (const r of rows) {
    if (!r.siruta_code) { invalidRows++; continue; }
    if (codes.has(r.siruta_code)) dupCount++;
    codes.add(r.siruta_code);
    if (!r.locality_type) missingType++;
    if (!r.county_code || !r.county_name) missingCounty++;
    byLevel[r.siruta_level || '?'] = (byLevel[r.siruta_level || '?'] || 0) + 1;
    byType[r.locality_type || '?'] = (byType[r.locality_type || '?'] || 0) + 1;
  }
  check(dupCount === 0, 'siruta_code este unic (duplicate: ' + dupCount + ')');
  check(invalidRows === 0, 'Toate randurile au siruta_code (invalide: ' + invalidRows + ')');
  check(missingType === 0, 'locality_type prezent pe toate randurile (lipsa: ' + missingType + ')');
  check(missingCounty === 0, 'county_code si county_name prezente (lipsa: ' + missingCounty + ')');

  // Bucuresti + sectors 1-6
  const bucharestGeneral = rows.find((r) => r.normalized_name === 'bucuresti' || r.normalized_name === 'municipiul bucuresti');
  const sectorsFound = [];
  for (let n = 1; n <= 6; n++) {
    const s = rows.find((r) => /sector/.test(r.normalized_name) && new RegExp('sector(ul)?\\s*' + n + '$').test(r.normalized_name));
    if (s) sectorsFound.push(s.name);
  }
  check(!!bucharestGeneral, 'Bucuresti (optiune generala) exista' + (bucharestGeneral ? ' — "' + bucharestGeneral.name + '"' : ''));
  check(sectorsFound.length === 6, 'Sectoarele 1-6 exista (gasite: ' + sectorsFound.length + ')');

  // Parent relationships
  let badParents = 0;
  for (const r of rows) {
    if (r.parent_siruta_code && !codes.has(r.parent_siruta_code)) badParents++;
  }
  check(badParents === 0, 'Relatiile parinte SIRUTA sunt valide (invalide: ' + badParents + ')');

  const forbidden = header.filter((c) => /lat|lng|longitude|latitude|coord|google|place_id|provider|service/i.test(c));
  check(forbidden.length === 0, 'Fara coordonate, furnizori, servicii sau date Google');

  const createCount = rows.filter((r) => r.siruta_code && !existingMap.has(r.siruta_code)).length;
  const updateCount = rows.filter((r) => r.siruta_code && existingMap.has(r.siruta_code)).length;
  let deactivateCount = 0;
  for (const code of existingMap.keys()) if (!codes.has(code)) deactivateCount++;

  return {
    critical,
    all_pass: critical.every((c) => c.ok),
    stats: {
      total_rows: rows.length,
      by_siruta_level: byLevel,
      by_locality_type: byType,
      duplicate_count: dupCount,
      invalid_rows: invalidRows,
      bucharest: { general: bucharestGeneral ? bucharestGeneral.name : null, sectors: sectorsFound },
      expected_create: createCount,
      expected_update: updateCount,
      expected_deactivate: deactivateCount,
      checksum,
    },
  };
}

function toRecord(r, importedAt) {
  return {
    siruta_code: r.siruta_code,
    name: r.name,
    official_name: r.official_name,
    normalized_name: r.normalized_name,
    locality_type: r.locality_type,
    siruta_level: r.siruta_level,
    siruta_type_code: r.siruta_type_code,
    postal_code: r.postal_code,
    county_code: r.county_code,
    county_name: r.county_name,
    uat_code: r.uat_code,
    uat_name: r.uat_name,
    parent_siruta_code: r.parent_siruta_code,
    environment: r.environment,
    region_code: r.region_code,
    county_sort_key: r.county_sort_key,
    locality_sort_key: r.locality_sort_key,
    nuts_code: r.nuts_code,
    is_active: r.is_active !== 'false',
    aliases: r.aliases,
    data_source: r.data_source,
    source_version: r.source_version,
    source_url: r.source_url,
    imported_at: importedAt,
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Acces interzis.' }, { status: 403 });
    const sr = base44.asServiceRole.entities;
    const payload = await req.json();
    const { action, file_url } = payload;
    if (!file_url) return Response.json({ error: 'file_url lipseste.' }, { status: 400 });

    if (action === 'preview') {
      const csv = await loadCsv(file_url);
      const existingMap = await fetchExistingCodes(sr);
      const result = validate(csv, existingMap);
      return Response.json(result);
    }

    if (action === 'commit_start') {
      const csv = await loadCsv(file_url);
      const existingMap = await fetchExistingCodes(sr);
      const result = validate(csv, existingMap);
      if (!result.all_pass) return Response.json({ error: 'Validarile critice nu trec. Importul este blocat.', critical: result.critical }, { status: 400 });
      const run = await sr.GeographicImportRun.create({
        source_version: APPROVED_SOURCE_VERSION,
        source_url: file_url,
        source_checksum: csv.checksum,
        imported_at: new Date().toISOString(),
        imported_by: user.email,
        status: 'in_progress',
        total_rows: csv.rows.length,
        validation_summary: JSON.stringify(result.stats),
      });
      return Response.json({ run_id: run.id, total_rows: csv.rows.length, chunk_size: CHUNK_SIZE, first_import: existingMap.size === 0 });
    }

    if (action === 'commit_chunk') {
      const { start, first_import } = payload;
      const csv = await loadCsv(file_url);
      if (csv.checksum !== APPROVED_CHECKSUM) return Response.json({ error: 'Checksum invalid la commit.' }, { status: 400 });
      const importedAt = new Date().toISOString();
      const slice = csv.rows.slice(start, start + CHUNK_SIZE).filter((r) => r.siruta_code);
      let created = 0;
      let updated = 0;
      if (first_import) {
        for (let i = 0; i < slice.length; i += 500) {
          const batch = slice.slice(i, i + 500).map((r) => toRecord(r, importedAt));
          await sr.GeographicLocality.bulkCreate(batch);
          created += batch.length;
        }
      } else {
        // Upsert strictly by siruta_code.
        for (let i = 0; i < slice.length; i += 200) {
          const batch = slice.slice(i, i + 200);
          const existing = await sr.GeographicLocality.filter({ siruta_code: { $in: batch.map((r) => r.siruta_code) } }, null, 200);
          const idMap = new Map(existing.map((e) => [e.siruta_code, e.id]));
          const toCreate = batch.filter((r) => !idMap.has(r.siruta_code)).map((r) => toRecord(r, importedAt));
          const toUpdate = batch.filter((r) => idMap.has(r.siruta_code)).map((r) => ({ id: idMap.get(r.siruta_code), ...toRecord(r, importedAt) }));
          if (toCreate.length) { await sr.GeographicLocality.bulkCreate(toCreate); created += toCreate.length; }
          if (toUpdate.length) { await sr.GeographicLocality.bulkUpdate(toUpdate); updated += toUpdate.length; }
        }
      }
      return Response.json({ created, updated });
    }

    if (action === 'commit_finish') {
      const { run_id, created, updated, first_import } = payload;
      let deactivated = 0;
      if (!first_import) {
        // Missing previous SIRUTA rows become is_active=false. Never deleted.
        const csv = await loadCsv(file_url);
        const csvCodes = new Set(csv.rows.map((r) => r.siruta_code));
        const existingMap = await fetchExistingCodes(sr);
        const missing = [...existingMap.keys()].filter((c) => !csvCodes.has(c));
        for (let i = 0; i < missing.length; i += 200) {
          await sr.GeographicLocality.updateMany({ siruta_code: { $in: missing.slice(i, i + 200) }, is_active: true }, { $set: { is_active: false } });
        }
        deactivated = missing.length;
      }
      await sr.GeographicImportRun.update(run_id, {
        status: 'completed',
        created_count: created || 0,
        updated_count: updated || 0,
        deactivated_count: deactivated,
        error_count: 0,
        notes: 'Import geografic SIRUTA finalizat.',
      });
      return Response.json({ status: 'completed', created, updated, deactivated });
    }

    return Response.json({ error: 'Actiune necunoscuta.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
