import React from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  UserRound,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import AccountSettings from "@/components/workspace/account/AccountSettings";
import ProfessionalProfileEditor from "./ProfessionalProfileEditor";
import {
  PROFESSIONAL_REVIEW_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
} from "@/lib/professionalProfileCatalog";

const NAV_ITEMS = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  { key: "profile", label: "Profil profesional", icon: UserRound },
  { key: "locations", label: "Locatii asociate", icon: Building2 },
  { key: "settings", label: "Setari", icon: Settings },
];

function InfoCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function professionalChecklist(professional, assignments) {
  const draft = {
    ...professional,
    ...(professional.pending_profile || {}),
  };
  const contactRequired = draft.accepts_independent_requests === true;
  return [
    {
      key: "identity",
      label: "Identitate profesionala",
      detail: "Nume public si tip profesional",
      done: String(draft.public_display_name || draft.full_name || "").trim().length >= 3 && Boolean(professional.professional_type),
      required: true,
    },
    {
      key: "bio",
      label: "Descriere profesionala",
      detail: "Minimum 80 de caractere",
      done: String(draft.professional_bio || "").trim().length >= 80,
      required: true,
    },
    {
      key: "specializations",
      label: "Domenii profesionale",
      detail: "Cel putin un domeniu selectat",
      done: Array.isArray(draft.specializations) && draft.specializations.length > 0,
      required: true,
    },
    {
      key: "photo",
      label: "Fotografie profesionala",
      detail: "Recomandata pentru incredere si recunoastere",
      done: Boolean(draft.profile_photo_url),
      required: false,
    },
    {
      key: "contact",
      label: "Contact public",
      detail: contactRequired
        ? "Necesar pentru a accepta cereri independente"
        : "Telefon sau email public, optional",
      done: Boolean(draft.public_phone || draft.public_email),
      required: contactRequired,
    },
    {
      key: "locations",
      label: "Locatii asociate",
      detail: "Optional pentru specialistul independent",
      done: assignments.length > 0,
      required: false,
    },
  ];
}

function reviewPresentation(reviewStatus, professional, missingRequiredCount) {
  if (reviewStatus === "pending_review") {
    return {
      icon: Clock3,
      title: "Profilul este in verificare",
      description: "Datele trimise sunt blocate temporar. VIASEE verifica profilul inainte de publicare.",
      tone: "border-blue-200 bg-blue-50 text-blue-950",
      actionLabel: "",
    };
  }
  if (reviewStatus === "approved") {
    return {
      icon: CheckCircle2,
      title: professional.is_public ? "Profil profesional public" : "Profil profesional aprobat",
      description: professional.is_public
        ? "Profilul este verificat si poate aparea in VIASEE si la locatiile publice asociate."
        : "Profilul a fost verificat. Publicarea depinde de setarile profilului si ale locatiilor asociate.",
      tone: "border-green-200 bg-green-50 text-green-950",
      actionLabel: "Actualizeaza profilul",
    };
  }
  if (reviewStatus === "needs_more_info") {
    return {
      icon: AlertCircle,
      title: "Sunt necesare completari",
      description: professional.review_note || "VIASEE a solicitat informatii suplimentare inainte de aprobarea profilului.",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      actionLabel: "Completeaza profilul",
    };
  }
  if (reviewStatus === "rejected") {
    return {
      icon: AlertCircle,
      title: "Profilul nu a fost aprobat",
      description: professional.review_note || "Verifica datele profesionale si corecteaza informatiile inainte de o noua trimitere.",
      tone: "border-red-200 bg-red-50 text-red-950",
      actionLabel: "Revizuieste profilul",
    };
  }
  return {
    icon: missingRequiredCount > 0 ? AlertCircle : CheckCircle2,
    title: missingRequiredCount > 0 ? "Profil in pregatire" : "Profil pregatit pentru verificare",
    description: missingRequiredCount > 0
      ? `Mai ai ${missingRequiredCount} ${missingRequiredCount === 1 ? "pas obligatoriu" : "pasi obligatorii"} de completat.`
      : "Datele obligatorii sunt complete. Poti trimite profilul spre verificare din editor.",
    tone: "border-border bg-card text-foreground",
    actionLabel: missingRequiredCount > 0 ? "Continua profilul" : "Trimite spre verificare",
  };
}

