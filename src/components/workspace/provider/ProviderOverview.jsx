import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Globe2,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const SECTION_LABELS = {
  public_profile: "Profil public organizatie",
  location_details: "Date publice locatie",
  operating_hours: "Program",
  services: "Servicii",
  team: "Specialisti",
  media: "Fotografie locatie",
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
  approved: "Profil organizatie aprobat",
  pending_review: "Profil organizatie in verificare",
  needs_more_info: "Profil organizatie necesita completari",
  rejected: "Profil organizatie respins",
  archived: "Profil organizatie arhivat",
  draft: "Profil organizatie nefinalizat",
};

function EmptyState({ icon: Icon, title, text, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl bg-secondary/30 px-5 text-center ${compact ? "min-h-[104px] py-5" : "min-h-[140px] py-7"}`}>
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value, hint, muted = false }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-secondary/70">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</div>}
      </div>
      <div className={`max-w-[58%] break-words text-right text-sm font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function CompletionSummary({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{label}</div>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">{value}%</span>
      </div>
      <div className="mt-3"><ProgressBar value={value} /></div>
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
  if (row.section === "media" && row.item_key === "location_photo") return "Fotografie locatie";
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
    if (!groups.has(key)) groups.set(key, { key, label: formatDate(row.display_date) || "Data necunoscuta", items: [] });
    groups.get(key).items.push(row);
  }
  return [...groups.values()];
}

function ChangeRow({ submission }) {
  const statusLabel = SUBMISSION_STATUS_LABELS[submission.status] || submission.status;
  return (
    <li className="rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{activityLabel(submission)}</div>
          {submission.location_name && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{submission.location_name}</div>}
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{statusLabel}</span>
      </div>
      {submission.conflict && <p className="mt-1.5 text-[11px] text-muted-foreground">Gestionata de un alt utilizator al organizatiei.</p>}
    </li>
  );
}

function Checklist({ items }) {
  return (
    <div className="divide-y divide-border/70">
      {items.map((item) => {
        const complete = item.done || item.status === "complete";
        return (
          <div key={item.key} className="flex items-center gap-3 py-2.5">
            {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
            <span className={`text-sm ${complete ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
            {!complete && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lipseste</span>}
          </div>
        );
      })}
    </div>
  );
}

function LocationCompletionRow({ item, onNavigate }) {
  const completion = item.completion || { percentage: 0, missing_count: 0 };
  const verified = item.profile_control_status === "verified";
  return (
    <button type="button" onClick={() => onNavigate("locations")} className="w-full border-b border-border/70 py-2.5 text-left last:border-b-0 hover:bg-secondary/20">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{item.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {item.locality_name && <span>{item.locality_name}</span>}
            <span>{verified ? "Verificata" : "Neverificata"}</span>
            {completion.missing_count > 0 && <span>{completion.missing_count} {completion.missing_count === 1 ? "element lipsa" : "elemente lipsa"}</span>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">{completion.percentage || 0}%</span>
      </div>
    </button>
  );
}

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
  const organizationName = organization.public_display_name || organization.name || location.organization_name || "Organizatie";
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
  const fallbackLocationName = profileState.fallback_location_name || "locatia principala";
  const verificationStatus = organizationSummary.verification_status || "unverified";
  const verificationLabel = verificationStatus === "all_verified"
    ? `${verifiedLocationCount}/${activeLocationCount} ${activeLocationCount === 1 ? "locatie verificata" : "locatii verificate"}`
    : verificationStatus === "partially_verified"
      ? `${verifiedLocationCount}/${activeLocationCount} locatii verificate`
      : "Locatii neverificate";
  const website = organization.website_url || "";
  const projectedDiffers = activeProfileSubmission && projectedCompletion.percentage !== completion.percentage;
  const everythingComplete = completion.percentage === 100 && Number(locationCompletionSummary.average_percentage || 0) === 100;

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-border bg-card px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prezentare generala</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{organizationName}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${verificationStatus === "all_verified" ? "bg-green-100 text-green-800" : verificationStatus === "partially_verified" ? "bg-amber-100 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> {verificationLabel}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground"><Building2 className="h-3.5 w-3.5" /> {organizationType}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground"><Store className="h-3.5 w-3.5" /> {activeLocationCount} {activeLocationCount === 1 ? "locatie activa" : "locatii active"}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground"><Globe2 className="h-3.5 w-3.5" /> {PROFILE_STATUS_LABELS[profileStatus] || profileStatus}</span>
            </div>
          </div>
          {canManageOrganizationProfile && (
            <button onClick={() => onNavigate("profile")} className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90">
              Editeaza profilul <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {canManageOrganizationProfile && fallbackLabels.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Datele exista in {fallbackLocationName}, dar nu sunt salvate in profilul organizatiei.</div>
              <p className="mt-1">{fallbackLabels.join(", ")}. Preia-le din Profil public, apoi salveaza si trimite modificarile spre verificare.</p>
            </div>
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Starea profilului</h2>
              <p className="mt-1 text-xs text-muted-foreground">Organizatia si locatiile sunt monitorizate separat.</p>
            </div>
            {everythingComplete && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Profil complet</span>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CompletionSummary label="Organizatie" value={completion.percentage || 0} hint={projectedDiffers ? `${projectedCompletion.percentage}% dupa aprobare` : "Date generale de brand"} />
            <CompletionSummary label="Locatii" value={locationCompletionSummary.average_percentage || 0} hint={`${locationCompletionSummary.complete_count || 0}/${locationCompletionSummary.active_count || activeLocationCount} complete`} />
          </div>

          {everythingComplete ? (
            <p className="mt-4 rounded-2xl bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">Toate datele obligatorii ale organizatiei si locatiilor sunt completate.</p>
          ) : (
            <div className="mt-4 rounded-2xl border border-border bg-background/50 px-4 py-2">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">De completat</div>
              {missingChecklist.length > 0 ? <Checklist items={missingChecklist} /> : <p className="py-3 text-sm text-muted-foreground">Organizatia este completa. Verifica locatiile care au elemente lipsa.</p>}
            </div>
          )}

          <details className="group mt-4 rounded-2xl border border-border bg-background/45">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
              Vezi detaliile completarii
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Organizatie</div>
              <Checklist items={checklist} />
              <div className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Locatii</div>
              <div className="mt-1">
                {(locationCompletionSummary.items || []).map((item) => <LocationCompletionRow key={item.id} item={item} onNavigate={onNavigate} />)}
              </div>
            </div>
          </details>

          <div className="mt-4 flex flex-wrap gap-2">
            {canManageOrganizationProfile && <button onClick={() => onNavigate("profile")} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Editeaza organizatia <ArrowRight className="h-4 w-4" /></button>}
            <button onClick={() => onNavigate("locations")} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">{canManageLocations ? "Gestioneaza locatiile" : "Vezi locatiile"} <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Modificari si actiuni</h2>
              <p className="mt-1 text-xs text-muted-foreground">Cereri trimise si lucruri care necesita atentia ta.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-secondary px-3 py-1.5 font-semibold"><strong>{inReview.length}</strong> in verificare</span>
            <span className="rounded-full bg-secondary px-3 py-1.5 font-semibold"><strong>{needsAction.length}</strong> necesita actiune</span>
          </div>
          {pendingSubmissions.length === 0 ? (
            <div className="mt-4"><EmptyState compact icon={ClipboardList} title="Nu exista modificari active" text="Drafturile si cererile trimise spre aprobare vor aparea aici." /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {[...needsAction, ...inReview].map((submission) => <ChangeRow key={submission.id} submission={submission} />)}
            </ul>
          )}
          {overview.latest_admin_note && ["needs_more_info", "rejected"].includes(overview.latest_review_status) && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {overview.latest_admin_note} ({SUBMISSION_STATUS_LABELS[overview.latest_review_status] || overview.latest_review_status})
            </p>
          )}
        </section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Date si continut public</h2>
              <p className="mt-1 text-xs text-muted-foreground">Rezumatul informatiilor publicate pentru organizatie si locatii.</p>
            </div>
            <Globe2 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/45 px-4 py-2">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Organizatie</h3>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{PROFILE_STATUS_LABELS[profileStatus] || profileStatus}</span>
              </div>
              <div className="divide-y divide-border/70">
                <SummaryRow icon={Phone} label="Telefon general" value={organization.public_phone || "Lipseste"} muted={!organization.public_phone} />
                <SummaryRow icon={Mail} label="Email general" value={organization.public_email || "Lipseste"} muted={!organization.public_email} />
                <SummaryRow icon={Globe2} label="Website" value={website || "Lipseste"} muted={!website} />
                <SummaryRow icon={ImageIcon} label="Logo" value={organization.logo_url ? "Adaugat" : "Lipseste"} muted={!organization.logo_url} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/45 px-4 py-2">
              <div className="border-b border-border/70 py-2"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Locatii</h3></div>
              <div className="divide-y divide-border/70">
                <SummaryRow icon={MapPin} label="Locatii active" value={`${activeLocationCount}/${locationCount}`} />
                <SummaryRow icon={Clock} label="Program completat" value={`${contentSummary.locations_with_opening_hours || 0}/${locationCount}`} />
                <SummaryRow icon={ShieldCheck} label="Servicii publicate" value={contentSummary.approved_service_count || 0} />
                <SummaryRow icon={Users} label="Specialisti publici" value={contentSummary.approved_public_team_count || 0} />
                <SummaryRow icon={ImageIcon} label="Fotografii" value={`${contentSummary.locations_with_photo || 0}/${locationCount}`} hint={`${contentSummary.approved_media_count || 0} imagini aprobate`} />
                <SummaryRow icon={FileText} label="Articole" value={contentSummary.approved_published_article_count || 0} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Activitate recenta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Modificarile sunt grupate pe zi si tip.</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          {recentGroups.length === 0 ? (
            <div className="mt-5"><EmptyState compact icon={Activity} title="Nicio activitate recenta" text="Primele modificari ale organizatiei si locatiilor vor aparea aici." /></div>
          ) : (
            <div className="mt-5 space-y-4">
              {recentGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</div>
                  <div className="divide-y divide-border/70 rounded-2xl border border-border bg-background/45 px-3">
                    {group.items.map((submission) => (
                      <div key={[submission.section, submission.item_key, submission.location_id, submission.status, submission.display_date].join(":")} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {activityLabel(submission)}
                            {submission.count > 1 && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{submission.count} actualizari</span>}
                          </div>
                          {submission.location_name && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{submission.location_name}</div>}
                        </div>
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{SUBMISSION_STATUS_LABELS[submission.status] || submission.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
