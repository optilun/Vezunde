// Etichete în română pentru valorile tehnice din panoul de admin (2026-10-07, audit admin).
// Un singur loc: ecranele nu mai afișează coduri brute (`in_asteptare`, `none`, `submitted`,
// `update_service_configuration_draft`). Fără React, ca să poată fi verificat din scripts/.

export function humanizeCode(value) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  const spaced = text.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelFrom(map, value, fallback) {
  if (value === null || value === undefined || value === "") return fallback ?? "—";
  return map[value] || humanizeCode(value);
}

// Tonurile sunt cele semantice din StatusBadge: neutral | success | warning | danger | info.

export const CLAIM_STATUS_LABELS = Object.freeze({
  in_asteptare: "În așteptare",
  needs_more_info: "Așteaptă completări",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
});
const CLAIM_STATUS_TONES = { in_asteptare: "warning", needs_more_info: "info", aprobata: "success", respinsa: "danger" };
export const claimStatusLabel = (status) => labelFrom(CLAIM_STATUS_LABELS, status, "În așteptare");
export const claimStatusTone = (status) => CLAIM_STATUS_TONES[status] || "neutral";

// Cine spune furnizorul că este față de afacere (ProviderClaimRequest.claimant_relationship).
export const CLAIM_RELATIONSHIP_LABELS = Object.freeze({
  owner: "Proprietar",
  organization_representative: "Reprezentant al organizației",
  location_manager: "Manager de locație",
  authorized_staff: "Personal autorizat",
});
export const claimRelationshipLabel = (value) => labelFrom(CLAIM_RELATIONSHIP_LABELS, value, "—");

// Starea cererii pe fiecare locație din revendicare (ProviderClaimLocationSelection.request_status).
export const SELECTION_REQUEST_LABELS = Object.freeze({
  pending: "În așteptare",
  not_requested: "Nesolicitată",
  approved: "Aprobată",
  rejected: "Respinsă",
});
const SELECTION_REQUEST_TONES = { pending: "warning", approved: "success", rejected: "danger" };
export const selectionRequestLabel = (value) => labelFrom(SELECTION_REQUEST_LABELS, value, "—");
export const selectionRequestTone = (value) => SELECTION_REQUEST_TONES[value] || "neutral";

// Legătura locației cu organizația (ProviderClaimLocationSelection.organization_link_status).
export const ORGANIZATION_LINK_LABELS = Object.freeze({
  confirmed: "legătură confirmată",
  probable: "legătură probabilă",
  conflict: "legătură în conflict",
  rejected: "legătură respinsă",
  unassigned: "fără organizație",
});
export const organizationLinkLabel = (value) => labelFrom(ORGANIZATION_LINK_LABELS, value, "legătură necunoscută");

export const CORRECTION_STATUS_LABELS = Object.freeze({
  submitted: "Nouă",
  in_review: "În verificare",
  needs_more_info: "Așteaptă completări",
  resolved: "Rezolvată",
  rejected: "Respinsă",
});
const CORRECTION_STATUS_TONES = { submitted: "info", in_review: "warning", needs_more_info: "info", resolved: "success", rejected: "danger" };
export const correctionStatusLabel = (status) => labelFrom(CORRECTION_STATUS_LABELS, status);
export const correctionStatusTone = (status) => CORRECTION_STATUS_TONES[status] || "neutral";

export const LOCATION_STATUS_LABELS = Object.freeze({
  draft: "Ciornă",
  in_verificare: "În verificare",
  publicata: "Publicată",
  suspendata: "Suspendată",
});
export const locationStatusLabel = (status) => labelFrom(LOCATION_STATUS_LABELS, status, "Necunoscut");

// Controlul profilului (ProviderLocation.profile_control_status), în cuvinte.
export const PROFILE_CONTROL_LABELS = Object.freeze({
  directory: "Din director",
  claimed: "Revendicat",
  verified: "Verificat",
  suspended: "Suspendat",
});
export const profileControlLabel = (status) => labelFrom(PROFILE_CONTROL_LABELS, status, "Necunoscut");

// De ce un fișier foto a ajuns în coada de curățare (ProviderMediaAsset.cleanup_reason).
export const MEDIA_CLEANUP_REASON_LABELS = Object.freeze({
  upload_replaced_before_attachment: "Încărcare înlocuită înainte de atașare",
  photo_draft_replaced: "Ciornă de fotografie înlocuită",
  photo_draft_withdrawn: "Ciornă de fotografie retrasă",
  submission_rejected: "Fotografie respinsă",
  submission_withdrawn: "Cerere retrasă de furnizor",
  submission_approved: "Înlocuită de o fotografie aprobată",
});
export const mediaCleanupReasonLabel = (reason) => labelFrom(MEDIA_CLEANUP_REASON_LABELS, reason, "Fișier nefolosit");

