// Numărătorile „ce așteaptă după mine” din panoul de admin (2026-10-07).
//
// O singură sursă pentru Panou, meniu și taburile Cozii de verificare. Fiecare număr este
//   - un număr (inclusiv 0), sau
//   - null = indisponibil (cererea a eșuat).
// Un eșec nu mai devine 0: înainte, „Totul e la zi” putea apărea și când o cerere căzuse sau
// când lista lentă a Cozii de verificare nu se încărcase încă (AdminDashboardHome / ActionQueueCard).
// Fără React; clientul Base44 se primește ca parametru, ca să poată fi verificat din scripts/.

export const REVIEW_PARTS = Object.freeze([
  { key: "workspace", label: "Modificări de profil și conținut", tab: "workspace" },
  { key: "locations", label: "Locații noi sau profiluri existente", tab: "locations" },
  { key: "lifecycle", label: "Schimbări de stare a locațiilor", tab: "lifecycle" },
  { key: "professionals", label: "Profiluri de specialiști", tab: "professionals" },
  { key: "patient_requests", label: "Cereri fără rezultate", tab: "patient_requests" },
  { key: "media_cleanup", label: "Fotografii de curățat", tab: "media_cleanup" },
]);

export const OTHER_QUEUES = Object.freeze([
  { key: "claims", label: "Revendicări noi", section: "revendicari" },
  { key: "tickets", label: "Tichete de suport active", section: "support_tickets" },
  { key: "corrections", label: "Sesizări de director deschise", section: "corectii" },
]);

export const ACTIVE_TICKET_STATUSES = Object.freeze(["open", "in_progress", "waiting_user"]);
export const OPEN_CORRECTION_STATUSES = Object.freeze(["submitted", "in_review"]);
export const ACTIVE_RECOVERY_STATUSES = Object.freeze(["queued", "in_review"]);

