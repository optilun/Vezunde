import { base44 } from "@/api/base44Client";
import { ONBOARDING_PROVIDER_TYPES } from "@/lib/providerTaxonomy";

// Etichete si ajutoare comune modulului de comunicare cu furnizorii. Valorile tehnice
// (marketing / announcement, directory / provider_account) sunt cele din
// base44/shared/outreachAudiencePolicy.js.

export const CATEGORY_OPTIONS = [
  {
    value: "marketing",
    label: "Marketing",
    description: "Prezentari si invitatii: revendicarea profilului, beneficiile VIASEE, pentru cei care nu folosesc inca platforma.",
  },
  {
    value: "announcement",
    label: "Anunturi",
    description: "Informari despre VIASEE: functii noi, schimbari de reguli, mentenanta. Implicit catre furnizorii cu cont.",
  },
];

export const CATEGORY_LABELS = { marketing: "Marketing", announcement: "Anunt" };

export function normalizeCategory(value) {
  return value === "announcement" ? "announcement" : "marketing";
}

export function categoryBadgeClass(category) {
  return normalizeCategory(category) === "announcement"
    ? "border-sky-200 bg-sky-50 text-sky-800"
    : "border-violet-200 bg-violet-50 text-violet-800";
}

export const SOURCE_OPTIONS = [
  { value: "directory", label: "Contacte din director", hint: "Adresele publice ale locatiilor si organizatiilor listate." },
  { value: "provider_account", label: "Furnizori cu cont", hint: "Utilizatorii care au revendicat sau administreaza un profil." },
];

export const SOURCE_LABELS = { directory: "Director", provider_account: "Cont furnizor" };

export const PROVIDER_TYPE_LABELS = {
  ...ONBOARDING_PROVIDER_TYPES,
  laborator_optic: "Laborator optic",
};

export const BLOCK_REASON_LABELS = {
  invalid_email: "Adresa invalida",
  suppressed: "Dezabonat de la tot / respins / reclamatie",
  unsubscribed_category: "Dezabonat de la aceasta categorie",
  inactive_account: "Contul nu mai e activ",
  undeliverable_domain: "Domeniul nu primeste email",
  missing_compliance: "Lipsesc temeiul legal sau sursa",
  duplicate: "Aceeasi adresa apare deja in lista",
};

export const OUTCOME_LABELS = {
  queued: "In asteptare",
  awaiting: "Trimis, neconfirmat inca",
  delivered: "Livrat",
  replied: "Livrat, a raspuns",
  unsubscribed: "Livrat, s-a dezabonat",
  bounced: "Respins",
  complained: "Reclamatie spam",
  failed: "Esuat",
  not_sent: "Netrimis",
};

export function outcomeClass(outcome) {
  if (["delivered", "replied"].includes(outcome)) return "bg-green-50 text-green-800";
  if (outcome === "unsubscribed") return "bg-amber-50 text-amber-800";
  if (["bounced", "complained", "failed"].includes(outcome)) return "bg-red-50 text-red-800";
  if (outcome === "awaiting") return "bg-blue-50 text-blue-800";
  return "bg-secondary text-muted-foreground";
}

export const NOT_SENT_REASON_LABELS = {
  duplicate: "Adresa duplicat",
  undeliverable_domain: "Domeniul nu primeste email",
  domain_dns_error: "Eroare DNS la domeniu",
  suppressed: "Dezabonat / suprimat",
  missing_compliance: "Lipsesc temeiul legal sau sursa",
  invalid_email: "Adresa invalida",
  inactive_account: "Contul nu mai e activ",
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

// CSV pentru Excel: separator ';' (setarea regionala romaneasca) si BOM UTF-8.
export function downloadCsv(filename, header, rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header, ...rows].map((row) => row.map(escape).join(";"));
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
