import { getCanonicalServiceDefinition } from './canonicalServiceRegistryExtended.js';

export const PROVIDER_RECOMMENDATION_CONTRACT_VERSION = 'provider-recommendation-v1';

const PROFILE_POINTS = Object.freeze({
  verified: 12,
  claimed: 6,
  directory: 0,
});

const PROFILE_ORDER = Object.freeze({
  verified: 2,
  claimed: 1,
  directory: 0,
});

const AVAILABILITY_LABELS = Object.freeze({
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
});

const AVAILABILITY_STALE_DAYS = 30;
const TIMING_AVAILABILITY_POINTS = Object.freeze({
  cat_mai_repede: 5,
  zilele_urmatoare: 4,
  saptamana_aceasta: 2,
  nu_e_urgent: 0,
});

function clean(value) {
  return String(value || '').trim();
}

function round(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function unique(values) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

export function getFreshAvailability(location, now = Date.now()) {
  const status = clean(location?.availability_status);
  const updatedAt = clean(location?.availability_updated_at);
  if (!status || status === 'necunoscuta' || !updatedAt) return null;
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const ageDays = (Number(now) - timestamp) / 86400000;
  if (ageDays < 0 || ageDays > AVAILABILITY_STALE_DAYS) return null;
  const label = AVAILABILITY_LABELS[status];
  return label ? { status, label, age_days: round(ageDays) } : null;
}

export function buildRecommendationScore({
  matchedServiceKeys = [],
  semanticScoreByKey = {},
  profileControlStatus = 'directory',
  availability = null,
  timingKey = '',
} = {}) {
  const matched = unique(matchedServiceKeys);
  const semanticScores = matched
    .map((key) => Number(semanticScoreByKey?.[key]) || 0)
    .filter((value) => value > 0);
  const bestSemanticScore = semanticScores.length > 0 ? Math.max(...semanticScores) : 0;
  const serviceMatch = matched.length > 0 ? Math.min(51, 35 + ((matched.length - 1) * 8)) : 0;
  const semanticFit = Math.min(24, bestSemanticScore * 24);
  const profileTrust = PROFILE_POINTS[profileControlStatus] || 0;
  const availabilityPoints = availability
    ? (TIMING_AVAILABILITY_POINTS[clean(timingKey)] || 0)
    : 0;
  const components = {
    service_match: round(serviceMatch),
    semantic_fit: round(semanticFit),
    profile_trust: round(profileTrust),
    availability: round(availabilityPoints),
  };
  return {
    total: round(Object.values(components).reduce((sum, value) => sum + value, 0)),
    components,
    best_semantic_score: round(bestSemanticScore),
    matched_service_count: matched.length,
  };
}

export function buildRecommendationExplanations({
  matchedServiceKeys = [],
  profileControlStatus = 'directory',
  availability = null,
} = {}) {
  const explanations = unique(matchedServiceKeys).slice(0, 2).map((key) => ({
    code: 'confirmed_service_match',
    label: `Ofera ${getCanonicalServiceDefinition(key)?.label || key}`,
    service_key: key,
  }));

  if (profileControlStatus === 'verified') {
    explanations.push({ code: 'verified_location_profile', label: 'Profil de locație verificat de VIASEE' });
  } else if (profileControlStatus === 'claimed') {
    explanations.push({ code: 'claimed_location_profile', label: 'Profil administrat de furnizor' });
  } else {
    explanations.push({ code: 'directory_profile', label: 'Profil din director, neconfirmat integral' });
  }

  if (availability?.label) {
    explanations.push({ code: 'fresh_availability', label: availability.label });
  }

  return explanations.slice(0, 4);
}

export function getRecommendationConfidence({
  profileControlStatus = 'directory',
  matchedServiceKeys = [],
  bestSemanticScore = 0,
} = {}) {
  const count = unique(matchedServiceKeys).length;
  if (profileControlStatus === 'verified' && (count > 1 || Number(bestSemanticScore) >= 0.75)) return 'high';
  if (['verified', 'claimed'].includes(profileControlStatus) && count > 0) return 'medium';
  return 'limited';
}

// 2026-09-01 (audit cautare/recomandare LLM, sectiunea 3.2): pentru o nevoie
// specializata/medicala, un profil doar "claimed" (neverificat) nu mai intra in
// bucket-ul "confirmed" - deci nu mai poate ajunge in Top 3. Fara asta, cautarea putea
// arata ca prima optiune un profil pe care providerLeadEligibility.js l-ar respinge
// oricum la trimiterea efectiva a cererii (acolo se cere deja "verified" pentru
// specialized_medical) - pacientul vedea o recomandare de incredere pe care platforma
// insasi n-ar fi trimis-o mai departe. Ramane vizibil (bucket "directory", sub cele
// confirmate), nu e ascuns: datele lui sunt reale, doar increderea nu e suficienta
// pentru o decizie medicala fara verificare suplimentara.
export function recommendationBucketForProfile(profileControlStatus, needLevel = 'general') {
  const status = clean(profileControlStatus) || 'directory';
  if (needLevel === 'specialized_medical') {
    return status === 'verified' ? 'confirmed' : 'directory';
  }
  return ['verified', 'claimed'].includes(status) ? 'confirmed' : 'directory';
}

export function compareRecommendationEntries(a, b) {
  const scoreDifference = (Number(b?.recommendation_score) || 0) - (Number(a?.recommendation_score) || 0);
  if (scoreDifference !== 0) return scoreDifference;
  const semanticDifference = (Number(b?.semantic_match_score) || 0) - (Number(a?.semantic_match_score) || 0);
  if (semanticDifference !== 0) return semanticDifference;
  const serviceDifference = (b?.matched_service_keys?.length || 0) - (a?.matched_service_keys?.length || 0);
  if (serviceDifference !== 0) return serviceDifference;
  const trustDifference = (PROFILE_ORDER[b?.profile_control_status] || 0) - (PROFILE_ORDER[a?.profile_control_status] || 0);
  if (trustDifference !== 0) return trustDifference;
  const nameDifference = clean(a?.name).localeCompare(clean(b?.name), 'ro');
  if (nameDifference !== 0) return nameDifference;
  return clean(a?.id).localeCompare(clean(b?.id), 'ro');
}

export function assignRecommendationBuckets(entries = [], limit = 20) {
  const sorted = [...entries].sort(compareRecommendationEntries);
  const confirmed = sorted.filter((entry) => entry.recommendation_group === 'confirmed');
  const directory = sorted.filter((entry) => entry.recommendation_group === 'directory');
  const visible = [...confirmed, ...directory].slice(0, Math.max(1, Number(limit) || 20));
  let confirmedRank = 0;
  let directoryRank = 0;
  return visible.map((entry) => {
    if (entry.recommendation_group === 'confirmed') {
      confirmedRank += 1;
      return {
        ...entry,
        result_bucket: confirmedRank <= 3 ? 'top3' : 'extended_confirmed',
        bucket_rank: confirmedRank,
        is_top3_eligible: true,
      };
    }
    directoryRank += 1;
    return {
      ...entry,
      result_bucket: 'extended_directory',
      bucket_rank: directoryRank,
      is_top3_eligible: false,
    };
  });
}
