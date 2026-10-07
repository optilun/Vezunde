// Etichete și tonuri pentru campanii și contacte (2026-10-07). Fără React și fără importuri cu alias,
// ca să poată fi verificate din scripts/. Valorile tehnice (marketing / announcement, draft / paused ...)
// sunt cele din base44/shared/outreachAudiencePolicy.js.

export function normalizeCategory(value) {
  return value === "announcement" ? "announcement" : "marketing";
}

// Tokenii semantici din index.css (2026-10-07), nu culori scrise de mână.
export function categoryBadgeClass(category) {
  return normalizeCategory(category) === "announcement"
    ? "border-info-border bg-info-soft text-info"
    : "border-border bg-secondary text-foreground";
}

// Starea unei campanii: o singură sursă pentru listă și pentru detaliu.
export const CAMPAIGN_STATUS_LABELS = {
  draft: "Ciornă",
  ready: "Pregătită",
  sending: "Se trimite",
  sent: "Trimisă",
  paused: "Pauzată",
  failed: "Eșuată",
  cancelled: "Anulată",
};
const CAMPAIGN_STATUS_TONES = { draft: "neutral", ready: "info", sending: "info", sent: "success", paused: "warning", failed: "danger", cancelled: "neutral" };
export const campaignStatusLabel = (status) => CAMPAIGN_STATUS_LABELS[status] || status;
export const campaignStatusTone = (status) => CAMPAIGN_STATUS_TONES[status] || "neutral";

// O campanie oprită automat (prea multe respingeri / reclamație de spam) trebuie să sară în ochi.
export const HEALTH_PAUSE_REASONS = ["bounce_rate", "complaints"];
export const isAutoPausedCampaign = (campaign) => campaign?.status === "paused" && HEALTH_PAUSE_REASONS.includes(campaign.pause_reason);

// Starea unui contact (OutreachContact.status).
export const CONTACT_STATUS_LABELS = {
  new: "Nou",
  contacted: "Contactat",
  replied: "A răspuns",
  interested: "Interesat",
  not_interested: "Neinteresat",
  unsubscribed: "Dezabonat",
  converted: "Convertit",
  bounced: "Respins (bounce)",
  invalid: "Invalid",
  complained: "Plângere spam",
};
export function contactStatusTone(status) {
  if (["unsubscribed", "bounced", "invalid", "complained"].includes(status)) return "danger";
  if (["converted", "interested", "replied"].includes(status)) return "success";
  if (status === "contacted") return "info";
  return "neutral";
}

export function outcomeClass(outcome) {
  if (["delivered", "replied"].includes(outcome)) return "bg-success-soft text-success";
  if (outcome === "unsubscribed") return "bg-warning-soft text-warning";
  if (["bounced", "complained", "failed"].includes(outcome)) return "bg-danger-soft text-danger";
  if (outcome === "awaiting") return "bg-info-soft text-info";
  return "bg-secondary text-muted-foreground";
}

