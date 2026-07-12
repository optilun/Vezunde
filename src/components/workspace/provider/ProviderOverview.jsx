import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
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

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-3xl bg-secondary/30 px-6 py-7 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, muted = false }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-extrabold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("ro-RO"); } catch (_error) { return ""; }
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
    groups.set(key, { ...row, count: 1, display_date: rawDate });
  }
  return [...groups.values()].slice(0, 6);
}

function ChangeRow({ submission }) {
  const statusLabel = SUBMISSION_STATUS_LABELS[submission.status] || submission.status;
  return (
    <li className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
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

function LocationCompletionRow({ item, onNavigate }) {
  const completion = item.completion || { percentage: 0, missing_count: 0 };
  const verified = item.profile_control_status === "verified";
  return (
    <button type="button" onClick={() => onNavigate("locations")} className="w-full rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-left hover:bg-secondary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{item.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {item.locality_name && <span>{item.locality_name}</span>}
            <span>{verified ? "Verificata" : "Neverificata"}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">{completion.percentage || 0}%</span>
      </div>
      <div className="mt-2"><ProgressBar value={completion.percentage} /></div>
      {completion.missing_count > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{completion.missing_count} {completion.missing_count === 1 ? "element lipsa" : "elemente lipsa"}</p>}
    </button>
  );
}

export default function ProviderOverview({ overview, onNavigate }) {
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
  const organizationName = organization.public_display_name || organization.name || location.organization_name || "Organizatie";
  const organizationType = PROVIDER_PROFILE_TYPES[organization.organization_type]
    || PROVIDER_TYPES[location.provider_type]
    || "Profil furnizor";
  const locationCount = Number(organizationSummary.location_count ?? overview.locations?.length ?? 0);
  const activeLocationCount = Number(organizationSummary.active_location_count ?? locationCount);
  const verifiedLocationCount = Number(organizationSummary.verified_location_count ?? 0);
  const profileStatus = organization.public_visibility_status || organizationSummary.public_profile_status || "draft";
  const checklist = completion.checklist || [];
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

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prezentare generala</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-extrabold tracking-tight">{organizationName}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${verificationStatus === "all_verified" ? "bg-green-100 text-green-800" : verificationStatus === "partially_verified" ? "bg-amber-100 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> {verificationLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5" /> {organizationType}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                <Store className="h-3.5 w-3.5" /> {activeLocationCount} {activeLocationCount === 1 ? "locatie activa" : "locatii active"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                <Globe2 className="h-3.5 w-3.5" /> {PROFILE_STATUS_LABELS[profileStatus] || profileStatus}
              </span>
            </div>
          </div>
          <button onClick={() => onNavigate("profile")} className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Editeaza profilul <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {fallbackLabels.length > 0 && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Datele exista in {fallbackLocationName}, dar nu sunt salvate in profilul organizatiei.</div>
              <p className="mt-1">{fallbackLabels.join(", ")}. Intra in Profil public, preia datele in formular, salveaza draftul si trimite-l spre verificare.</p>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Completarea profilului</h2>
              <p className="mt-1 text-xs text-muted-foreground">Organizatia si locatiile sunt monitorizate separat.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Profil organizatie</div>
                <p className="mt-1 text-[11px] text-muted-foreground">Numai datele aprobate din ProviderOrganization.</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{completion.percentage || 0}% publicat</span>
                {projectedDiffers && <div className="mt-2 text-[11px] font-semibold text-blue-700">{projectedCompletion.percentage}% dupa aprobare</div>}
              </div>
            </div>
            <div className="mt-3"><ProgressBar value={completion.percentage} /></div>
            <div className="mt-4 divide-y divide-border/70">
              {checklist.map((item) => (
                <div key={item.key} className="flex items-center gap-3 py-2.5">
                  {item.done || item.status === "complete" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                  <span className={`text-sm ${item.done || item.status === "complete" ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                  {!(item.done || item.status === "complete") && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lipseste</span>}
                </div>
              ))}
            </div>
            <button onClick={() => onNavigate("profile")} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">
              Completeaza organizatia <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Profiluri locatii</div>
                <p className="mt-1 text-[11px] text-muted-foreground">Adresa, contactul local si programul fiecarei locatii.</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{locationCompletionSummary.average_percentage || 0}% medie</span>
            </div>
            <div className="mt-3"><ProgressBar value={locationCompletionSummary.average_percentage} /></div>
            <div className="mt-3 space-y-2">
              {(locationCompletionSummary.items || []).map((item) => <LocationCompletionRow key={item.id} item={item} onNavigate={onNavigate} />)}
            </div>
            <button onClick={() => onNavigate("locations")} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">
              Gestioneaza locatiile <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Modificari si actiuni</h2>
              <p className="mt-1 text-xs text-muted-foreground">Separat intre cereri trimise si lucruri care necesita atentia ta.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-secondary/45 px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">In verificare</div><div className="mt-1 text-lg font-extrabold">{inReview.length}</div></div>
            <div className="rounded-2xl bg-secondary/45 px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Necesita actiune</div><div className="mt-1 text-lg font-extrabold">{needsAction.length}</div></div>
          </div>
          {pendingSubmissions.length === 0 ? (
            <div className="mt-4"><EmptyState icon={ClipboardList} title="Nu exista modificari active" text="Drafturile, completarile cerute si cererile trimise spre aprobare vor aparea aici." /></div>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Date si continut public</h2>
              <p className="mt-1 text-xs text-muted-foreground">Datele organizatiei sunt separate de continutul publicat pe locatii.</p>
            </div>
            <Globe2 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Organizatie</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{PROFILE_STATUS_LABELS[profileStatus] || profileStatus}</span>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Metric icon={Phone} label="Telefon general" value={organization.public_phone || "Lipseste"} muted={!organization.public_phone} />
            <Metric icon={Mail} label="Email general" value={organization.public_email || "Lipseste"} muted={!organization.public_email} />
            <Metric icon={Globe2} label="Website" value={website || "Lipseste"} muted={!website} />
            <Metric icon={ImageIcon} label="Logo organizatie" value={organization.logo_url ? "Adaugat" : "Lipseste"} muted={!organization.logo_url} />
          </div>

          <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Locatii</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Metric icon={MapPin} label="Locatii active" value={`${activeLocationCount}/${locationCount}`} />
            <Metric icon={Clock} label="Program completat" value={`${contentSummary.locations_with_opening_hours || 0}/${locationCount}`} />
            <Metric icon={ShieldCheck} label="Servicii publicate" value={contentSummary.approved_service_count || 0} />
            <Metric icon={Users} label="Specialisti publici" value={contentSummary.approved_public_team_count || 0} />
            <Metric icon={ImageIcon} label="Fotografii locatie" value={`${contentSummary.locations_with_photo || 0}/${locationCount}`} hint={`${contentSummary.approved_media_count || 0} imagini aprobate in total`} />
            <Metric icon={FileText} label="Articole publicate" value={contentSummary.approved_published_article_count || 0} />
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Activitate recenta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Modificarile organizatiei, grupate pentru a evita intrarile repetitive.</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="mt-5"><EmptyState icon={Activity} title="Nicio activitate recenta" text="Primele modificari ale organizatiei si locatiilor vor aparea aici." /></div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {recentSubmissions.map((submission) => (
                <li key={[submission.section, submission.item_key, submission.location_id, submission.status, submission.display_date].join(":")} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{activityLabel(submission)}</span>
                      {submission.count > 1 && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{submission.count} actualizari</span>}
                      {submission.location_name && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{submission.location_name}</div>}
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{SUBMISSION_STATUS_LABELS[submission.status] || submission.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(submission.display_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
