import React from "react";
import { Building2, LayoutDashboard, Settings, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";

const NAV_ITEMS = [
  { key: "overview", label: "Prezentare generală", icon: LayoutDashboard },
  { key: "profile", label: "Profil profesional", icon: UserRound },
  { key: "locations", label: "Locații asociate", icon: Building2 },
  { key: "settings", label: "Setări", icon: Settings },
];

const TYPE_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending_review: "În verificare",
  approved: "Aprobat",
  rejected: "Respins",
  needs_more_info: "Necesită completări",
  archived: "Arhivat",
};

function InfoCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Overview({ workspace }) {
  const professional = workspace.professional;
  const assignments = workspace.assignments || [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Cont profesional</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestionează identitatea profesională și locațiile cu care ai confirmat asocierea.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Tip profesional" value={TYPE_LABELS[professional.professional_type] || "Specialist"} hint="Tipul profesional nu poate fi schimbat de o clinică sau optică." />
        <InfoCard label="Status profil" value={STATUS_LABELS[professional.public_visibility_status] || professional.public_visibility_status} hint="Profilul devine public numai după completare și verificare." />
        <InfoCard label="Locații asociate" value={assignments.length} hint={`${workspace.public_assignment_count || 0} publice · ${workspace.private_assignment_count || 0} private`} />
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Următorul pas</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Completează profilul profesional: nume public, fotografie, descriere, specializări și date de contact. Editorul complet va fi activat în etapa următoare.</p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">Profil nepublicat</span>
        </div>
      </section>
    </div>
  );
}

function Profile({ workspace }) {
  const professional = workspace.professional;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil profesional</h1>
        <p className="mt-1 text-xs text-muted-foreground">Identitatea profesională îți aparține și nu poate fi modificată de locațiile asociate.</p>
      </div>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-secondary/35 p-4">
            <div className="text-[11px] text-muted-foreground">Nume profil</div>
            <div className="mt-1 text-sm font-bold">{professional.public_display_name || professional.full_name}</div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/35 p-4">
            <div className="text-[11px] text-muted-foreground">Tip profesional</div>
            <div className="mt-1 text-sm font-bold">{TYPE_LABELS[professional.professional_type] || professional.professional_type}</div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/35 p-4 sm:col-span-2">
            <div className="text-[11px] text-muted-foreground">Descriere profesională</div>
            <div className="mt-1 text-sm leading-relaxed">{professional.professional_bio || "Nu este completată încă."}</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">Editarea și trimiterea spre verificare vor fi implementate în următorul pas. Datele existente nu sunt publicate automat.</div>
      </section>
    </div>
  );
}

function Locations({ workspace }) {
  const assignments = workspace.assignments || [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locații asociate</h1>
        <p className="mt-1 text-xs text-muted-foreground">Asocierile sunt confirmate de tine. Publicarea la o locație este un pas separat.</p>
      </div>
      <div className="space-y-3">
        {assignments.length === 0 && <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu există locații asociate.</div>}
        {assignments.map((assignment) => (
          <section key={assignment.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">{assignment.location?.name || "Locație"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresă necompletată"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${assignment.public_status === "public" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>
                {assignment.public_status === "public" ? "Public" : "Privat"}
              </span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setări</h1>
      <p className="mt-2 text-sm text-muted-foreground">Notificările, disponibilitatea pentru mesaje și opțiunile planului profesional vor fi adăugate ulterior.</p>
    </section>
  );
}

export default function ProfessionalWorkspaceRoot({ user, workspace, onLogout, onSwitchPersonal }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("ps") || "overview";
  const safeSection = NAV_ITEMS.some((item) => item.key === section) ? section : "overview";
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("ps", key);
    setParams(next);
  };

  return (
    <ProviderAppShell
      navItems={NAV_ITEMS}
      activeKey={safeSection}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={workspace.professional?.public_display_name || workspace.professional?.full_name || "Cont profesional"}
      subtitle="Cont profesional"
      modeSwitch={onSwitchPersonal ? { label: "Cont personal", onClick: onSwitchPersonal } : null}
      statusBadge={<span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold sm:inline-flex">{STATUS_LABELS[workspace.professional?.public_visibility_status] || "Draft"}</span>}
    >
      {safeSection === "overview" && <Overview workspace={workspace} />}
      {safeSection === "profile" && <Profile workspace={workspace} />}
      {safeSection === "locations" && <Locations workspace={workspace} />}
      {safeSection === "settings" && <SettingsPanel />}
    </ProviderAppShell>
  );
}