function Overview({ workspace, onNavigate }) {
  const professional = workspace.professional;
  const assignments = workspace.assignments || [];
  const reviewStatus = professional.profile_review_status || professional.public_visibility_status || "draft";
  const checklist = professionalChecklist(professional, assignments);
  const requiredItems = checklist.filter((item) => item.required);
  const completedRequiredCount = requiredItems.filter((item) => item.done).length;
  const missingRequiredCount = requiredItems.length - completedRequiredCount;
  const presentation = reviewPresentation(reviewStatus, professional, missingRequiredCount);
  const StatusIcon = presentation.icon;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Cont profesional</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestioneaza identitatea profesionala si locatiile cu care ai confirmat asocierea.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Tip profesional" value={PROFESSIONAL_TYPE_LABELS[professional.professional_type] || "Specialist"} hint="Tipul profesional nu poate fi schimbat de o clinica sau optica." />
        <InfoCard label="Status profil" value={PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus} hint="Profilul devine public numai dupa completare si verificare." />
        <InfoCard label="Locatii asociate" value={assignments.length} hint={`${workspace.public_assignment_count || 0} publice · ${workspace.private_assignment_count || 0} private`} />
      </div>

      <section className={`rounded-3xl border p-5 shadow-sm ${presentation.tone}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
              <StatusIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Status profil</div>
              <h2 className="mt-1 text-base font-bold">{presentation.title}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed opacity-75">{presentation.description}</p>
            </div>
          </div>
          {presentation.actionLabel && (
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background sm:w-auto"
            >
              {presentation.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Checklist profil profesional</h2>
              <p className="mt-1 text-xs text-muted-foreground">Pasii obligatorii controleaza trimiterea spre verificare. Ceilalti imbunatatesc profilul.</p>
            </div>
            <div className="text-xs font-semibold text-muted-foreground">{completedRequiredCount}/{requiredItems.length} obligatorii</div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${requiredItems.length ? (completedRequiredCount / requiredItems.length) * 100 : 0}%` }} />
          </div>

          <div className="mt-5 divide-y divide-border">
            {checklist.map((item) => {
              const ItemIcon = item.done ? CheckCircle2 : item.required ? AlertCircle : Circle;
              return (
                <div key={item.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <ItemIcon className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? "text-green-700" : item.required ? "text-amber-700" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.required ? "Obligatoriu" : "Optional"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold ${item.done ? "text-green-700" : "text-muted-foreground"}`}>
                    {item.done ? "Complet" : "Necompletat"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <h2 className="mt-4 text-sm font-bold">Un singur profil profesional</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Acest profil iti apartine indiferent daca lucrezi independent sau esti invitat sa apari la o locatie.
          </p>
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>Asocierea cu o locatie nu ofera acces la administrarea organizatiei.</li>
            <li>Poti avea zero, una sau mai multe locatii asociate.</li>
            <li>Organizatia gestioneaza doar asocierea si afisarea la locatia sa.</li>
          </ul>
          <button
            type="button"
            onClick={() => onNavigate("locations")}
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary"
          >
            Vezi locatiile <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>
    </div>
  );
}

function Locations({ workspace }) {
  const assignments = workspace.assignments || [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii asociate</h1>
        <p className="mt-1 text-xs text-muted-foreground">Asocierile sunt confirmate de tine. Publicarea la o locatie este un pas separat.</p>
      </div>
      <div className="space-y-3">
        {assignments.length === 0 && <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu exista locatii asociate.</div>}
        {assignments.map((assignment) => (
          <section key={assignment.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">{assignment.location?.name || "Locatie"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresa necompletata"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Asocierea confirma faptul ca activezi aici. Nu ofera acces la administrarea clinicii sau opticii.</p>
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

export default function ProfessionalWorkspaceRoot({
  user,
  workspace,
  onLogout,
  onRefresh,
  accountModes,
  activeMode,
  onSwitchMode,
  modeSwitches,
}) {
  const [params, setParams] = useSearchParams();
  const section = params.get("ps") || "overview";
  const safeSection = NAV_ITEMS.some((item) => item.key === section) ? section : "overview";
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("ps", key);
    setParams(next);
  };
  const reviewStatus = workspace.professional?.profile_review_status || workspace.professional?.public_visibility_status || "draft";

  return (
    <ProviderAppShell
      navItems={NAV_ITEMS}
      activeKey={safeSection}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={workspace.professional?.public_display_name || workspace.professional?.full_name || "Cont profesional"}
      subtitle="Cont profesional"
      modeSwitches={modeSwitches}
      statusBadge={<span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold sm:inline-flex">{PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus}</span>}
    >
      {safeSection === "overview" && <Overview workspace={workspace} onNavigate={navigate} />}
      {safeSection === "profile" && <ProfessionalProfileEditor workspace={workspace} onRefresh={onRefresh} />}
      {safeSection === "locations" && <Locations workspace={workspace} />}
      {safeSection === "settings" && (
        <AccountSettings
          user={user}
          accountModes={accountModes}
          activeMode={activeMode}
          onSwitchMode={onSwitchMode}
          onRefresh={onRefresh}
          onLogout={onLogout}
        />
      )}
    </ProviderAppShell>
  );
}
