// Recomandarea de specialisti: bucket-uri, scor, siguranta si izolarea fata de motorul de locatii.
//
// 2026-09-03. Aici se verifica trei lucruri, in ordinea importantei:
//
//  1. Ca stratul nou NU a atins motorul de locatii. Regula proiectului spune ca matching-ul,
//     ranking-ul si Top 3 nu se schimba fara cerere explicita, iar scorul locatiilor e inghetat
//     prin amprente pe octeti. Daca cineva ar "unifica" mai tarziu cele doua motoare, testul de
//     mai jos cade inainte sa ajunga in productie.
//  2. Ca Top 3 ramane derivat din grup si rang, nu dintr-o taietura pozitionala. Diferenta
//     conteaza: o taietura pozitionala poate promova drept "cea mai potrivita optiune" un profil
//     pe care serverul l-a clasat in coada.
//  3. Ca regula de siguranta pentru nevoi medicale se aplica si persoanelor: un optician nu
//     ajunge prima recomandare pentru o problema care cere decizie medicala. Ramane vizibil, dar
//     sub cei care pot da raspunsul.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION,
  PROFESSIONAL_SCORE_WEIGHTS,
  SPECIALIZATION_SERVICE_KEYS,
  assignProfessionalBuckets,
  buildProfessionalDecisionConfidence,
  buildProfessionalRecommendationEntry,
  buildProfessionalScore,
  compareProfessionalEntries,
  professionalRecommendationGroup,
  serviceKeysForSpecializations,
  specializationsForServiceKeys,
} from '../shared/professionalRecommendation.js';
import { CANONICAL_SERVICE_KEY_SET } from '../shared/canonicalServiceRegistryExtended.js';
import { PROFESSIONAL_TYPE_CODES, professionalSpecializationsFor } from '../shared/professionalIdentity.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

const verifiedProfile = {
  id: 'p-verified',
  professional_type: 'ophthalmologist',
  public_display_name: 'Dr. Ana Pop',
  is_public: true,
  verification_status: 'verified',
  public_visibility_status: 'approved',
  specializations: ['glaucoma', 'retina'],
};

const verifiedLocation = {
  id: 'loc-1',
  name: 'Clinica Test',
  city: 'Sibiu',
  county: 'Sibiu',
  organization_id: 'org-1',
  organization_name: 'Organizatia Test',
  profile_control_status: 'verified',
  expansion_tier: 'oras',
  service_keys: ['oct', 'tonometry'],
};

function entry(overrides = {}) {
  return buildProfessionalRecommendationEntry({
    profile: { ...verifiedProfile, ...(overrides.profile || {}) },
    locations: overrides.locations || [verifiedLocation],
    requestedServiceKeys: overrides.requestedServiceKeys || ['oct', 'tonometry'],
    needLevel: overrides.needLevel || 'specialized_medical',
  });
}

// --- Contract -------------------------------------------------------------------------------

check('contractul are versiune proprie, distincta de cel al locatiilor', () => {
  assert.equal(PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION, 'professional-recommendation-v1');
  assert.notEqual(PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION, 'provider-recommendation-v1');
});

check('ponderile scorului insumeaza 100', () => {
  const total = Object.values(PROFESSIONAL_SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);
});

// --- Maparea specializare <-> serviciu -------------------------------------------------------

check('toate cheile de serviciu din mapare sunt chei canonice reale', () => {
  for (const [specialization, serviceKeys] of Object.entries(SPECIALIZATION_SERVICE_KEYS)) {
    for (const key of serviceKeys) {
      assert.ok(
        CANONICAL_SERVICE_KEY_SET.has(key),
        `${specialization} trimite catre cheia inexistenta ${key}`,
      );
    }
  }
});

check('toate specializarile declarate au acoperire in mapare', () => {
  for (const code of PROFESSIONAL_TYPE_CODES) {
    for (const specialization of professionalSpecializationsFor(code)) {
      assert.ok(
        Array.isArray(SPECIALIZATION_SERVICE_KEYS[specialization]),
        `specializarea ${specialization} (${code}) nu e legata de niciun serviciu`,
      );
    }
  }
});

check('maparea functioneaza in ambele sensuri', () => {
  assert.ok(specializationsForServiceKeys(['oct']).includes('retina'));
  assert.ok(serviceKeysForSpecializations(['glaucoma']).includes('tonometry'));
  assert.deepEqual(specializationsForServiceKeys([]), []);
});

