import React, { lazy, Suspense, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Check,
  Clock3,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  Unlink,
  UserRound,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
const AccountSettings = lazy(() => import("@/components/workspace/account/AccountSettings"));
const ProfessionalProfileEditor = lazy(() => import("./ProfessionalProfileEditor"));
import {
  PROFESSIONAL_REVIEW_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
} from "@/lib/professionalProfileCatalog";
import {
  PROFESSIONAL_BIO_MIN_LENGTH,
  PROFESSIONAL_NAME_MIN_LENGTH,
  professionalProfileCompleteness,
  professionalSubmissionBlockers,
} from "../../../../shared/professionalProfileStatus.js";

function WorkspaceSectionLoading() {
  return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">Se încarcă secțiunea...</div>;
}

const NAV_ITEMS = [
  { key: "overview", label: "Prezentare generală", shortLabel: "Acasă", icon: LayoutDashboard },
  { key: "profile", label: "Profil profesional", shortLabel: "Profil", icon: UserRound },
  { key: "locations", label: "Locații asociate", shortLabel: "Locații", icon: Building2 },
  { key: "settings", label: "Setări", shortLabel: "Setări", icon: Settings },
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

function professionalDraft(professional) {
  return {
    ...professional,
    ...(professional.pending_profile || {}),
  };
}

// 2026-09-03: ce este obligatoriu se decide in shared/professionalProfileStatus.js, acelasi loc
// din care valideaza si serverul. Inainte, checklist-ul isi avea propriile praguri scrise de mana;
// orice schimbare pe server (de exemplu lungimea minima a descrierii) ar fi lasat ecranul sa spuna
// "gata de trimitere" iar serverul sa raspunda ca nu e.
function professionalChecklist(professional, assignments) {
  const draft = professionalDraft(professional);
  const contactRequired = draft.accepts_independent_requests === true;
  const blockers = new Set(professionalSubmissionBlockers({
    ...draft,
    public_display_name: draft.public_display_name || draft.full_name,
  }));
  return [
    {
      key: "identity",
      label: "Identitate profesională",
      detail: `Nume public de minimum ${PROFESSIONAL_NAME_MIN_LENGTH} caractere și tip profesional`,
      done: !blockers.has("display_name") && Boolean(professional.professional_type),
      required: true,
    },
    {
      key: "bio",
      label: "Descriere profesională",
      detail: `Minimum ${PROFESSIONAL_BIO_MIN_LENGTH} de caractere`,
      done: !blockers.has("bio"),
      required: true,
    },
    {
      key: "specializations",
      label: "Domenii profesionale",
      detail: "Cel puțin un domeniu selectat",
      done: !blockers.has("specializations"),
      required: true,
    },
    {
      key: "photo",
      label: "Fotografie profesională",
      detail: "Recomandată pentru încredere și recunoaștere",
      done: Boolean(draft.profile_photo_url),
      required: false,
    },
    {
      key: "contact",
      label: "Contact public",
      detail: contactRequired
        ? "Necesar pentru a accepta cereri independente"
        : "Telefon sau email public, opțional",
      done: Boolean(draft.public_phone || draft.public_email),
      required: contactRequired,
    },
    {
      key: "locations",
      label: "Locații asociate",
      detail: "Opțional pentru specialistul independent",
      done: assignments.length > 0,
      required: false,
    },
  ];
}

function reviewPresentation(reviewStatus, professional, missingRequiredCount) {
  // Arhivarea are prioritate fata de statusul draftului: un profil arhivat ramane `approved` ca
  // review, dar nu mai este vizibil nicaieri. Fara linia asta, specialistul ar fi citit "Profil
  // profesional public" despre o pagina care nu mai exista pentru pacienti.
  if (professional.public_visibility_status === "archived") {
    return {
      icon: AlertCircle,
      title: "Profilul este arhivat",
      description: professional.review_note
        || "Profilul a fost scos din paginile publice de echipa VIASEE. Datele tale sunt păstrate.",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      actionLabel: "",
    };
  }
  if (reviewStatus === "pending_review") {
    return {
      icon: Clock3,
      title: "Profilul este în verificare",
      description: "Datele trimise sunt blocate temporar. VIASEE verifică profilul înainte de publicare.",
      tone: "border-blue-200 bg-blue-50 text-blue-950",
      actionLabel: "",
    };
  }
  if (reviewStatus === "approved") {
    return {
      icon: CheckCircle2,
      title: professional.is_public ? "Profil profesional public" : "Profil profesional aprobat",
      description: professional.is_public
        ? "Profilul este verificat. Tu alegi separat locațiile la care accepți să fii afișat public."
        : "Profilul a fost verificat. Publicarea depinde de setările profilului și de acordul tău pentru fiecare locație.",
      tone: "border-green-200 bg-green-50 text-green-950",
      actionLabel: "Actualizează profilul",
    };
  }
  if (reviewStatus === "needs_more_info") {
    return {
      icon: AlertCircle,
      title: "Sunt necesare completări",
      description: professional.review_note || "VIASEE a solicitat informații suplimentare înainte de aprobarea profilului.",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      actionLabel: "Completează profilul",
    };
  }
  if (reviewStatus === "rejected") {
    return {
      icon: AlertCircle,
      title: "Profilul nu a fost aprobat",
      description: professional.review_note || "Verifică datele profesionale și corectează informațiile înainte de o nouă trimitere.",
      tone: "border-red-200 bg-red-50 text-red-950",
      actionLabel: "Revizuiește profilul",
    };
  }
  return {
    icon: missingRequiredCount > 0 ? AlertCircle : CheckCircle2,
    title: missingRequiredCount > 0 ? "Profil în pregătire" : "Profil pregătit pentru verificare",
    description: missingRequiredCount > 0
      ? `Mai ai ${missingRequiredCount} ${missingRequiredCount === 1 ? "pas obligatoriu" : "pași obligatorii"} de completat.`
      : "Datele obligatorii sunt complete. Poți trimite profilul spre verificare din editor.",
    tone: "border-border bg-card text-foreground",
    actionLabel: missingRequiredCount > 0 ? "Continuă profilul" : "Trimite spre verificare",
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
  // Acelasi calcul ca pe server, nu o a doua formula scrisa in interfata.
  const draft = professionalDraft(professional);
  const completeness = professionalProfileCompleteness(
    { ...draft, public_display_name: draft.public_display_name || draft.full_name },
    professional.professional_type,
    Boolean(professional.professional_type),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Cont profesional</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestionează identitatea profesională și locațiile cu care ai confirmat asocierea.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Tip profesional" value={PROFESSIONAL_TYPE_LABELS[professional.professional_type] || "Specialist"} hint="Tipul profesional nu poate fi schimbat de o clinică sau optică." />
        <InfoCard
          label="Status profil"
          value={professional.public_visibility_status === "archived"
            ? "Arhivat"
            : (PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus)}
          hint="Profilul devine public numai după completare și verificare."
        />
        <InfoCard
          label="Completitudine"
          value={`${completeness}%`}
          hint="Calculată din aceleași criterii pe care le verifică echipa VIASEE."
        />
        <InfoCard label="Locații asociate" value={assignments.length} hint={`${workspace.public_assignment_count || 0} publice · ${workspace.pending_visibility_count || 0} solicitări de afișare`} />
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
              <p className="mt-1 text-xs text-muted-foreground">Pașii obligatorii controlează trimiterea spre verificare. Ceilalți îmbunătățesc profilul.</p>
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
                        {item.required ? "Obligatoriu" : "Opțional"}
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
            Acest profil îți aparține indiferent dacă lucrezi independent sau ești invitat să apari la o locație.
          </p>
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>Asocierea cu o locație nu oferă acces la administrarea organizației.</li>
            <li>Poți avea zero, una sau mai multe locații asociate.</li>
            <li>Organizația poate solicita afișarea, dar tu accepți, refuzi sau retragi acordul.</li>
          </ul>
          <button
            type="button"
            onClick={() => onNavigate("locations")}
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary"
          >
            Vezi locațiile <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>
    </div>
  );
}

function consentPresentation(assignment) {
  if (assignment.public_status === "public" && assignment.visibility_consent_status === "accepted") {
    return { label: "Public", className: "bg-green-100 text-green-800" };
  }
  if (assignment.visibility_consent_status === "pending") {
    return { label: "Așteaptă decizia ta", className: "bg-blue-50 text-blue-800" };
  }
  if (assignment.visibility_consent_status === "declined") {
    return { label: "Afișare refuzată", className: "bg-amber-50 text-amber-800" };
  }
  if (assignment.visibility_consent_status === "revoked") {
    return { label: "Acord retras", className: "bg-amber-50 text-amber-800" };
  }
  return { label: "Privat", className: "bg-secondary text-muted-foreground" };
}

function Locations({ workspace, onRefresh }) {
  const assignments = workspace.assignments || [];
  const pendingCount = assignments.filter((item) => item.visibility_consent_status === "pending").length;
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateVisibility = async (assignment, action) => {
    setSavingId(assignment.id);
    setMessage("");
    setError("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action,
      location_id: assignment.location_id,
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message },
    }));
    setSavingId("");

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }

    const messages = {
      accept_visibility: "Ai acceptat afișarea profilului la această locație.",
      decline_visibility: "Ai refuzat afișarea profilului la această locație. Asocierea profesională rămâne activă și privată.",
      hide_visibility: "Ai retras acordul de afișare. Profilul nu mai apare public la această locație.",
    };
    setMessage(messages[action] || "Setarea a fost actualizată.");
    await onRefresh?.();
  };

  const withdrawAssignment = async (assignment) => {
    const locationName = assignment.location?.name || "această locație";
    const confirmed = window.confirm(
      `Retragi asocierea cu ${locationName}? Profilul profesional rămâne activ, dar nu vei mai apărea la această locație.`
    );
    if (!confirmed) return;

    setSavingId(assignment.id);
    setMessage("");
    setError("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "withdraw",
      location_id: assignment.location_id,
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message },
    }));
    setSavingId("");

    if (response.data?.error) {
      setError(response.data.error);
      return;
    }

    setMessage("Asocierea a fost retrasă. Profilul profesional a rămas activ.");
    await onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locații asociate</h1>
        <p className="mt-1 text-xs text-muted-foreground">Confirmarea asocierii și acceptarea afișării publice sunt două decizii separate. Tu controlezi unde apare profilul tău.</p>
      </div>
      {message && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">{message}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">{error}</div>}
      {/* 2026-09-03: cu multe locatii, cererile de afisare se pierdeau in lista - nimic nu spunea
          cate asteapta o decizie. Deliberat NU exista "accepta tot": fiecare locatie este o
          decizie separata despre unde apare numele tau, si tocmai asta apara modelul de consimtamant. */}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">
          {pendingCount === 1
            ? "O locație așteaptă decizia ta de afișare."
            : `${pendingCount} locații așteaptă decizia ta de afișare.`}{" "}
          Fiecare locație se decide separat.
        </div>
      )}
      <div className="space-y-3">
        {assignments.length === 0 && <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu există locații asociate.</div>}
        {assignments.map((assignment) => {
          const status = consentPresentation(assignment);
          const isPending = assignment.visibility_consent_status === "pending";
          const isPublic = assignment.public_status === "public" && assignment.visibility_consent_status === "accepted";
          return (
            <section key={assignment.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold">{assignment.location?.name || "Locație"}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresa necompletată"}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Asocierea confirmă faptul că activezi aici. Nu oferă acces la administrarea clinicii sau opticii.</p>
                  {isPending && <p className="mt-2 text-[11px] leading-relaxed text-blue-700">Locația a solicitat să afișeze profilul tău. Poți accepta sau refuza fără să închei asocierea profesională.</p>}
                </div>
                <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  {isPending && (
                    <>
                      <button
                        type="button"
                        disabled={savingId === assignment.id}
                        onClick={() => updateVisibility(assignment, "accept_visibility")}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-green-200 px-3 text-[11px] font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                      >
                        <Eye className="h-3.5 w-3.5" /> Acceptă afișarea
                      </button>
                      <button
                        type="button"
                        disabled={savingId === assignment.id}
                        onClick={() => updateVisibility(assignment, "decline_visibility")}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-amber-200 px-3 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Refuză
                      </button>
                    </>
                  )}
                  {isPublic && (
                    <button
                      type="button"
                      disabled={savingId === assignment.id}
                      onClick={() => updateVisibility(assignment, "hide_visibility")}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      <EyeOff className="h-3.5 w-3.5" /> Ascunde profilul
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={savingId === assignment.id}
                    onClick={() => withdrawAssignment(assignment)}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-red-200 px-3 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    {savingId === assignment.id ? "Se salvează..." : "Retrage asocierea"}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
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
      <Suspense fallback={<WorkspaceSectionLoading />}>
        {/* Confirmarea crearii profilului (2026-08-19, gasit la audit): fluxul de
            onboarding trimitea deja ?onboarding=created in adresa, dar nimeni nu citea
            parametrul - utilizatorul isi crea profilul si ajungea intr-un ecran care
            nu-i confirma nimic. Celalalt drum de intrare (acceptarea unei invitatii)
            confirma corect reusita; asta era o inconsecventa reala intre cele doua. */}
        {params.get("onboarding") === "created" && (
          <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">Profilul profesional a fost creat.</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-emerald-800">
                Completează datele de mai jos și trimite profilul spre verificare. Până atunci rămâne privat.
              </p>
            </div>
          </div>
        )}
        {safeSection === "overview" && <Overview workspace={workspace} onNavigate={navigate} />}
        {safeSection === "profile" && <ProfessionalProfileEditor workspace={workspace} onRefresh={onRefresh} />}
        {safeSection === "locations" && <Locations workspace={workspace} onRefresh={onRefresh} />}
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
      </Suspense>
    </ProviderAppShell>
  );
}