export function mergeById(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

// Aceeași combinație ca în tabul „Profil și conținut”: cererile de profil de organizație vin pe
// două căi, iar cele cu organizație nu se numără din lista generală.
export function mergeWorkspacePending(generalSubmissions, organizationSubmissions) {
  const general = (Array.isArray(generalSubmissions) ? generalSubmissions : [])
    .filter((submission) => !(submission.section === "public_profile" && submission.organization_id));
  return mergeById(general, organizationSubmissions);
}

const numberOrNull = (value) => (Number.isFinite(value) && value >= 0 ? value : null);

async function entityCount(entity, query) {
  try {
    return numberOrNull(await entity.count(query));
  } catch {
    return null;
  }
}

// Întoarce lista de la o funcție backend sau null dacă apelul a eșuat / a răspuns cu eroare.
async function invokeList(base44, name, payload, pick) {
  try {
    const response = await base44.functions.invoke(name, payload);
    if (response?.data?.error) return null;
    const list = pick(response?.data || {});
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export async function loadReviewCounts(base44) {
  const e = base44.entities;
  const [service, organization, expansion, identity, lifecycle, professionals, photos, recovery] = await Promise.all([
    invokeList(base44, "adminServiceConfigurationReview", { action: "list", status: "pending_review" }, (d) => d.submissions),
    invokeList(base44, "adminOrganizationProfileReview", { action: "list", status: "pending_review" }, (d) => d.submissions),
    invokeList(base44, "providerLocationExpansionOps", { action: "admin_list" }, (d) => d.submissions),
    invokeList(base44, "providerLocationIdentityResolutionOps", { action: "admin_list" }, (d) => d.submissions),
    invokeList(base44, "providerLocationLifecycleOps", { action: "admin_list" }, (d) => d.submissions),
    invokeList(base44, "adminProfessionalProfileReview", { action: "list", status: "pending_review" }, (d) => d.profiles),
    invokeList(base44, "providerPhotoUploadLifecycleOps", { action: "admin_cleanup_list" }, (d) => d.assets),
    entityCount(e.PatientRequestRecoveryCase, { status: { $in: [...ACTIVE_RECOVERY_STATUSES] } }),
  ]);
  return {
    workspace: service && organization ? mergeWorkspacePending(service, organization).length : null,
    locations: expansion && identity ? mergeById(expansion, identity).length : null,
    lifecycle: lifecycle ? lifecycle.length : null,
    professionals: professionals ? professionals.length : null,
    patient_requests: recovery,
    media_cleanup: photos ? photos.length : null,
  };
}

export async function loadAdminCounts(base44) {
  const e = base44.entities;
  const [review, claims, tickets, corrections, feedback] = await Promise.all([
    loadReviewCounts(base44),
    entityCount(e.ProviderClaimRequest, { status: "in_asteptare" }),
    entityCount(e.SupportTicket, { status: { $in: [...ACTIVE_TICKET_STATUSES] } }),
    entityCount(e.DirectoryCorrectionRequest, { status: { $in: [...OPEN_CORRECTION_STATUSES] } }),
    entityCount(e.UserFeedback, { status: "new" }),
  ]);
  return { review, claims, tickets, corrections, feedback, loadedAt: new Date().toISOString() };
}

// Cifrele de stare din Panou (nu sunt „de rezolvat”): număr sau null = indisponibil.
export async function loadDashboardKpis(base44, now = Date.now()) {
  const e = base44.entities;
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [published, patientRequests, proAccounts, claimedProfiles] = await Promise.all([
    entityCount(e.ProviderLocation, { status: "publicata" }),
    entityCount(e.PatientRequest, { created_date: { $gte: weekAgo } }),
    entityCount(e.ProviderSubscription, { plan_code: "pro", status: { $in: ["active", "trialing", "grace_period"] } }),
    entityCount(e.ProviderLocation, { profile_control_status: { $in: ["claimed", "verified"] } }),
  ]);
  return { published, patientRequests, proAccounts, claimedProfiles };
}

// Ultimele acțiuni făcute de oameni (administratori/furnizori), fără evenimentele de sistem în masă.
// null = indisponibil.
export async function loadRecentActivity(base44, limit = 6) {
  try {
    const rows = await base44.entities.DirectoryAuditRecord.filter({ admin_email: { $ne: null } }, "-created_date", limit);
    return Array.isArray(rows) ? rows : (rows?.items ?? null);
  } catch {
    return null;
  }
}

// Totalul Cozii de verificare: suma părților disponibile + lista celor indisponibile.
export function reviewTotal(review) {
  let total = 0;
  const unavailable = [];
  for (const part of REVIEW_PARTS) {
    const value = review?.[part.key];
    if (value === null || value === undefined) unavailable.push(part.key);
    else total += value;
  }
  return { total, unavailable };
}

// Rândurile cardului „De rezolvat acum”.
//   loaded=false  -> încă se încarcă (nu se afirmă nimic)
//   allClear=true -> numai dacă totul s-a încărcat, nimic nu e indisponibil și totul e 0
export function summarizeCounts(counts) {
  if (!counts) return { loaded: false, rows: [], unavailable: [], allClear: false, total: 0 };
  const rows = [];
  const unavailable = [];

  for (const part of REVIEW_PARTS) {
    const value = counts.review?.[part.key];
    if (value === null || value === undefined) unavailable.push(part.label);
    else if (value > 0) rows.push({ key: `review:${part.key}`, label: part.label, count: value, section: "workspace_reviews", tab: part.tab });
  }
  for (const queue of OTHER_QUEUES) {
    const value = counts[queue.key];
    if (value === null || value === undefined) unavailable.push(queue.label);
    else if (value > 0) rows.push({ key: queue.key, label: queue.label, count: value, section: queue.section });
  }
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { loaded: true, rows, unavailable, allClear: unavailable.length === 0 && rows.length === 0, total };
}

// Numărul afișat pe o intrare din meniu (null = nimic de arătat).
export function sidebarBadgeFor(counts, sectionKey) {
  if (!counts) return null;
  let value = null;
  if (sectionKey === "workspace_reviews") {
    const { total, unavailable } = reviewTotal(counts.review);
    value = unavailable.length === REVIEW_PARTS.length ? null : total;
  } else if (sectionKey === "revendicari") value = counts.claims;
  else if (sectionKey === "support_tickets") value = counts.tickets;
  else if (sectionKey === "corectii") value = counts.corrections;
  return Number.isFinite(value) && value > 0 ? value : null;
}