// Cât de sensibil e un serviciu (LocationService.service_need_level): decide dacă poate intra în recomandări.
export const SERVICE_NEED_LEVEL_LABELS = Object.freeze({
  general: "General",
  technical: "Tehnic",
  specialized_medical: "Medical specializat",
  unknown: "Necunoscut",
});
export const serviceNeedLevelLabel = (level) => labelFrom(SERVICE_NEED_LEVEL_LABELS, level, "General");

// Jurnalul emailurilor automate (CommunicationDelivery).
export const DELIVERY_STATUS_LABELS = Object.freeze({
  pending: "În așteptare",
  sent: "Trimis",
  failed: "Eșuat",
  skipped: "Sărit",
});
const DELIVERY_STATUS_TONES = { pending: "warning", sent: "success", failed: "danger", skipped: "neutral" };
export const deliveryStatusLabel = (status) => labelFrom(DELIVERY_STATUS_LABELS, status, "În așteptare");
export const deliveryStatusTone = (status) => DELIVERY_STATUS_TONES[status] || "neutral";

export const DELIVERY_RECIPIENT_LABELS = Object.freeze({
  provider_user: "Utilizator furnizor",
  provider_location: "Locație furnizor",
  patient_contact: "Contact pacient",
});
export const deliveryRecipientLabel = (type) => labelFrom(DELIVERY_RECIPIENT_LABELS, type, "—");

export const DELIVERY_CHANNEL_LABELS = Object.freeze({ email: "Email", in_app: "În aplicație" });
export const deliveryChannelLabel = (channel) => labelFrom(DELIVERY_CHANNEL_LABELS, channel, "Email");

// Suport: tichete (SupportTicket) și feedback (UserFeedback).
// „Deschis” și „În lucru” cer o acțiune de la tine, „Așteaptă utilizatorul” nu (neutru).
export const TICKET_STATUS_LABELS = Object.freeze({
  open: "Deschis",
  in_progress: "În lucru",
  waiting_user: "Așteaptă utilizatorul",
  resolved: "Rezolvat",
  closed: "Închis",
});
const TICKET_STATUS_TONES = { open: "info", in_progress: "warning", waiting_user: "neutral", resolved: "success", closed: "neutral" };
export const ticketStatusLabel = (status) => labelFrom(TICKET_STATUS_LABELS, status, "Deschis");
export const ticketStatusTone = (status) => TICKET_STATUS_TONES[status || "open"] || "neutral";

export const TICKET_PRIORITY_LABELS = Object.freeze({ low: "Scăzută", normal: "Normală", high: "Ridicată", urgent: "Urgentă" });
const TICKET_PRIORITY_TONES = { high: "warning", urgent: "danger" };
export const ticketPriorityLabel = (priority) => labelFrom(TICKET_PRIORITY_LABELS, priority, "Normală");
export const ticketPriorityTone = (priority) => TICKET_PRIORITY_TONES[priority] || "neutral";

export const TICKET_CATEGORY_LABELS = Object.freeze({
  account: "Cont și autentificare",
  organization: "Organizație sau locație",
  professional: "Profil profesional",
  patient_request: "Solicitări pacienți",
  technical: "Problemă tehnică",
  other: "Altă situație",
});
export const ticketCategoryLabel = (category) => labelFrom(TICKET_CATEGORY_LABELS, category, "Suport");

// De unde a venit mesajul (SupportTicket.source / UserFeedback.source).
export const SUPPORT_SOURCE_LABELS = Object.freeze({
  help_center: "Ajutor și suport",
  account_deletion_request: "Cerere de ștergere a contului",
  account_sidebar: "Meniul contului",
});
export const supportSourceLabel = (source) => labelFrom(SUPPORT_SOURCE_LABELS, source, "—");

export const FEEDBACK_STATUS_LABELS = Object.freeze({ new: "Nou", reviewed: "Revizuit", archived: "Arhivat" });
const FEEDBACK_STATUS_TONES = { new: "info", reviewed: "success", archived: "neutral" };
export const feedbackStatusLabel = (status) => labelFrom(FEEDBACK_STATUS_LABELS, status, "Nou");
export const feedbackStatusTone = (status) => FEEDBACK_STATUS_TONES[status || "new"] || "neutral";

export const ACCOUNT_MODE_LABELS = Object.freeze({
  personal: "Cont personal",
  provider: "Organizație / furnizor",
  professional: "Profil profesional",
  applicant: "Solicitant",
});
export const accountModeLabel = (mode) => labelFrom(ACCOUNT_MODE_LABELS, mode, "Cont");

