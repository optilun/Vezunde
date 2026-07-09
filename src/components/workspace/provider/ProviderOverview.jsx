import React from "react";
import { Activity, ArrowRight, Building2, CheckCircle2, ClipboardList, Clock, FileText, Mail, MapPin, Phone, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { getProfileAudience, PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const SECTION_LABELS = { public_profile: "Profil public", location_details: "Date locatie", services: "Servicii", team: "Echipa", media: "Fotografii", article: "Articol" };

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="grid grid-cols-[24px_120px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center rounded-3xl bg-secondary/35 px-6 py-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/70">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-sm font-bold text-foreground">{title}</div>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ProviderOverview({ overview, onNavigate }) {
  const { completion, content_summary, pending_submissions = [], public_preview, latest_admin_note, latest_review_status } = overview;
  const ownSubmissions = pending_submissions.filter((s) => s.id);
  const location = overview.location || {};
  const profileTypeLabel = PROVIDER_PROFILE_TYPES[location.provider_profile_type] || "Tip profil nesetat";
  const providerTypeLabel = PROVIDER_TYPES[location.provider_type] || location.provider_type || "Tip furnizor nesetat";
  const audienceLabel = getProfileAudience(location.provider_profile_type);
  const cityLabel = [location.city || location.locality_name, location.county].filter(Boolean).join(", ") || "Localitate nesetata";
  const completedItems = completion.checklist.slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-[0.18em]">{location.organization_name || "Workspace furnizor"}</span>
              <span>·</span>
              <span>{audienceLabel}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-extrabold tracking-tight">{location.public_display_name || location.name}</h1>
              {location.profile_control_status === "verified" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verificat
                </span>
              )}
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-secondary/70 px-3 py-2 text-xs font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {cityLabel}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-border/80 bg-background/55 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-bold">Tip profil</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background">
                  <Building2 className="h-3.5 w-3.5" /> {profileTypeLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> {audienceLabel}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Clasificare interna: {providerTypeLabel}. Aceasta stabileste unde apare profilul si ce module sunt relevante pentru el.
              </p>
            </div>
            {location.address && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-right">{location.address}</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Profilul tau</h2>
              <p className="mt-1 text-xs text-muted-foreground">Datele esentiale care apar in workspace si profilul public.</p>
            </div>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-bold">{completion.percentage}% complet</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${completion.percentage}%` }} />
          </div>
          <div className="mt-5 divide-y divide-border/70">
            {completedItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("profile")} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90">
            Completeaza profilul <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">In review</h2>
              <p className="mt-1 text-xs text-muted-foreground">Modificari trimise spre verificare.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
          </div>
          {ownSubmissions.length === 0 ? (
            <div className="mt-5">
              <EmptyState icon={ClipboardList} title="Nu ai modificari in asteptare" text="Cand vei trimite modificari spre verificare, le vei vedea aici." />
            </div>
          ) : (
            <ul className="mt-5 space-y-2">
              {ownSubmissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
                  <span className="font-medium">{SECTION_LABELS[s.section] || s.section}</span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">{SUBMISSION_STATUS_LABELS[s.status] || s.status}</span>
                </li>
              ))}
            </ul>
          )}
          {latest_admin_note && <p className="mt-3 rounded-2xl border border-border bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">{latest_admin_note} ({SUBMISSION_STATUS_LABELS[latest_review_status] || latest_review_status})</p>}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Ce este public acum</h2>
              <p className="mt-1 text-xs text-muted-foreground">Rezumatul informatiilor vizibile pentru clienti.</p>
            </div>
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 space-y-2.5">
            <InfoRow icon={Phone} label="Telefon" value={public_preview.phone || "-"} />
            <InfoRow icon={Mail} label="Email" value={public_preview.email || "-"} />
            <InfoRow icon={Clock} label="Program" value={public_preview.opening_hours || "Nepublicat"} />
            <InfoRow icon={ShieldCheck} label="Servicii" value={`${content_summary.approved_service_count || 0} publicate`} />
            <InfoRow icon={Users} label="Echipa" value={`${content_summary.approved_public_team_count || 0} publici`} />
            <InfoRow icon={FileText} label="Articole" value={`${content_summary.approved_published_article_count || 0} publicate`} />
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">Activitate recenta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Ultimele actiuni trimise sau verificate.</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          {ownSubmissions.length === 0 ? (
            <div className="mt-5">
              <EmptyState icon={Activity} title="Nicio activitate recenta" text="Cand vor exista actiuni in contul tau, le vei vedea aici." />
            </div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {ownSubmissions.map((s) => (
                <li key={s.id} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm">
                  <div className="font-medium text-foreground">{SECTION_LABELS[s.section] || s.section}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{SUBMISSION_STATUS_LABELS[s.status] || s.status}{s.submitted_at ? ` · ${new Date(s.submitted_at).toLocaleDateString("ro-RO")}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
