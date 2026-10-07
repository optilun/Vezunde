import { base44 } from "@/api/base44Client";
import { ONBOARDING_PROVIDER_TYPES } from "@/lib/providerTaxonomy";
import { buildCsv } from "./csv";

// Etichete si ajutoare comune modulului de comunicare cu furnizorii. Valorile tehnice
// (marketing / announcement, directory / provider_account) sunt cele din
// base44/shared/outreachAudiencePolicy.js.

export const CATEGORY_OPTIONS = [
  {
    value: "marketing",
    label: "Marketing",
    description: "Prezentări și invitații: revendicarea profilului, beneficiile VIASEE, pentru cei care nu folosesc încă platforma.",
  },
  {
    value: "announcement",
    label: "Anunțuri",
    description: "Informări despre VIASEE: funcții noi, schimbări de reguli, mentenanța. Implicit către furnizorii cu cont.",
  },
];

export const CATEGORY_LABELS = { marketing: "Marketing", announcement: "Anunț" };

export {
  CAMPAIGN_STATUS_LABELS,
  CONTACT_STATUS_LABELS,
  HEALTH_PAUSE_REASONS,
  campaignStatusLabel,
  campaignStatusTone,
  categoryBadgeClass,
  contactStatusTone,
  isAutoPausedCampaign,
  normalizeCategory,
  outcomeClass,
} from "@/lib/adminOutreachLabels";

export const SOURCE_OPTIONS = [
  { value: "directory", label: "Contacte din director", hint: "Adresele publice ale locațiilor și organizațiilor listate." },
  { value: "provider_account", label: "Furnizori cu cont", hint: "Utilizatorii care au revendicat sau administrează un profil." },
];

export const SOURCE_LABELS = { directory: "Director", provider_account: "Cont furnizor" };

export const PROVIDER_TYPE_LABELS = {
  ...ONBOARDING_PROVIDER_TYPES,
  laborator_optic: "Laborator optic",
};

export const BLOCK_REASON_LABELS = {
  invalid_email: "Adresă invalidă",
  suppressed: "Dezabonat de la tot / respins / reclamație",
  unsubscribed_category: "Dezabonat de la această categorie",
  inactive_account: "Contul nu mai e activ",
  undeliverable_domain: "Domeniul nu primește email",
  missing_compliance: "Lipsesc temeiul legal sau sursa",
  duplicate: "Aceeași adresă apare deja în listă",
};

export const OUTCOME_LABELS = {
  queued: "În așteptare",
  awaiting: "Trimis, neconfirmat încă",
  delivered: "Livrat",
  replied: "Livrat, a răspuns",
  unsubscribed: "Livrat, s-a dezabonat",
  bounced: "Respins",
  complained: "Reclamație spam",
  failed: "Eșuat",
  not_sent: "Netrimis",
};

export const NOT_SENT_REASON_LABELS = {
  duplicate: "Adresă duplicată",
  undeliverable_domain: "Domeniul nu primește email",
  domain_dns_error: "Eroare DNS la domeniu",
  suppressed: "Dezabonat / suprimat",
  missing_compliance: "Lipsesc temeiul legal sau sursa",
  invalid_email: "Adresă invalidă",
  inactive_account: "Contul nu mai e activ",
  rejected_by_provider: "Adresă refuzată de serviciul de email",
  other: "Alt motiv",
};

export async function callOutreach(logicalName, action, payload = {}) {
  try {
    const response = await base44.functions.invoke(logicalName, { action, ...payload });
    return response.data || {};
  } catch (err) {
    return err.response?.data || { error: err.message };
  }
}

export function formatPercent(value) {
  return `${String(Number(value) || 0).replace(".", ",")}%`;
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// CSV pentru Excel: separator ';', BOM UTF-8 si celule protejate impotriva formulelor (vezi csv.js).
export function downloadCsv(filename, header, rows) {
  const blob = new Blob([buildCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
