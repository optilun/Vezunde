// Prezentarea generala a spatiului furnizor, reorganizata (2026-08-23).
//
// Inainte: patru carduri albe de aceeasi greutate, cu culori implicite Tailwind (verde,
// chihlimbar, albastru #345bc8) care nu existau nicaieri altundeva in VIASEE, si o
// informatie spusa de trei ori (doua bare de progres, lista "De completat" si un acordeon
// care repeta acelasi checklist). "Modificari si actiuni" si "Activitate recenta" erau
// acelasi lucru - cereri trimise - despartite in prezent si trecut, doua cutii goale cand
// nu se intampla nimic.
//
// Acum: acelasi limbaj ca modulul de leaduri (antet editorial, linie cu jaloane, placi
// tonale din paleta de categorii, pastile negre), datele de contact intr-o banda compacta
// sub antet, un rand de placi clickabile cu ce este publicat, si un singur card de
// activitate cu doua pastile de filtru.
//
// Nu se schimba nicio regula: ce se publica, ce se aproba si cine are voie ce raman
// exact ca inainte. Este strict reorganizare si prezentare.
import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  Globe2,
  Image as ImageIcon,
  Mail,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

// Aceleasi tonuri ca placile de categorii din homepage si contoarele din inbox.
const TONES = {
  green: { border: "#ccd2ba", bg: "#dfe3d2" },
  blue: { border: "#c6d3da", bg: "#dce5e9" },
  amber: { border: "#dac69b", bg: "#eadcba" },
  terracotta: { border: "#e1bda8", bg: "#efd5c5" },
  lavender: { border: "#d4c6d8", bg: "#e8e0ea" },
};

const SECTION_LABELS = {
  public_profile: "Profil public organizație",
  location_details: "Date publice locație",
  operating_hours: "Program",
  services: "Servicii",
  team: "Specialiști",
  media: "Fotografie locație",
  article: "Articol",
};

const FIELD_LABELS = {
  public_display_name: "numele public",
  public_description: "descrierea",
  public_phone: "telefonul general",
  public_email: "emailul general",
  website_url: "website-ul",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
  logo_url: "logo-ul",
};

const PROFILE_STATUS_LABELS = {
  approved: "Profil organizație aprobat",
  pending_review: "Profil organizație în verificare",
  needs_more_info: "Profil organizație care necesită completări",
  rejected: "Profil organizație respins",
  archived: "Profil organizație arhivat",
  draft: "Profil organizație nefinalizat",
};

function Eyebrow({ children }) {
  return <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">{children}</p>;
}

