import React from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Globe2,
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
  public_profile: "Profil public",
  location_details: "Date locatie",
  operating_hours: "Program",
  services: "Servicii",
  team: "Specialisti",
  media: "Fotografii",
  article: "Articol",
};

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center rounded-3xl bg-secondary/30 px-6 py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("ro-RO"); } catch { return ""; }
}

export default function ProviderOverview({ overview, onNavigate }) {
  const organization = overview.organization || {};
  const location = overview.location || {};
  const organizationSummary = overview.organization_summary || {};
  const completion = overview.completion || { percentage: 0, checklist: [] };
  const contentSummary = overview.content_summary || {};
  const publicPreview = overview.public_preview || {};
  const pendingSubmissions = (overview.pending_submissions || []).filter((item) => item.id && ["draft", "pending_review", "needs_more_info"].includes(item.status));
  const recentSubmissions = (overview.recent_submissions || []).filter((item) => item.id).slice(0, 5);
  const organizationName = organization.public_display_name || organization.name || location.organization_name || "Organizatie";
  const organizationType = PROVIDER_PROFILE_TYPES[organization.organization_type]
    || PROVIDER_TYPES[location.provider_type]
    || "Profil furnizor";
  const locationCount = organizationSummary.location_count || overview.locations?.length || 1;
  const activeLocationCount = organizationSummary.active_location_count ?? locationCount;
  const verified = location.profile_control_status === "verified";
  const checklist = completion.checklist || [];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prezentare generala</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-extrabold tracking-tight">{organizationName}</h1>
              {verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verificat
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5" /> {organizationType}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground">
                <Store className="h-3.5 w-3.5" /> {activeLocationCount} {activeLocationCount === 1 ? "locatie activa" : "locatii active"}
              </span>
            </div>
          </div>
          <button onClick={() => onNavigate("profile")} className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Editeaza profilul <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {overview.organization_profile_uses_location_fallback && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Profilul organizatiei foloseste temporar datele locatiei. Completeaza Profil public pentru a separa datele generale de cele ale punctului de lucru.
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Profilul organizatiei</h2>
              <p className="mt-1 text-xs text-muted-foreground">Date generale de brand si prezenta publica.</p>
            </div>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-bold">{completion.percentage || 0}% complet</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(0, Math.min(100, completion.percentage || 0))}%` }} />
          </div>
          <div className="mt-5 divide-y divide-border/70">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-center gap-3 py-2.5">
                {item.done || item.status === "complete" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                <span className={`text-sm ${item.done || item.status === "complete" ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                {!(item.done || item.status === "complete") && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lipseste</span>}
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("profile")} className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">
            Completeaza profilul <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">In verificare</h2>
              <p className="mt-1 text-xs text-muted-foreground">Doar modificarile active care asteapta o actiune.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          {pendingSubmissions.length === 0 ? (
            <div className="mt-5"><EmptyState icon={ClipboardList} title="Nu exista modificari in verificare" text="Drafturile si cererile trimise spre aprobare vor aparea aici." /></div>
          ) : (
            <ul className="mt-5 space-y-2">
              {pendingSubmissions.map((submission) => (
                <li key={submission.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
                  <span className="font-medium">{SECTION_LABELS[submission.section] || submission.section}</span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">{SUBMISSION_STATUS_LABELS[submission.status] || submission.status}</span>
                </li>
              ))}
            </ul>
          )}
          {overview.latest_admin_note && (
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
              <h2 className="font-heading text-xl font-bold tracking-tight">Ce este public acum</h2>
              <p className="mt-1 text-xs text-muted-foreground">Organizatia si continutul publicat in locatiile tale.</p>
            </div>
            <Globe2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric icon={Phone} label="Telefon general" value={publicPreview.phone || "Lipseste"} />
            <Metric icon={Mail} label="Email general" value={publicPreview.email || "Lipseste"} />
            <Metric icon={MapPin} label="Locatii" value={`${activeLocationCount}/${locationCount}`} hint="Locatii active din total" />
            <Metric icon={Clock} label="Program completat" value={`${contentSummary.locations_with_opening_hours || 0}/${locationCount}`} />
            <Metric icon={ShieldCheck} label="Servicii publicate" value={contentSummary.approved_service_count || 0} />
            <Metric icon={Users} label="Specialisti publici" value={contentSummary.approved_public_team_count || 0} />
            <Metric icon={FileText} label="Articole publicate" value={contentSummary.approved_published_article_count || 0} />
            <Metric icon={Store} label="Fotografii aprobate" value={contentSummary.approved_media_count || 0} />
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Activitate recenta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Ultimele drafturi, trimiteri si decizii de verificare.</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="mt-5"><EmptyState icon={Activity} title="Nicio activitate recenta" text="Primele modificari ale organizatiei si locatiilor vor aparea aici." /></div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {recentSubmissions.map((submission) => (
                <li key={submission.id} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{SECTION_LABELS[submission.section] || submission.section}</span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{SUBMISSION_STATUS_LABELS[submission.status] || submission.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(submission.reviewed_at || submission.updated_date || submission.submitted_at || submission.created_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