export const ACTIVE_STATUS_LABELS = Object.freeze({ activa: "Activă", inactiva: "Inactivă" });
export const activeStatusLabel = (status) => labelFrom(ACTIVE_STATUS_LABELS, status, "Necunoscut");

export const PUBLIC_VISIBILITY_LABELS = Object.freeze({
  approved: "Vizibil",
  draft: "Ciornă",
  pending: "În așteptare",
  pending_review: "În verificare",
  hidden: "Ascuns",
  archived: "Arhivat",
  rejected: "Respins",
});
export const publicVisibilityLabel = (status) => labelFrom(PUBLIC_VISIBILITY_LABELS, status, "Nesetat");

export const CLAIM_VERIFICATION_LABELS = Object.freeze({
  none: "Fără revendicare",
  pending: "În verificare",
  approved: "Aprobată",
  rejected: "Respinsă",
});
export const claimVerificationLabel = (status) => labelFrom(CLAIM_VERIFICATION_LABELS, status, "Fără revendicare");

// Starea unui profil, într-un singur cuvânt-cheie, pentru liste (înlocuiește patru insigne).
export function profileStateOf(location) {
  const control = location?.profile_control_status || "directory";
  if (control === "suspended" || location?.status === "suspendata") return { key: "suspended", label: "Suspendat", tone: "danger" };
  if (control === "verified") {
    return location?.status === "publicata"
      ? { key: "verified", label: "Verificat", tone: "success" }
      : { key: "verified_unpublished", label: "Verificat, nepublicat", tone: "warning" };
  }
  if (control === "claimed") {
    return location?.status === "publicata"
      ? { key: "claimed", label: "Revendicat", tone: "info" }
      : { key: "claimed_unpublished", label: "Revendicat, nepublicat", tone: "warning" };
  }
  if (location?.status === "publicata") return { key: "directory", label: "Din director", tone: "neutral" };
  return { key: "directory_unpublished", label: `Director · ${locationStatusLabel(location?.status).toLowerCase()}`, tone: "warning" };
}

// ---------- Istoric audit ----------