// --- Constructia intrarii --------------------------------------------------------------------

check('un profil nepublic nu produce nicio intrare', () => {
  assert.equal(entry({ profile: { is_public: false } }), null);
  assert.equal(entry({ profile: { verification_status: 'pending_review' } }), null);
  assert.equal(entry({ profile: { public_visibility_status: 'draft' } }), null);
});

check('un specialist fara locatie publica nu apare in rezultate', () => {
  assert.equal(entry({ locations: [] }), null);
});

check('un profil fara nume afisabil nu apare in rezultate', () => {
  assert.equal(entry({ profile: { public_display_name: '', full_name: '' } }), null);
});

check('intrarea poarta drumul catre locatie si organizatie', () => {
  const built = entry();
  assert.equal(built.entity_kind, 'professional');
  assert.equal(built.locations[0].id, 'loc-1');
  assert.equal(built.locations[0].organization_id, 'org-1');
  assert.equal(built.public_location_count, 1);
});

check('specializarile straine de profesie nu ajung in rezultat', () => {
  const built = entry({ profile: { specializations: ['glaucoma', 'frame_consulting'] } });
  assert.deepEqual(built.specializations, ['glaucoma']);
});

// --- Grup si siguranta -------------------------------------------------------------------------

check('pentru o nevoie medicala doar profesiile medicale intra in grupul confirmat', () => {
  assert.equal(professionalRecommendationGroup({
    professionalType: 'ophthalmologist',
    matchedSpecializations: ['glaucoma'],
    needLevel: 'specialized_medical',
  }), 'confirmed');

  assert.equal(professionalRecommendationGroup({
    professionalType: 'optician',
    matchedSpecializations: ['adjustments_repairs'],
    needLevel: 'specialized_medical',
  }), 'directory', 'un optician nu poate fi prima recomandare pentru o decizie medicala');

  assert.equal(professionalRecommendationGroup({
    professionalType: 'optician',
    matchedSpecializations: ['adjustments_repairs'],
    needLevel: 'general',
  }), 'confirmed');
});

check('fara potrivire de specializare intrarea cade in director, nu dispare', () => {
  assert.equal(professionalRecommendationGroup({
    professionalType: 'ophthalmologist',
    matchedSpecializations: [],
    needLevel: 'general',
  }), 'directory');
});

// --- Scor ----------------------------------------------------------------------------------------

check('scorul creste cu potrivirea, nu cu altceva', () => {
  const weak = buildProfessionalScore({
    matchedSpecializations: [],
    requestedSpecializations: ['glaucoma'],
    matchedServiceKeys: [],
    requestedServiceKeys: ['tonometry'],
    bestLocationTrust: 'directory',
    expansionTier: 'tara',
    publicLocationCount: 1,
  });
  const strong = buildProfessionalScore({
    matchedSpecializations: ['glaucoma'],
    requestedSpecializations: ['glaucoma'],
    matchedServiceKeys: ['tonometry'],
    requestedServiceKeys: ['tonometry'],
    bestLocationTrust: 'verified',
    expansionTier: 'oras',
    publicLocationCount: 2,
  });
  assert.ok(strong.score > weak.score);
  assert.ok(strong.score <= 100, `scorul depaseste maximul: ${strong.score}`);
});

check('scorul nu contine nicio componenta comerciala', () => {
  const built = entry();
  const componentNames = Object.keys(built.recommendation_score_components);
  for (const name of componentNames) {
    assert.doesNotMatch(
      name,
      /plan|abonament|subscription|membership|paid|sponsor|boost/i,
      `componenta de scor "${name}" pare comerciala`,
    );
  }
  assert.deepEqual(componentNames.sort(), Object.keys(PROFESSIONAL_SCORE_WEIGHTS).sort());
});

check('un abonament pe profil nu schimba scorul', () => {
  const plain = entry();
  const sponsored = entry({
    profile: { membership_tier: 'pro', is_sponsored: true, subscription_status: 'active' },
  });
  assert.equal(sponsored.recommendation_score, plain.recommendation_score);
});

// --- Bucket-uri -----------------------------------------------------------------------------------

