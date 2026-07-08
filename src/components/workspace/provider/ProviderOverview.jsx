import React from "react";
import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { getProfileAudience, PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

const SECTION_LABELS = { public_profile: "Profil public", location_details: "Date locatie", services: "Servicii", team: "Echipa", media: "Fotografii", article: "Articol" };

export default function ProviderOverview({ overview, onNavigate }) {
  const { completion, content_summary, pending_submissions = [], public_preview, latest_admin_note, latest_review_status } = overview;
  const ownSubmissions = pending_submissions.filter((s) => s.id);
  const location = overview.location || {};
  const profileTypeLabel = PROVIDER_PROFILE_TYPES[location.provider_profile_type] || "Tip profil nesetat";
  const providerTypeLabel = PROVIDER_TYPES[location.provider_type] || location.provider_type || "Tip furnizor nesetat";
  const audienceLabel = getProfileAudience(location.provider_profile_type);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{location.organization_name || "Workspace furnizor"}</span>
          <span>·</span>
          <span>{audienceLabel}</span>
        </div>
        <h1 className="mt-1 font-heading text-2xl font-extrabold tracking-tight">{location.public_display_name || location.name}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="font-semibold text-sm mb-2">Tip profil</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1 text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5" /> {profileTypeLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5" /> {audienceLabel}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Clasificare interna: {providerTypeLabel}. Aceasta stabileste unde apare profilul si ce module sunt relevante pentru el.
            </p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <div className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {location.city || location.locality_name || "Localitate nesetata"}{location.county ? `, ${location.county}` : ""}
            </div>
            {location.address && <div className="mt-1 max-w-xs">{location.address}</div>}
          </div>
        </div>
      </div>

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