export const AUDIT_ACTION_LABELS = Object.freeze({
  // Organizații și locații
  create_organization: "Organizație creată",
  create_directory_location: "Locație adăugată în director",
  create_from_duplicate_review_distinct: "Locație creată după verificarea unui duplicat",
  approve_duplicate_review_as_distinct: "Duplicat aprobat ca locație distinctă",
  duplicate_override_create: "Locație creată peste o potrivire confirmată",
  archive_rejected_new_location: "Locație respinsă, arhivată",
  archive_rejected_new_location_organization: "Organizația locației respinse, arhivată",
  approve_new_organization_location: "Locație nouă aprobată",
  organization_merge: "Organizații îmbinate",
  hide_profile: "Profil ascuns",
  hide_location_from_directory_correction: "Locație ascunsă după o sesizare",
  approve_hide_location: "Ascundere de locație aprobată",
  admin_set_location_hours: "Program setat de administrator",
  directory_geocode_from_address: "Poziție pe hartă calculată din adresă",
  data_integrity_repair: "Reparație de date aplicată",
  backfill_matching_allowed: "Eligibilitatea pentru recomandări a fost recalculată",
  backfill_organization_profile_from_location: "Profil de organizație completat din locație",
  preserve_legacy_location_logo: "Logo vechi păstrat în profilul organizației",
  migrate_location_photo_to_organization_logo: "Fotografie mutată ca logo al organizației",
  clear_legacy_logo_from_location_photo: "Logo vechi scos din fotografia locației",
  demo_cleanup_manifest: "Curățare date demo",
  cleanup_test_data: "Curățare date de test",
  national_audit_source_correction: "Corecție de sursă (audit național)",

  // Control profil
  verify_profile: "Profil verificat",
  suspend_profile: "Profil suspendat",
  unsuspend_profile: "Suspendare ridicată",
  revert_incomplete_verification: "Verificare incompletă retrasă",
  approve_profile_changes: "Modificări de profil aprobate",

  // Revendicări și acces
  approve_claim: "Revendicare aprobată",
  reject_claim: "Revendicare respinsă",
  approve_provider_scoped_claim: "Revendicare aprobată",
  reject_provider_scoped_claim: "Revendicare respinsă",
  submit_provider_scoped_claim: "Revendicare trimisă",
  submit_existing_location_association: "Cerere de asociere la un profil existent",
  sync_organization_wide_access: "Acces la nivel de organizație sincronizat",
  set_provider_member_access: "Acces de membru modificat",
  add_self_as_location_specialist: "Adăugat ca specialist în locație",
  create_provider_member_invitation: "Invitație de membru creată",
  revoke_provider_member_invitation: "Invitație de membru anulată",
  accept_provider_member_invitation: "Invitație de membru acceptată",
  create_professional_invitation: "Invitație de specialist creată",
  revoke_professional_invitation: "Invitație de specialist anulată",
  accept_professional_invitation: "Invitație de specialist acceptată",

  // Cereri de modificare (workspace)
  create_draft: "Ciornă creată",
  update_draft: "Ciornă actualizată",
  submit_for_review: "Trimis spre verificare",
  approve_submission: "Cerere aprobată",
  reject_submission: "Cerere respinsă",
  request_more_info: "Completări solicitate",
  withdraw_submission: "Cerere retrasă",
  discard_noop_submission: "Cerere fără schimbări, eliminată",
  apply_workspace_submission: "Datele locației au fost aplicate",
  apply_services_submission: "Serviciile au fost aplicate",
  apply_article_submission: "Articolul a fost aplicat",
  apply_media_submission: "Fotografia a fost aplicată",
  create_service_configuration_draft: "Servicii: ciornă creată",
  update_service_configuration_draft: "Servicii: ciornă actualizată",
  submit_service_configuration_for_review: "Servicii: trimise spre verificare",
  withdraw_service_configuration: "Servicii: cerere retrasă",
  take_over_service_configuration: "Servicii: ciornă preluată",
  approve_organization_profile: "Profilul organizației a fost aprobat",
  reject_organization_profile: "Profilul organizației a fost respins",
  create_organization_profile_draft: "Ciornă de profil organizațional creată",
  submit_organization_profile_review: "Profil organizațional trimis spre verificare",
  update_operating_hours: "Program actualizat",
  provider_fast_path_schedule_update: "Program actualizat de furnizor",
  provider_fast_path_routine_update: "Date curente actualizate de furnizor",
  provider_copy_opening_hours: "Program copiat între locații",
  provider_copy_services_draft: "Ciornă de servicii copiată între locații",
  provider_organization_logo_submitted_for_review: "Logo trimis spre verificare",
  approve_organization_logo: "Logo aprobat",

  // Fotografii
  create_location_photo_draft: "Ciornă de fotografie creată",
  submit_location_photo_review: "Fotografie trimisă spre verificare",
  approve_location_photo: "Fotografie aprobată",
  remove_location_photo: "Fotografie eliminată",
  withdraw_location_photo_draft: "Ciornă de fotografie retrasă",
  register_location_photo_upload: "Fișier de fotografie înregistrat",
  attach_location_photo_to_draft: "Fotografie atașată la ciornă",
  complete_location_photo_cleanup: "Curățare de fotografie încheiată",
  request_more_info_location_photo: "Completări cerute pentru fotografie",

  // Stare locație
  withdraw_location_lifecycle_request: "Cerere de schimbare a stării retrasă",
  request_more_info_location_lifecycle: "Completări cerute pentru schimbarea stării",

  // Specialiști
  approve_professional_profile: "Profil de specialist aprobat",
  reject_professional_profile: "Profil de specialist respins",
  archive_professional_profile: "Profil de specialist arhivat",
  request_more_info_professional_profile: "Completări cerute pentru profil de specialist",
  request_professional_association: "Cerere de asociere specialist–locație",
  approve_professional_association: "Asociere specialist–locație aprobată",
  withdraw_professional_association_request: "Cerere de asociere retrasă",
  deactivate_professional_assignment_by_provider: "Asociere de specialist dezactivată de furnizor",
  deactivate_professional_assignment_by_professional: "Asociere dezactivată de specialist",
  hide_professional_assignment_by_provider: "Asociere de specialist ascunsă",

  // Sesizări
  submit_directory_correction_request: "Sesizare trimisă",
  start_directory_correction_review: "Sesizare preluată",
  request_more_info_directory_correction: "Sesizare: completări cerute",
  reject_directory_correction: "Sesizare respinsă",
  resolve_directory_correction: "Sesizare rezolvată",

  // Research
  add_evidence: "Dovadă adăugată",
  supersede_evidence: "Dovadă înlocuită",
  set_evidence_status: "Stare dovadă schimbată",
  set_checklist_item: "Listă de verificare actualizată",
  set_research_status: "Stare research schimbată",
  set_research_notes: "Note de research actualizate",
  assign_research: "Research atribuit",
  set_public_links: "Linkuri publice setate",
  add_service: "Serviciu adăugat",
  set_service_confirmation: "Confirmare de serviciu schimbată",
  apply_research_service: "Serviciu aplicat din research",
  apply_research_services_batch: "Servicii aplicate din research (lot)",
  rollback_research_service: "Serviciu din research retras",
  research_service_batch_created: "Lot de servicii creat",
  research_service_batch_completed: "Lot de servicii finalizat",
  research_service_batch_rolled_back: "Lot de servicii retras",

  // Import
  directory_import_location_created: "Import: locație creată",
  directory_import_location_updated: "Import: locație actualizată",
  directory_import_row_overridden: "Import: rând suprascris manual",
  directory_profile_published_basic: "Import: profil publicat (de bază)",

  // Campanii
  outreach_campaign_created: "Campanie creată",
  outreach_campaign_approved: "Campanie aprobată",
  outreach_campaign_paused: "Campanie pusă pe pauză",
  outreach_campaign_resumed: "Campanie reluată",
  outreach_campaign_cancelled: "Campanie anulată",
  outreach_campaign_auto_paused: "Campanie oprită automat",
  outreach_campaign_daily_limit_changed: "Limita zilnică a campaniei schimbată",
});