check('Top 3 vine din grup si rang, nu dintr-o taietura pozitionala', () => {
  const entries = [
    { id: 'a', display_name: 'A', recommendation_group: 'directory', recommendation_score: 99 },
    { id: 'b', display_name: 'B', recommendation_group: 'confirmed', recommendation_score: 10 },
    { id: 'c', display_name: 'C', recommendation_group: 'confirmed', recommendation_score: 20 },
  ];
  const bucketed = assignProfessionalBuckets(entries);
  const byId = Object.fromEntries(bucketed.map((item) => [item.id, item]));
  assert.equal(byId.a.result_bucket, 'extended_directory', 'scorul mare nu promoveaza din director in Top 3');
  assert.equal(byId.a.is_top3_eligible, false);
  assert.equal(byId.c.result_bucket, 'top3');
  assert.equal(byId.c.bucket_rank, 1);
  assert.equal(byId.b.bucket_rank, 2);
});

check('al patrulea confirmat trece in extended_confirmed', () => {
  const entries = ['a', 'b', 'c', 'd'].map((id, index) => ({
    id,
    display_name: id.toUpperCase(),
    recommendation_group: 'confirmed',
    recommendation_score: 100 - index,
  }));
  const bucketed = assignProfessionalBuckets(entries);
  assert.deepEqual(bucketed.map((item) => item.result_bucket), ['top3', 'top3', 'top3', 'extended_confirmed']);
});

check('ordinea este determinista la scor egal', () => {
  const a = { id: 'z', display_name: 'Ana', recommendation_score: 50, matched_specializations: [], matched_service_keys: [], best_location_trust: 'verified' };
  const b = { id: 'y', display_name: 'Bogdan', recommendation_score: 50, matched_specializations: [], matched_service_keys: [], best_location_trust: 'verified' };
  assert.ok(compareProfessionalEntries(a, b) < 0, 'la egalitate decide numele, alfabetic');
  assert.equal(compareProfessionalEntries(a, { ...a }), 0);
});

check('limita de rezultate este respectata', () => {
  const entries = Array.from({ length: 40 }, (_value, index) => ({
    id: `p${index}`,
    display_name: `P${index}`,
    recommendation_group: 'confirmed',
    recommendation_score: 100 - index,
  }));
  assert.equal(assignProfessionalBuckets(entries, 5).length, 5);
});

// --- Panoul de incredere ----------------------------------------------------------------------

check('panoul de incredere are aceeasi forma ca la locatii', () => {
  const confidence = buildProfessionalDecisionConfidence({
    professionalType: 'ophthalmologist',
    matchedSpecializations: ['glaucoma'],
    matchedServiceKeys: ['tonometry'],
    bestLocationTrust: 'verified',
    publicLocationCount: 2,
  });
  for (const key of ['level', 'label', 'summary', 'filled_segments', 'total_segments', 'evidence', 'limitations']) {
    assert.ok(key in confidence, `lipseste campul ${key}`);
  }
  assert.equal(confidence.total_segments, 3);
  assert.equal(confidence.commercial_influence, false);
});

check('panoul spune explicit ce nu stie VIASEE despre o persoana', () => {
  const confidence = buildProfessionalDecisionConfidence({ professionalType: 'optometrist' });
  assert.ok(
    confidence.limitations.some((item) => /program/i.test(item)),
    'panoul nu declara ca programul personal nu e confirmat',
  );
});

// --- Izolarea fata de motorul de locatii ---------------------------------------------------------

check('motorul de locatii nu a fost atins de stratul de specialisti', () => {
  for (const file of [
    'base44/functions/matchProvidersSemantic/entry.ts',
    'base44/functions/matchProviders/entry.ts',
    'shared/providerRecommendation.js',
  ]) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /professionalRecommendation|assignProfessionalBuckets|buildProfessionalRecommendationEntry/,
      `${file} a fost modificat de stratul de specialisti`,
    );
  }
});

check('functia de specialisti nu reinterpreteaza cererea', () => {
  const content = read('base44/functions/matchProfessionals/entry.ts');
  assert.doesNotMatch(
    content,
    /resolveServiceSearchQuery|InvokeLLM|buildPatientNeedPrompt/,
    'matchProfessionals a inceput sa interpreteze singur cererea',
  );
  assert.match(content, /service_keys \?\? payload\.resolved_service_keys/);
});