function Panel({ children, className = "" }) {
  return (
    <section className={`relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-6 ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

// Linia subtire cu jaloane, acelasi accent grafic ca in restul aplicatiei.
function WaypointLine({ className = "" }) {
  return (
    <div className={`relative h-px bg-[#9a8668]/45 ${className}`}>
      {[16, 50, 84].map((position) => (
        <span key={position} aria-hidden="true" className="absolute -top-1 h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-[#8d7658] bg-[#f8f4ec]" style={{ left: `${position}%` }} />
      ))}
    </div>
  );
}

// Figurina pentru "totul e completat": un sigiliu din cercuri concentrice, in tonurile
// paletei. Desenata aici, fara imagini externe.
function FigureComplete() {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Profil complet" className="h-24 w-24">
      <circle cx="60" cy="60" r="46" fill="none" stroke="#8d7658" strokeWidth="1.2" strokeDasharray="3 8" opacity="0.55" />
      <circle cx="60" cy="60" r="34" fill="#dfe3d2" stroke="#ccd2ba" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="20" fill="#dce5e9" stroke="#c6d3da" strokeWidth="1.2" />
      <path d="M52 60.5l6 6 12-13" fill="none" stroke="#171717" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Figurina pentru "nimic de raportat": o foaie cu randuri, in aceleasi tonuri.
function FigureQuiet() {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Fără activitate" className="h-24 w-24">
      <circle cx="60" cy="60" r="46" fill="none" stroke="#8d7658" strokeWidth="1.2" strokeDasharray="3 8" opacity="0.45" />
      <rect x="36" y="30" width="52" height="62" rx="10" fill="#eadcba" stroke="#dac69b" strokeWidth="1.2" />
      <rect x="26" y="42" width="52" height="62" rx="10" fill="#fdfbf6" stroke="#e3ddd0" strokeWidth="1.2" />
      <rect x="38" y="58" width="30" height="4.5" rx="2.25" fill="#171717" opacity="0.24" />
      <rect x="38" y="70" width="22" height="4.5" rx="2.25" fill="#171717" opacity="0.14" />
      <rect x="38" y="82" width="26" height="4.5" rx="2.25" fill="#171717" opacity="0.1" />
    </svg>
  );
}

function EmptyState({ figure, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-[#e3ddd0] bg-white/55 px-6 py-8 text-center">
      {figure}
      <p className="mt-3 font-heading text-[15px] font-extrabold tracking-[-0.025em] text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

// Placa tonala cu o cifra mare: acelasi obiect ca placile de categorii si contoarele din
// inboxul de leaduri. Devine buton cand are unde sa duca.
function StatTile({ tone, value, label, hint, onClick }) {
  const content = (
    <>
      <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
      <p className="relative z-10 font-heading text-[2.1rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{value}</p>
      <p className="relative z-10 mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">{label}</p>
      {hint && <p className="relative z-10 mt-1 text-[11px] leading-relaxed text-black/45">{hint}</p>}
      {onClick && <ArrowRight aria-hidden="true" className="absolute right-4 top-4 z-10 h-3.5 w-3.5 text-black/35" />}
    </>
  );
  const className = "relative overflow-hidden rounded-[1.4rem] border px-5 py-4 text-left shadow-[0_10px_30px_rgba(34,30,24,0.028)]";
  const style = { borderColor: tone.border, backgroundColor: tone.bg };

  if (!onClick) return <div style={style} className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`${className} outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(34,30,24,0.07)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none`}
    >
      {content}
    </button>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
      <div className="h-full rounded-full bg-[#171717] transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

// Placa de completare: procentul mare, bara dedesubt, totul pe ton.
function CompletionTile({ tone, label, value, hint }) {
  return (
    <div style={{ borderColor: tone.border, backgroundColor: tone.bg }} className="relative overflow-hidden rounded-[1.4rem] border px-5 py-4">
      <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
      <div className="relative z-10 flex items-baseline justify-between gap-3">
        <p className="font-heading text-[15px] font-extrabold tracking-[-0.025em] text-[#1c1c1c]">{label}</p>
        <p className="font-heading text-[1.9rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{value}%</p>
      </div>
      {hint && <p className="relative z-10 mt-1.5 text-[11.5px] leading-relaxed text-black/50">{hint}</p>}
      <div className="relative z-10 mt-3"><ProgressBar value={value} /></div>
    </div>
  );
}

// Banda de contact de sub antet: aici isi au locul telefonul, emailul, website-ul si logo-ul,
// nu intr-un tabel de zece randuri alaturi de numarul de servicii.
function ContactStrip({ organization, website }) {
  const items = [
    { icon: Phone, label: "Telefon general", value: organization.public_phone || "Lipsește", missing: !organization.public_phone },
    { icon: Mail, label: "Email general", value: organization.public_email || "Lipsește", missing: !organization.public_email },
    { icon: Globe2, label: "Website", value: website || "Lipsește", missing: !website },
    { icon: ImageIcon, label: "Logo", value: organization.logo_url ? "Adăugat" : "Lipsește", missing: !organization.logo_url },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-[#e3ddd0] sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 bg-[#fdfbf6] px-4 py-3.5">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e3ddd0] bg-white/70">
              <Icon className="h-3.5 w-3.5 text-black/55" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/75">{item.label}</p>
              <p className={`mt-0.5 truncate font-heading text-[13px] font-bold tracking-[-0.015em] ${item.missing ? "text-muted-foreground" : "text-foreground"}`}>{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("ro-RO", { day: "2-digit", month: "long" });
  } catch (_error) {
    return "";
  }
}

function activityDate(row) {
  return row.reviewed_at || row.updated_date || row.submitted_at || row.created_date || "";
}

function activityLabel(row) {
  if (row.section === "media" && row.item_key === "location_photo") return "Fotografie locație";
  return SECTION_LABELS[row.section] || row.section || "Modificare";
}

function groupRecentSubmissions(rows) {
  const groups = new Map();
  for (const row of rows) {
    const rawDate = activityDate(row);
    let day = "fara-data";
    try { day = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : "fara-data"; } catch (_error) { day = "fara-data"; }
    const key = [row.section, row.item_key || "", row.location_id || "organization", row.status, day].join(":");
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, { ...row, count: 1, display_date: rawDate, day_key: day });
  }
  return [...groups.values()].slice(0, 8);
}

function groupActivitiesByDay(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.day_key || "fara-data";
    if (!groups.has(key)) groups.set(key, { key, label: formatDate(row.display_date) || "Dată necunoscută", items: [] });
    groups.get(key).items.push(row);
  }
  return [...groups.values()];
}

function StatusPill({ status }) {
  return (
    <span className="shrink-0 rounded-full border border-[#e3ddd0] bg-white/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-black/60">
      {SUBMISSION_STATUS_LABELS[status] || status}
    </span>
  );
}

function ChangeRow({ submission }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-heading text-[13.5px] font-bold tracking-[-0.02em] text-foreground">{activityLabel(submission)}</p>
        {submission.location_name && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{submission.location_name}</p>}
        {submission.conflict && <p className="mt-1 text-[11.5px] text-muted-foreground">Gestionată de un alt utilizator al organizației.</p>}
      </div>
      <StatusPill status={submission.status} />
    </li>
  );
}

function Checklist({ items }) {
  return (
    <div className="divide-y divide-[#e3ddd0]">
      {items.map((item) => {
        const complete = item.done || item.status === "complete";
        return (
          <div key={item.key} className="flex items-center gap-3 px-4 py-2.5">
            {complete
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5f7a4e]" />
              : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
            <span className={`text-[13px] ${complete ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
            {!complete && <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Lipsește</span>}
          </div>
        );
      })}
    </div>
  );
}

// Cardul unei locatii din organizatie. Cifrele de mai sus sunt insumate pe toate locatiile
// la care ai acces; aici se vede din ce este facuta suma.
function LocationCard({ item, onNavigate }) {
  const completion = item.completion || { percentage: 0, missing_count: 0 };
  const verified = item.profile_control_status === "verified";
  const inactive = item.active_status === "inactiva";
  return (
    <button
      type="button"
      onClick={() => onNavigate("locations")}
      className="relative overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-[#fdfbf6] px-5 py-4 text-left outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(34,30,24,0.06)] focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] motion-reduce:transform-none"
    >
      <span aria-hidden="true" className="absolute inset-0 opacity-20 mix-blend-multiply" style={GRAIN} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-[15px] font-extrabold tracking-[-0.025em] text-foreground">{item.name}</p>
            {item.locality_name && (
              <p className="mt-1 truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/75">{item.locality_name}</p>
            )}
          </div>
          <ArrowRight aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/35" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            style={verified ? { borderColor: TONES.green.border, backgroundColor: TONES.green.bg } : undefined}
            className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${verified ? "text-black/65" : "border-[#e3ddd0] bg-white/70 text-muted-foreground"}`}
          >
            {verified ? "Verificată" : "Neverificată"}
          </span>
          {inactive && (
            <span className="rounded-full border border-[#e3ddd0] bg-white/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Inactivă</span>
          )}
          {completion.missing_count > 0 && (
            <span style={{ borderColor: TONES.amber.border, backgroundColor: TONES.amber.bg }} className="rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-black/65">
              {completion.missing_count} {completion.missing_count === 1 ? "element lipsă" : "elemente lipsă"}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="font-heading text-[1.8rem] font-extrabold leading-none tracking-[-0.05em] text-foreground">{completion.percentage || 0}%</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/75">completare</p>
        </div>
        <div className="mt-2.5"><ProgressBar value={completion.percentage || 0} /></div>
      </div>
    </button>
  );
}

const ACTIVITY_TABS = [
  { key: "active", label: "În lucru" },
  { key: "history", label: "Istoric" },
];

export default function ProviderOverview({
  overview,
  onNavigate,
  canManageOrganizationProfile = false,
  canManageLocations = false,
}) {
  const organization = overview.organization || {};
  const location = overview.location || {};
  const organizationSummary = overview.organization_summary || {};
  const profileState = overview.organization_profile_state || {};
  const completion = profileState.published_completion || overview.completion || { percentage: 0, checklist: [] };
  const projectedCompletion = profileState.projected_completion || completion;
  const activeProfileSubmission = profileState.active_submission || null;
  const locationCompletionSummary = overview.location_completion_summary || { average_percentage: 0, complete_count: 0, active_count: 0, items: [] };
  const contentSummary = overview.content_summary || {};
  const pendingSubmissions = (overview.pending_submissions || []).filter((item) => item.id);
  const inReview = pendingSubmissions.filter((item) => item.status === "pending_review");
  const needsAction = pendingSubmissions.filter((item) => ["draft", "needs_more_info"].includes(item.status));
  const recentSubmissions = groupRecentSubmissions((overview.recent_submissions || []).filter((item) => item.id));
  const recentGroups = groupActivitiesByDay(recentSubmissions);
  const organizationName = organization.public_display_name || organization.name || location.organization_name || "Organizație";
  const organizationType = PROVIDER_PROFILE_TYPES[organization.organization_type]
    || PROVIDER_TYPES[location.provider_type]
    || "Profil furnizor";
  const locationCount = Number(organizationSummary.location_count ?? overview.locations?.length ?? 0);
  const activeLocationCount = Number(organizationSummary.active_location_count ?? locationCount);
  const verifiedLocationCount = Number(organizationSummary.verified_location_count ?? 0);
  const profileStatus = organization.public_visibility_status || organizationSummary.public_profile_status || "draft";
  const checklist = completion.checklist || [];
  const missingChecklist = checklist.filter((item) => !(item.done || item.status === "complete"));
  const fallbackFields = profileState.fallback_fields || overview.organization_profile_fallback_fields || [];
  const fallbackLabels = fallbackFields.map((key) => FIELD_LABELS[key] || key);
  const fallbackLocationName = profileState.fallback_location_name || "locația principală";
  const verificationStatus = organizationSummary.verification_status || "unverified";
  const verificationLabel = verificationStatus === "all_verified"
    ? `${verifiedLocationCount}/${activeLocationCount} ${activeLocationCount === 1 ? "locație verificată" : "locații verificate"}`
    : verificationStatus === "partially_verified"
      ? `${verifiedLocationCount}/${activeLocationCount} locații verificate`
      : "Locații neverificate";
  const website = organization.website_url || "";
  const projectedDiffers = activeProfileSubmission && projectedCompletion.percentage !== completion.percentage;
  const everythingComplete = completion.percentage === 100 && Number(locationCompletionSummary.average_percentage || 0) === 100;

  // Un singur card pentru cereri si activitate: prezentul si trecutul erau doua cutii
  // separate, amandoua goale cand nu se intampla nimic.
  const [activityTab, setActivityTab] = useState("active");
  const activeChanges = [...needsAction, ...inReview];

  const locationItems = locationCompletionSummary.items || [];
  // Cifrele vin insumate din backend pe toate locatiile la care ai acces. Cand sunt mai
  // multe, spunem asta explicit: altfel par datele unei singure locatii.
  const acrossLocations = locationCount > 1 ? `Însumat pe ${locationCount} locații` : "";

  const publishedTiles = [
    { key: "locations", tone: TONES.blue, value: `${activeLocationCount}/${locationCount}`, label: "Locații active", section: "locations" },
    { key: "services", tone: TONES.green, value: contentSummary.approved_service_count || 0, label: "Servicii publicate", hint: acrossLocations, section: "locations" },
    { key: "hours", tone: TONES.amber, value: `${contentSummary.locations_with_opening_hours || 0}/${locationCount}`, label: "Program completat", section: "locations" },
    { key: "team", tone: TONES.lavender, value: contentSummary.approved_public_team_count || 0, label: "Specialiști publici", hint: acrossLocations, section: "locations" },
    { key: "photos", tone: TONES.terracotta, value: `${contentSummary.locations_with_photo || 0}/${locationCount}`, label: "Fotografii", hint: `${contentSummary.approved_media_count || 0} imagini aprobate`, section: "locations" },
    { key: "articles", tone: TONES.blue, value: contentSummary.approved_published_article_count || 0, label: "Articole", hint: acrossLocations, section: "locations" },
  ];

  return (
    <div className="space-y-5">
      {/* Antet editorial, in acelasi registru ca modulul de leaduri. */}
      <header>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Eyebrow>Prezentare generală · {organizationType}</Eyebrow>
            <h1 className="mt-4 max-w-3xl font-heading text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-[3.1rem]">
              {organizationName}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                style={verificationStatus === "all_verified" ? { borderColor: TONES.green.border, backgroundColor: TONES.green.bg } : verificationStatus === "partially_verified" ? { borderColor: TONES.amber.border, backgroundColor: TONES.amber.bg } : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-[12px] font-bold tracking-[-0.01em] text-[#1c1c1c] ${verificationStatus === "unverified" ? "border-[#e3ddd0] bg-white/70 text-muted-foreground" : ""}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {verificationLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3ddd0] bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> {organizationType}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3ddd0] bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Store className="h-3.5 w-3.5" /> {activeLocationCount} {activeLocationCount === 1 ? "locație activă" : "locații active"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3ddd0] bg-white/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" /> {PROFILE_STATUS_LABELS[profileStatus] || profileStatus}
              </span>
            </div>
          </div>

          {canManageOrganizationProfile && (
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-full bg-[#171717] px-5 font-heading text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            >
              Editează profilul <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <WaypointLine className="mt-8" />

        <div className="mt-6"><ContactStrip organization={organization} website={website} /></div>

        {canManageOrganizationProfile && fallbackLabels.length > 0 && (
          <div style={{ borderColor: TONES.amber.border, backgroundColor: TONES.amber.bg }} className="relative mt-4 flex items-start gap-3 overflow-hidden rounded-[1.4rem] border px-5 py-4">
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <AlertTriangle className="relative z-10 mt-0.5 h-4 w-4 shrink-0 text-black/55" />
            <div className="relative z-10">
              <p className="font-heading text-[13.5px] font-extrabold tracking-[-0.02em] text-[#1c1c1c]">Datele există în {fallbackLocationName}, dar nu sunt salvate în profilul organizației.</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-black/60">{fallbackLabels.join(", ")}. Preia-le din Profil public, apoi salvează și trimite modificările spre verificare.</p>
            </div>
          </div>
        )}
      </header>

      {/* Randul de scanare: ce ai publicat, in placi tonale clickabile. */}
      <section>
        <Eyebrow>Ce ai publicat</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {publishedTiles.map((tile) => (
            <StatTile
              key={tile.key}
              tone={tile.tone}
              value={tile.value}
              label={tile.label}
              hint={tile.hint}
              onClick={() => onNavigate(tile.section)}
            />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Starea profilului</Eyebrow>
              <h2 className="mt-2 font-heading text-[1.6rem] font-extrabold leading-[1.04] tracking-[-0.04em]">Cât este completat.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Organizația și locațiile sunt urmărite separat.</p>
            </div>
            {everythingComplete && (
              <span style={{ borderColor: TONES.green.border, backgroundColor: TONES.green.bg }} className="rounded-full border px-3 py-1 font-heading text-[12px] font-bold text-[#1c1c1c]">Profil complet</span>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <CompletionTile
              tone={TONES.green}
              label="Organizație"
              value={completion.percentage || 0}
              hint={projectedDiffers ? `${projectedCompletion.percentage}% după aprobare` : "Date generale de brand"}
            />
            <CompletionTile
              tone={TONES.blue}
              label="Locații"
              value={locationCompletionSummary.average_percentage || 0}
              hint={`${locationCompletionSummary.complete_count || 0}/${locationCompletionSummary.active_count || activeLocationCount} complete`}
            />
          </div>

          {everythingComplete ? (
            <div className="mt-4">
              <EmptyState
                figure={<FigureComplete />}
                title="Nu mai lipsește nimic"
                text="Toate datele obligatorii ale organizației și locațiilor sunt completate."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-white/55">
              <p className="border-b border-[#e3ddd0] px-4 py-3 font-heading text-[13px] font-extrabold tracking-[-0.02em] text-foreground">De completat</p>
              {missingChecklist.length > 0
                ? <Checklist items={missingChecklist} />
                : <p className="px-4 py-3 text-[13px] text-muted-foreground">Organizația este completă. Verifică locațiile care au elemente lipsă.</p>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {canManageOrganizationProfile && (
              <button type="button" onClick={() => onNavigate("profile")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45">
                Editează organizația <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={() => onNavigate("locations")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45">
              {canManageLocations ? "Gestionează locațiile" : "Vezi locațiile"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Panel>

        {/* Cerere trimisa si istoricul ei, in acelasi card, cu pastile de filtru ca in lista
            de leaduri. Inainte erau doua carduri care spuneau acelasi lucru. */}
        <Panel>
          <div>
            <Eyebrow>Modificări</Eyebrow>
            <h2 className="mt-2 font-heading text-[1.6rem] font-extrabold leading-[1.04] tracking-[-0.04em]">Ce ai trimis spre aprobare.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {activityTab === "active"
                ? `${inReview.length} în verificare · ${needsAction.length} necesită acțiune`
                : "Modificările încheiate, grupate după zi."}
            </p>
          </div>

          <div className="mt-5 inline-flex gap-1.5 rounded-full border border-[#e3ddd0] bg-white/55 p-1.5">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivityTab(tab.key)}
                aria-current={activityTab === tab.key ? "true" : undefined}
                className={`min-h-9 rounded-full px-4 font-heading text-[12px] font-bold tracking-[-0.015em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf6] ${
                  activityTab === tab.key ? "bg-[#171717] text-white" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                }`}
              >
                {tab.label}{tab.key === "active" && activeChanges.length > 0 ? ` · ${activeChanges.length}` : ""}
              </button>
            ))}
          </div>

          {activityTab === "active" ? (
            activeChanges.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  figure={<FigureQuiet />}
                  title="Nu există modificări active"
                  text="Drafturile și cererile trimise spre aprobare vor apărea aici."
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-[#e3ddd0] overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-white/55">
                {activeChanges.map((submission) => <ChangeRow key={submission.id} submission={submission} />)}
              </ul>
            )
          ) : recentGroups.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                figure={<FigureQuiet />}
                title="Nicio activitate recentă"
                text="Primele modificări ale organizației și locațiilor vor apărea aici."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentGroups.map((group) => (
                <div key={group.key}>
                  <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/75">{group.label}</p>
                  <ul className="divide-y divide-[#e3ddd0] overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-white/55">
                    {group.items.map((submission) => (
                      <li
                        key={[submission.section, submission.item_key, submission.location_id, submission.status, submission.display_date].join(":")}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-heading text-[13.5px] font-bold tracking-[-0.02em] text-foreground">
                            {activityLabel(submission)}
                            {submission.count > 1 && (
                              <span className="ml-2 rounded-full border border-[#e3ddd0] bg-white/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-black/55">
                                {submission.count} actualizări
                              </span>
                            )}
                          </p>
                          {submission.location_name && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{submission.location_name}</p>}
                        </div>
                        <StatusPill status={submission.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {overview.latest_admin_note && ["needs_more_info", "rejected"].includes(overview.latest_review_status) && (
            <div style={{ borderColor: TONES.amber.border, backgroundColor: TONES.amber.bg }} className="relative mt-4 flex items-start gap-3 overflow-hidden rounded-[1.4rem] border px-4 py-3">
              <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
              <FileText className="relative z-10 mt-0.5 h-4 w-4 shrink-0 text-black/55" />
              <p className="relative z-10 text-[12.5px] leading-relaxed text-black/65">
                {overview.latest_admin_note} ({SUBMISSION_STATUS_LABELS[overview.latest_review_status] || overview.latest_review_status})
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* Locatiile organizatiei, scoase din acordeon: prezentarea generala este despre toata
          organizatia, iar aici se vede din ce se compun cifrele insumate de mai sus. */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Eyebrow>Locațiile organizației</Eyebrow>
          <button type="button" onClick={() => onNavigate("locations")} className="font-heading text-[12px] font-bold text-foreground underline underline-offset-4 hover:opacity-70">
            {canManageLocations ? "Gestionează locațiile" : "Vezi locațiile"}
          </button>
        </div>
        {locationItems.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locationItems.map((item) => <LocationCard key={item.id} item={item} onNavigate={onNavigate} />)}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              figure={<FigureQuiet />}
              title="Nicio locație de afișat"
              text="Locațiile la care ai acces în această organizație vor apărea aici."
            />
          </div>
        )}
      </section>
    </div>
  );
}
