import React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Clock3, LockKeyhole, MapPin, ShieldCheck } from "lucide-react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const ROLE_LABELS = {
  organization_owner: "Owner organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru locatie",
};

const PREPARATION_ITEMS = [
  { key: "profile", section: "public_profile", title: "Profilul public", description: "Descriere, date generale de contact, website si retele sociale." },
  { key: "hours", section: "operating_hours", title: "Programul locatiei", description: "Pregateste programul care va putea fi publicat dupa verificare." },
  { key: "services", section: "services", title: "Serviciile", description: "Selecteaza serviciile oferite pentru verificarea ulterioara." },
];

export default function ApplicantOverview({ workspace, onNavigate, submitted = false }) {
  const claim = workspace.claim || {};
  const location = workspace.location_summary || {};
  const drafts = workspace.preparation_drafts || [];
  const completedSections = new Set(drafts.map((draft) => draft.section));
  const fallbackItems = PREPARATION_ITEMS.map((item) => ({
    ...item,
    navigation_key: item.key,
    status: completedSections.has(item.section) ? "complete" : "missing",
    completed: completedSections.has(item.section),
    detail: completedSections.has(item.section) ? "Draft salvat." : "Nu a fost inceput.",
  }));
  const statusCenter = workspace.status_center || {};
  const items = statusCenter.items?.length ? statusCenter.items : fallbackItems;
  const progress = statusCenter.preparation_progress?.percentage
    ?? Math.round((fallbackItems.filter((item) => item.completed).length / fallbackItems.length) * 100);
  const completedCount = statusCenter.preparation_progress?.completed_count
    ?? fallbackItems.filter((item) => item.completed).length;
  const totalCount = statusCenter.preparation_progress?.total_count ?? fallbackItems.length;
  const nextAction = statusCenter.next_action || {
    navigation_key: fallbackItems.find((item) => !item.completed)?.navigation_key || "status",
    label: completedCount === totalCount ? "Urmareste verificarea solicitarii" : "Continua pregatirea profilului",
  };

  const itemIcon = (item) => {
    if (item.status === "complete") return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />;
    if (item.status === "needs_action") return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />;
    if (item.status === "in_review") return <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />;
    if (item.status === "blocked") return <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
    return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
  };

  const itemStatusLabel = (item) => ({
    complete: "Complet",
    needs_action: "Necesita actiune",
    in_review: "In verificare",
    blocked: "Blocat",
    missing: "Lipseste",
  }[item.status] || "");

  return (
    <div className="space-y-6">
      {submitted && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div>
              <h1 className="font-heading text-lg font-bold text-green-950">Solicitarea a fost trimisa</h1>
              <p className="mt-1 text-sm leading-relaxed text-green-900/80">
                Esti deja in zona de pregatire. Poti continua configurarea fara sa astepti aprobarea solicitarii.
              </p>
            </div>
          </div>
        </section>
      )}

      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Pregateste profilul locatiei</h1>
        <p className="mt-1 text-sm text-muted-foreground">Informatiile salvate aici raman private si vor fi pastrate cand primesti accesul complet.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locatia solicitata</div>
            <div className="mt-2 font-heading text-lg font-bold">{location.name || claim.business_name || "Locatie"}</div>
            <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{[location.city || location.locality_name, location.address].filter(Boolean).join(", ") || "Adresa in curs de verificare"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{CLAIM_STATUS_LABELS[claim.status] || claim.status || "In verificare"}</span>
            {claim.requested_membership_role && (
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{ROLE_LABELS[claim.requested_membership_role] || claim.requested_membership_role}</span>
            )}
          </div>
        </div>
        {claim.latest_admin_note && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{claim.latest_admin_note}</div>
        )}
        <button type="button" onClick={() => onNavigate("status")} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4">
          Vezi detaliile solicitarii <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">Status si configurare initiala</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {completedCount}/{totalCount} pasi disponibili sunt completati. Elementele blocate se deschid dupa aprobarea solicitarii.
            </p>
          </div>
          <span className="text-sm font-bold">{progress}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-5 divide-y divide-border">
          {items.map((item) => {
            const navigable = Boolean(item.navigation_key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigable && onNavigate(item.navigation_key)}
                disabled={!navigable}
                className="flex w-full items-start gap-3 py-4 text-left first:pt-0 last:pb-0 disabled:cursor-default"
              >
                {itemIcon(item)}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{item.label || item.title}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{itemStatusLabel(item)}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail || item.description}</span>
                </span>
                {navigable && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            );
          })}
        </div>

        <button type="button" onClick={() => onNavigate(nextAction.navigation_key || "status")} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background">
          {nextAction.label} <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Identitatea locatiei, adresa canonica si datele sensibile raman blocate pana la confirmarea relatiei. Dupa aprobare vei intra automat in Workspace furnizor, iar drafturile pregatite vor fi pastrate.
          </p>
        </div>
      </section>
    </div>
  );
}
