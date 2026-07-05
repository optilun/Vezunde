import React from "react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const SECTION_LABELS = { public_profile: "Profil public", location_details: "Date locatie", services: "Servicii", team: "Echipa", media: "Fotografii", article: "Articol" };

export default function ProviderOverview({ overview, onNavigate }) {
  const { completion, content_summary, pending_submissions = [], public_preview, latest_admin_note, latest_review_status } = overview;
  const ownSubmissions = pending_submissions.filter((s) => s.id);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">{overview.location.public_display_name || overview.location.name}</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">Profilul tau — {completion.percentage}% complet</div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-3">
            <div className="h-full bg-foreground" style={{ width: `${completion.percentage}%` }} />
          </div>
          <ul className="space-y-1">
            {completion.checklist.slice(0, 4).map((item) => (
              <li key={item.key} className="text-xs text-muted-foreground">{item.label}</li>
            ))}
          </ul>
          <button onClick={() => onNavigate("profile")} className="mt-3 text-xs font-semibold underline underline-offset-4">Completeaza profilul</button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">In review</div>
          {ownSubmissions.length === 0 && <p className="text-xs text-muted-foreground">Nu ai modificari in asteptare.</p>}
          <ul className="space-y-2">
            {ownSubmissions.map((s) => (
              <li key={s.id} className="text-xs flex items-center justify-between">
                <span>{SECTION_LABELS[s.section] || s.section}</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary font-semibold">{SUBMISSION_STATUS_LABELS[s.status] || s.status}</span>
              </li>
            ))}
          </ul>
          {latest_admin_note && <p className="text-xs text-amber-700 mt-2">{latest_admin_note} ({SUBMISSION_STATUS_LABELS[latest_review_status] || latest_review_status})</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">Ce este public acum</div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>Telefon: {public_preview.phone || "-"}</li>
            <li>Email: {public_preview.email || "-"}</li>
            <li>Program: {public_preview.opening_hours || "Nepublicat"}</li>
            <li>Servicii publicate: {content_summary.approved_service_count}</li>
            <li>Membri echipa publici: {content_summary.approved_public_team_count}</li>
            <li>Articole publicate: {content_summary.approved_published_article_count}</li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">Activitate recenta</div>
          {ownSubmissions.length === 0 && <p className="text-xs text-muted-foreground">Nicio activitate recenta.</p>}
          <ul className="space-y-1 text-xs text-muted-foreground">
            {ownSubmissions.map((s) => (
              <li key={s.id}>{SECTION_LABELS[s.section] || s.section} — {SUBMISSION_STATUS_LABELS[s.status] || s.status}{s.submitted_at ? ` (${new Date(s.submitted_at).toLocaleDateString("ro-RO")})` : ""}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}