import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Deterministic, read-only duplicate candidate detection. The public precheck
// context is deliberately limited to profiles already visible in the public
// directory. Admin and final submission contexts still inspect all records.
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOPWORDS = ['optica', 'optic', 'optical', 'clinica', 'cabinet', 'centrul', 'centru', 'medical', 'medicala', 'oftalmologie', 'oftalmologic', 'oftalmologica', 'laborator', 'srl'];
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOPWORDS.includes(t));
const digits = (s) => String(s || '').replace(/\D/g, '');
const domainOf = (u) => {
  const raw = String(u || '').trim();
  if (!raw) return '';
  try { return new URL(raw.includes('://') ? raw : 'https://' + raw).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
const emailNorm = (e) => String(e || '').trim().toLowerCase();

function overlapRatio(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / Math.min(a.length, b.length);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const p = await req.json().catch(() => ({}));
    const requestedContext = String(p.context || '');
    const isPublicPrecheck = requestedContext === 'provider_public_precheck';
    const user = await base44.auth.me().catch(() => null);

    if (!isPublicPrecheck && !user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    const context = isPublicPrecheck
      ? 'provider_public_precheck'
      : requestedContext === 'provider_new_location'
        ? 'provider_new_location'
        : 'admin_create';
    if (context === 'admin_create' && user?.role !== 'admin') return Response.json({ error: 'Acces interzis' }, { status: 403 });

    const svc = base44.asServiceRole;
    const cand = p.candidate || {};
    const limit = Math.min(Math.max(Number(p.limit) || 10, 1), isPublicPrecheck ? 8 : 25);
    const siruta = String(cand.locality_siruta_code || '').trim();
    if (!siruta) return Response.json({ error: 'locality_siruta_code este obligatoriu' }, { status: 400 });
    if (!String(cand.provider_profile_type || '').trim()) return Response.json({ error: 'provider_profile_type este obligatoriu' }, { status: 400 });

    const nameToks = tokens(cand.location_name);
    const nameNorm = norm(cand.location_name);
    const orgToks = tokens(cand.organization_name);
    const orgNorm = norm(cand.organization_name);
    const addrNorm = norm(cand.address);
    const addrToks = tokens(cand.address);
    const phone = digits(cand.phone_public);
    const domain = domainOf(cand.website);
    const email = emailNorm(cand.public_email);

    const [allLocs, allOrgs] = await Promise.all([
      svc.entities.ProviderLocation.list(null, 500),
      svc.entities.ProviderOrganization.list(null, 500),
    ]);
    const orgNameById = {};
    for (const o of allOrgs) orgNameById[o.id] = o.public_display_name || o.name || '';

    const candidates = [];
    for (const l of allLocs) {
      if (p.exclude_location_id && l.id === p.exclude_location_id) continue;
      if (isPublicPrecheck && (
        l.status !== 'publicata'
        || l.active_status === 'inactiva'
        || l.profile_control_status === 'suspended'
      )) continue;
      const lToks = tokens(l.public_display_name || l.name);
      const lOrgName = orgNameById[l.organization_id] || '';
      const sameLocality = String(l.locality_siruta_code || '').trim() !== '' && String(l.locality_siruta_code || '').trim() === siruta;
      const nameRatio = overlapRatio(nameToks, lToks);
      const similarName = nameToks.length > 0 && nameRatio >= 0.5;
      const verySimilarName = nameNorm !== '' && (nameNorm === norm(l.public_display_name || l.name) || nameRatio >= 0.8);
      const sameAddress = addrNorm !== '' && addrNorm === norm(l.address);
      const similarAddress = sameAddress || (addrToks.length > 0 && overlapRatio(addrToks, tokens(l.address)) >= 0.6);
      const samePhone = phone.length >= 6 && digits(l.phone_public || l.public_phone) === phone;
      const sameDomain = domain !== '' && domainOf(l.website_url || l.website) === domain;
      const sameEmail = email !== '' && emailNorm(l.public_email) === email;
      const sameOrgName = orgNorm !== '' && (orgNorm === norm(lOrgName) || (orgToks.length > 0 && overlapRatio(orgToks, tokens(lOrgName)) >= 0.8));

      const matched = [];
      if (verySimilarName) matched.push('nume foarte asemanator'); else if (similarName) matched.push('nume asemanator');
      if (sameAddress) matched.push('aceeasi adresa'); else if (similarAddress) matched.push('adresa asemanatoare');
      if (samePhone) matched.push('acelasi telefon public');
      if (sameDomain) matched.push('acelasi domeniu website');
      if (sameEmail) matched.push('acelasi email public');
      if (sameOrgName) matched.push('aceeasi organizatie');
      if (sameLocality && matched.length > 0) matched.push('aceeasi localitate');

      let severity = null;
      if (sameLocality && ((verySimilarName && similarAddress) || samePhone || (sameDomain && similarName))) severity = 'strong_duplicate';
      else if ((sameLocality && (similarName || sameDomain || sameOrgName)) || sameEmail) severity = 'possible_duplicate';
      else if ((sameOrgName || sameDomain || verySimilarName) && !sameLocality) severity = 'likely_distinct';
      if (!severity) continue;

      let score = 0;
      if (verySimilarName) score += 35; else if (similarName) score += 20;
      if (sameAddress) score += 30; else if (similarAddress) score += 15;
      if (samePhone) score += 40;
      if (sameDomain) score += 30;
      if (sameEmail) score += 25;
      if (sameOrgName) score += 20;
      if (sameLocality) score += 20;

      candidates.push({
        location_id: l.id,
        name: l.public_display_name || l.name || '',
        organization_name: lOrgName,
        provider_type: l.provider_type || '',
        provider_profile_type: l.provider_profile_type || '',
        locality_name: l.locality_name || l.city || '',
        county_name: l.county_name || l.county || '',
        address: l.address || '',
        profile_control_status: l.profile_control_status || 'directory',
        claim_action: ['claimed', 'verified'].includes(l.profile_control_status) || l.claim_verification_status === 'approved' ? 'request_access' : 'claim',
        severity,
        score,
        matched_fields: matched,
        recommended_action: severity === 'strong_duplicate' ? 'claim_existing' : severity === 'possible_duplicate' ? 'review_manually' : 'allow_new_with_reason',
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, limit);
    const blocking_level = top.some((c) => c.severity === 'strong_duplicate')
      ? 'strong_duplicate_review_required'
      : top.some((c) => c.severity === 'possible_duplicate') ? 'warning' : 'none';

    return Response.json({ candidates: top, blocking_level });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