check('functia de specialisti nu are incredere in ce trimite clientul', () => {
  const content = read('base44/functions/matchProfessionals/entry.ts');
  assert.match(content, /isPublicLocation/, 'publicarea locatiei nu este recitita din baza');
  assert.match(content, /isPublicProfessionalProfile/, 'profilul nu este recitit din baza');
  assert.match(content, /visibility_consent_status === 'accepted'/, 'consimtamantul nu este recontrolat');
});

check('cardul de specialist deriva varianta strict din result_bucket', () => {
  const card = read('src/components/intake2/ProfessionalMatchResultCard.jsx');
  assert.match(card, /BUCKET_VARIANT\[professional\.result_bucket\]/);
  assert.doesNotMatch(card, /slice\(0,\s*3\)/, 'cardul nu are voie sa recalculeze Top 3');
});

check('lista de specialisti filtreaza pe bucket, nu pe pozitie', () => {
  const panel = read('src/components/intake2/ProfessionalResults.jsx');
  assert.match(panel, /result_bucket === "top3"/);
  assert.match(panel, /result_bucket === "extended_confirmed"/);
  assert.match(panel, /result_bucket === "extended_directory"/);
  assert.doesNotMatch(panel, /results\.slice\(0,\s*3\)/, 'Top 3 nu se taie pozitional');
});

check('selectorul de mod pastreaza contextul cererii, nu deschide o ruta noua', () => {
  const matchResults = read('src/components/intake2/MatchResults.jsx');
  assert.match(matchResults, /ResultModeTabs/);
  assert.match(matchResults, /<ProfessionalResults/);
  assert.match(matchResults, /meta=\{activeMeta\}/, 'panoul de specialisti nu primeste contextul cererii');
  assert.doesNotMatch(matchResults, /navigate\("\/specialisti/, 'comutarea nu are voie sa schimbe ruta');
});

check('trimiterea cererii ramane pe locatii, cu explicatie in tabul de specialisti', () => {
  const panel = read('src/components/intake2/ProfessionalResults.jsx');
  assert.doesNotMatch(panel, /PatientRequestSubmission/, 'cererea nu se distribuie catre persoane');
  assert.match(panel, /Vrei sa trimiti cererea\?/, 'lipseste explicatia pentru pacient');
});

check('rasfoirea din /cauta refoloseste aceeasi definitie de specialist public', () => {
  const client = read('src/lib/professionalSearch.js');
  assert.match(client, /browsePublicProfessionals/);
  assert.match(client, /invoke\("matchProfessionals"/g, 'rasfoirea nu are voie sa cheme un al doilea endpoint');
  const search = read('src/pages/Search.jsx');
  assert.match(search, /ResultModeTabs/, 'selectorul nu este acelasi ca in rezultate');
  assert.match(search, /ProfessionalDirectoryCard/);
});

check('cardul de rasfoire nu imprumuta vizualul de recomandare', () => {
  const card = read('src/components/results/ProfessionalDirectoryCard.jsx');
  assert.doesNotMatch(card, /result_bucket/, 'rasfoirea nu are bucket-uri');
  assert.doesNotMatch(card, /recommendation_score|DecisionConfidencePanel/, 'rasfoirea nu afiseaza scor sau incredere');
  assert.doesNotMatch(card, /top3/, 'rasfoirea nu are Top 3');
});

check('contextul rezolvat al cererii ajunge la tabul de specialisti', () => {
  const card = read('src/components/intake2/ConversationalCard.jsx');
  assert.match(card, /resolved_service_keys: Array\.isArray\(res\.data\.resolved_service_keys\)/,
    'meta nu poarta cheile de serviciu rezolvate, deci al doilea tab ar raspunde la alta intrebare');
  assert.match(card, /selected_locality_siruta_code: res\.data\.selected_locality_siruta_code/);
  assert.match(card, /query_scope: res\.data\.query_scope \|\| "locality"/);

  const matchResults = read('src/components/intake2/MatchResults.jsx');
  assert.match(matchResults, /resolved_service_keys: Array\.isArray\(data\.resolved_service_keys\)/,
    'dupa extinderea ariei, cheile rezolvate raman cele vechi');
});

// --- Raport ------------------------------------------------------------------------------------

const failed = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `\n      ${item.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} verificari trecute.`);
if (failed.length > 0) process.exit(1);
