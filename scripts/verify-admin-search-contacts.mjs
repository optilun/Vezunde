// Datele de contact lasate la cautare, in panoul de admin VIASEE.
//
// 2026-09-28, cererea owner-ului: "sa le vad si eu in panoul de admin, in contul de admin de pe
// viasee". Verificarile de aici blocheaza:
//  - sectiunea "Contacte din cautari" exista in meniul admin si in pagina /admin/operatiuni;
//  - "Poate primi oferte" inseamna acord separat, fara dezabonare si fara "Nu mai contacta"
//    (Legea 506/2004); filtrul si exportul folosesc aceeasi regula;
//  - stergerea (la cererea persoanei) cere confirmare in doi pasi;
//  - exportul trece prin buildCsv (protectie la formule in Excel).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEARCH_CONTACT_CSV_HEADER,
  canReceiveSearchContactOffers,
  countSearchContacts,
  filterSearchContacts,
  searchContactAgeLabel,
  searchContactCsvRows,
  searchContactFollowUp,
} from '../src/lib/adminSearchContacts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
function check(name, fn) {
  try {
    fn();
    checks += 1;
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

const rows = [
  { id: '1', contact_name: 'Ana Pop', contact_phone: '0722 111 222', contact_email: 'ana@example.ro', intent_label: 'Control de vedere', city: 'Cluj-Napoca', marketing_consent: true, follow_up_status: 'nou', created_date: '2026-09-28T10:00:00Z', age_years: 34, age_refers_to: 'contact', for_whom: 'adult', timing_key: 'nu_e_urgent' },
  { id: '2', contact_name: 'Ion Ionescu', contact_phone: '0733 000 111', intent_label: 'Reparație sau reglaj de ochelari', city: 'Iași', marketing_consent: true, marketing_unsubscribed_at: '2026-09-29T08:00:00Z', follow_up_status: 'contactat' },
  { id: '3', contact_name: 'Maria', contact_email: 'maria@example.ro', intent_label: 'O problemă la ochi', city: 'Brașov', marketing_consent: false, linked_request_id: 'req1' },
  { id: '4', contact_name: 'Dan', contact_email: 'dan@example.ro', marketing_consent: true, follow_up_status: 'nu_mai_contacta' },
  { id: '5', contact_name: 'Elena', contact_email: '=HYPERLINK("x")', marketing_consent: true, follow_up_status: 'status-necunoscut', age_years: 78, age_refers_to: 'patient' },
];

check('who can receive offers', () => {
  assert.equal(canReceiveSearchContactOffers(rows[0]), true);
  assert.equal(canReceiveSearchContactOffers(rows[1]), false, 'dezabonat');
  assert.equal(canReceiveSearchContactOffers(rows[2]), false, 'fara acord');
  assert.equal(canReceiveSearchContactOffers(rows[3]), false, 'nu mai contacta');
  assert.equal(canReceiveSearchContactOffers({ ...rows[0], status: 'deleted' }), false);
  assert.equal(canReceiveSearchContactOffers(rows[4]), true);
});

check('counts, filters and search', () => {
  assert.equal(searchContactFollowUp(rows[4]), 'nou', 'status necunoscut devine nou');
  const counts = countSearchContacts(rows);
  assert.deepEqual(counts, { total: 5, offers: 2, linked: 1, nou: 3, contactat: 1, fara_raspuns: 0, nu_mai_contacta: 1 });
  assert.deepEqual(filterSearchContacts(rows, { status: 'nou' }).map((row) => row.id), ['1', '3', '5']);
  assert.deepEqual(filterSearchContacts(rows, { offersOnly: true }).map((row) => row.id), ['1', '5']);
  assert.deepEqual(filterSearchContacts(rows, { query: 'iasi' }).map((row) => row.id), ['2'], 'cautare fara diacritice');
  assert.deepEqual(filterSearchContacts(rows, { query: '0722111' }).map((row) => row.id), ['1'], 'telefon fara spatii');
  assert.deepEqual(filterSearchContacts(rows, { query: 'problema' }).map((row) => row.id), ['3']);
});

check('age and CSV rows', () => {
  assert.equal(searchContactAgeLabel(rows[0]), '34 ani');
  assert.equal(searchContactAgeLabel(rows[4]), '78 ani (persoana pentru care a căutat)');
  assert.equal(searchContactAgeLabel(rows[2]), '—');
  const csv = searchContactCsvRows(rows);
  assert.equal(csv.length, rows.length);
  assert.equal(csv[0].length, SEARCH_CONTACT_CSV_HEADER.length);
  assert.deepEqual(csv[0].slice(0, 4), ['2026-09-28 10:00', 'Ana Pop', '0722 111 222', 'ana@example.ro']);
  assert.equal(csv[0][SEARCH_CONTACT_CSV_HEADER.indexOf('Poate primi oferte')], 'Da');
  assert.equal(csv[1][SEARCH_CONTACT_CSV_HEADER.indexOf('Poate primi oferte')], 'Nu');
  assert.equal(csv[2][SEARCH_CONTACT_CSV_HEADER.indexOf('A salvat o cerere')], 'Da');
});

check('admin navigation and page wiring', () => {
  const nav = source('src/lib/adminNavConfig.js');
  assert.match(nav, /key: "contacte_pacienti", label: "Contacte din căutări"/);
  const page = source('src/pages/AdminDirectoryOps.jsx');
  assert.match(page, /import\("@\/components\/admin\/patients\/AdminSearchContacts"\)/);
  // 2026-10-07: secțiunea se alege din adresă (?s=contacte_pacienti), iar antetul comun vine din SECTION_HEADERS.
  assert.match(page, /section === "contacte_pacienti" && <AdminSearchContacts \/>/);
  assert.match(page, /contacte_pacienti: \{\s+subtitle: "Pacienți care și-au lăsat datele/);
  assert.match(page, /const SECTIONS_WITH_HEADER = Object\.keys\(SECTION_HEADERS\)/);
  const app = source('src/App.jsx');
  assert.match(app, /<Route element={<RequireAdmin \/>}>/, 'pagina ramane in spatele garzii de admin');
});

check('screen: admin-only entity, confirmed delete, safe export', () => {
  const screen = source('src/components/admin/patients/AdminSearchContacts.jsx');
  assert.match(screen, /base44\.entities\.PatientSearchContact\.list\("-created_date", 500\)/);
  assert.match(screen, /base44\.entities\.PatientSearchContact\.update\(selected\.id, changes\)/);
  const deleteFn = screen.slice(screen.indexOf('const deleteContact = async'), screen.indexOf('const exportVisible'));
  assert.ok(deleteFn.indexOf('if (!confirmDelete)') < deleteFn.indexOf('PatientSearchContact.delete('), 'stergerea cere confirmare');
  assert.match(screen, /Confirmă ștergerea definitivă/);
  assert.match(screen, /downloadCsv\(`contacte-cautari-\$\{day\}\.csv`, \[\.\.\.SEARCH_CONTACT_CSV_HEADER\], searchContactCsvRows\(visibleContacts\)\)/);
  assert.match(source('src/components/admin/outreach/outreachLabels.js'), /buildCsv\(header, rows\)/, 'exportul foloseste buildCsv (protectie la formule)');
  assert.match(screen, /marketing_unsubscribed_at: new Date\(\)\.toISOString\(\)/);
  assert.match(screen, /data-admin-mobile="true"/);
  assert.match(screen, /Doar cei care pot primi oferte/);
  const schema = JSON.parse(source('base44/entities/PatientSearchContact.jsonc'));
  for (const operation of ['read', 'update', 'delete']) {
    assert.equal(schema.rls[operation].user_condition.role, 'admin', operation);
  }
});

console.log(`Admin search contacts checks passed: ${checks}.`);