export const AUDIT_ENTITY_LABELS = Object.freeze({
  ProviderOrganization: "Organizație",
  ProviderLocation: "Locație",
  ProviderWorkspaceSubmission: "Cerere de modificare",
  ProviderClaimRequest: "Revendicare",
  LocationService: "Serviciu",
  ProfessionalProfile: "Specialist",
  ProfessionalLocationAssignment: "Asociere specialist",
  DirectoryCorrectionRequest: "Sesizare",
  OutreachCampaign: "Campanie",
  DemoCleanup: "Sistem",
});

export const AUDIT_FIELD_LABELS = Object.freeze({
  public_display_name: "nume public",
  public_description: "descriere",
  public_phone: "telefon public",
  public_email: "email public",
  website_url: "website",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
  address: "adresă",
  lat: "latitudine",
  lng: "longitudine",
  place_id: "poziție Google Maps",
  photo_url: "fotografie",
  opening_hours: "program",
  opening_hours_json: "program structurat",
  profile_control_status: "stare profil",
  claim_verification_status: "stare revendicare",
  matching_allowed: "eligibilitate pentru recomandări",
  services: "servicii",
  status: "stare",
});

export const auditActionLabel = (action) => AUDIT_ACTION_LABELS[action] || humanizeCode(action || "Acțiune");
export const auditEntityLabel = (entity) => AUDIT_ENTITY_LABELS[entity] || (entity ? String(entity) : "Entitate");
export const auditFieldLabel = (field) => AUDIT_FIELD_LABELS[field] || String(field || "").replaceAll("_", " ");

// Cine a făcut acțiunea: „system” (job/automatizare), „provider” (flux de furnizor) sau „admin”.
export function auditActorType(record) {
  const email = String(record?.admin_email || "").toLowerCase();
  if (!email || email.includes("system") || record?.admin_user_id === null) return "system";
  const action = String(record?.action_type || "");
  if (
    action.startsWith("provider_")
    || action.includes("draft")
    || action === "submit_for_review"
    || action === "submit_location_photo_review"
    || action === "submit_organization_profile_review"
  ) return "provider";
  return "admin";
}

export function auditActorLabel(record) {
  const type = auditActorType(record);
  if (type === "system") return "Sistem";
  if (type === "provider") return record?.admin_email || "Furnizor";
  return record?.admin_email || "Administrator";
}

// Evenimentele identice, consecutive (aceeași acțiune, același actor, aceeași entitate), se strâng
// într-un singur rând „N ×”. O operație în masă (ex. 1.000 de corecții de sursă) nu mai ascunde
// restul istoricului. Grupurile mai mici de `minRun` rămân rânduri separate.
export function collapseAuditRuns(records, { minRun = 3 } = {}) {
  const rows = Array.isArray(records) ? records : [];
  const output = [];
  let index = 0;
  while (index < rows.length) {
    const head = rows[index];
    const key = `${head.action_type}|${auditActorType(head)}|${head.admin_email || ""}|${head.entity_type}`;
    let end = index + 1;
    while (end < rows.length) {
      const next = rows[end];
      if (`${next.action_type}|${auditActorType(next)}|${next.admin_email || ""}|${next.entity_type}` !== key) break;
      end += 1;
    }
    const run = rows.slice(index, end);
    if (run.length >= minRun) output.push({ kind: "group", key: `${head.id}-group`, count: run.length, records: run, head });
    else for (const record of run) output.push({ kind: "single", key: record.id, record });
    index = end;
  }
  return output;
}
