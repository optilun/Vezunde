import React, { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  MapPin,
  MessageSquareMore,
  RefreshCw,
  RotateCcw,
  UserRound,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";
import { professionalSpecializationLabel } from "../../../../shared/professionalIdentity.js";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminDecisionBar from "@/components/admin/ui/AdminDecisionBar";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { fullDateTime, oldestFirst, waitingInfo } from "@/lib/adminFormat";
import { profileControlLabel } from "@/lib/adminLabels";

// 2026-09-03: etichetele veneau din a sasea copie a taxonomiei. Acum din shared/professionalIdentity.js.
const TYPE_LABELS = PROFESSIONAL_TYPE_LABELS;

function specializationText(key) {
  return professionalSpecializationLabel(key);
}

const DECISION_MESSAGES = {
  approve: "Profilul specialistului a fost aprobat și publicat.",
  request_more_info: "Au fost cerute completări.",
  reject: "Profilul a fost respins.",
  archive: "Profilul a fost arhivat și scos din public. Asocierile au trecut pe privat.",
  restore: "Profilul a fost reactivat ca ciornă. Republicarea cere o nouă aprobare.",
};

const REVIEW_ACTIONS = new Set(["approve", "request_more_info", "reject"]);

const STATUS_FILTERS = [
  { key: "pending_review", label: "În verificare" },
  { key: "approved", label: "Aprobate" },
  { key: "needs_more_info", label: "Completări cerute" },
  { key: "rejected", label: "Respinse" },
];

function initials(value) {
  return String(value || "S")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfilePhoto({ draft, name }) {
  if (draft.profile_photo_url) {
    return (
      <img
        src={draft.profile_photo_url}
        alt={`Fotografie ${draft.public_display_name || name}`}
        className="h-16 w-16 rounded-2xl border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary font-heading text-lg font-bold" aria-hidden="true">
      {initials(draft.public_display_name || name)}
    </div>
  );
}

function ContactItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border bg-secondary/35 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-xs font-medium">{value}</div>
    </div>
  );
}

// Arhivarea este singura actiune care scoate offline deliberat un profil public, deci cere
// motiv scris. Aprobarea nu cere, pentru ca nu ia nimic nimanui.
function decisionActions(profile) {
  const pendingReview = profile.profile_review_status === "pending_review";
  const primary = pendingReview
    ? [
      { key: "approve", label: "Aprobă", icon: CheckCircle2, tone: "primary", note: "optional" },
      { key: "request_more_info", label: "Cere completări", icon: MessageSquareMore, note: "required", noteLabel: "Ce trebuie completat?", noteRequiredMessage: "Scrie ce informații trebuie adăugate.", confirmLabel: "Trimite cererea" },
      { key: "reject", label: "Respinge", icon: XCircle, tone: "danger", note: "required", noteLabel: "Motivul respingerii", noteRequiredMessage: "Scrie motivul respingerii.", confirmLabel: "Respinge profilul" },
    ]
    : [];
  // Ciclul de viata al persoanei, nu doar al draftului. Arhivarea inchide pagina publica si trece
  // asocierile pe privat; reactivarea readuce profilul in lucru, nu il republica - pentru asta e
  // nevoie de o noua aprobare.
  const secondary = profile.public_visibility_status === "archived"
    ? [{ key: "restore", label: "Reactivează ca ciornă", icon: RotateCcw, note: "required", noteLabel: "Motivul reactivării", noteRequiredMessage: "Scrie motivul reactivării.", confirmLabel: "Reactivează" }]
    : [{ key: "archive", label: "Arhivează profilul", icon: Archive, note: "required", noteLabel: "Motivul scoaterii din public", notePlaceholder: "Profilul iese din căutare și din paginile publice. Nu se șterge nimic.", noteRequiredMessage: "Scrie motivul pentru care profilul este scos din public.", confirmLabel: "Arhivează" }];
  return { primary, secondary };
}

export default function AdminProfessionalProfileReview() {
  const { counts, refresh: refreshCounts } = useAdminCounts();
  const [items, setItems] = useState([]);
  // 2026-09-03: coada nu mai arata doar `pending_review`. Fara filtru, un profil deja aprobat sau
  // arhivat era invizibil pentru admin, deci arhivarea si reactivarea nu aveau de unde sa fie
  // pornite - exact motivul pentru care statusul `archived` a stat nefolosit in enum.
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminProfessionalProfileReview", {
        action: "list",
        status: statusFilter,
      });
      setItems(oldestFirst(response.data?.profiles || [], (profile) => profile.submitted_at || profile.created_date));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Nu am putut încărca profilurile profesionale.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Aruncă la eroare: mesajul apare sub butoanele cardului.
  const decide = async (profile, action, note) => {
    setBusy(true);
    try {
      const response = await base44.functions.invoke("adminProfessionalProfileReview", {
        action,
        professional_id: profile.id,
        note,
      });
      if (response.data?.error) throw new Error(response.data.error);
    } finally {
      setBusy(false);
    }
    setMessage(DECISION_MESSAGES[action] || "Decizia a fost aplicată.");
    if (REVIEW_ACTIONS.has(action) && statusFilter === "pending_review") {
      setItems((current) => current.filter((item) => item.id !== profile.id));
    }
    refreshCounts();
    load().catch(() => {});
  };

  const chips = STATUS_FILTERS.map((filter) => (
    filter.key === "pending_review" && Number.isFinite(counts?.review?.professionals)
      ? { ...filter, count: counts.review.professionals }
      : filter
  ));

  return (
    <div className="space-y-4">
      <AdminCard className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading text-base font-bold">Profiluri de specialiști</h2>
            <AdminHint label="Ce înseamnă aprobarea">
              Aprobarea publică identitatea profesională și asocierile eligibile cu locațiile.
            </AdminHint>
          </div>
          <button
            type="button"
            onClick={() => { setMessage(""); load(); }}
            disabled={loading || busy}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Reîncarcă
          </button>
        </div>
        <AdminChips
          className="mt-3"
          options={chips}
          value={statusFilter}
          onChange={(next) => { setMessage(""); setStatusFilter(next); }}
          label="Filtrează profilurile de specialiști"
        />
      </AdminCard>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}
      {message && <AdminNotice tone="success" onDismiss={() => setMessage("")}>{message}</AdminNotice>}

      {loading && items.length === 0 && <AdminLoading label="Se încarcă profilurile…" />}

      {!loading && items.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={UserRound}
            title="Niciun profil de specialist în această stare."
            subtitle="Apar aici după ce specialistul își completează datele și le trimite spre verificare."
          />
        </AdminCard>
      )}

      <div className="space-y-4">
        {items.map((profile) => {
          const draft = profile.draft || {};
          const locations = profile.assignments || [];
          const { primary, secondary } = decisionActions(profile);
          const waiting = profile.submitted_at ? waitingInfo(profile.submitted_at) : null;

          return (
            <article key={profile.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <ProfilePhoto draft={draft} name={profile.full_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">
                          {draft.public_display_name || profile.full_name}
                        </h3>
                        <StatusBadge label={TYPE_LABELS[profile.professional_type] || profile.professional_type} />
                        {waiting && (
                          <span title={fullDateTime(profile.submitted_at)}>
                            <StatusBadge label={`Trimis ${waiting.label}`} tone={waiting.tone} />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cont: {profile.full_name || "—"} · Completitudine: {profile.profile_completeness || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Descriere profesională</div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                        {draft.professional_bio || "Descriere necompletată."}
                      </p>

                      {(draft.specializations || []).length > 0 && (
                        <>
                          <div className="mt-4 text-xs font-semibold text-muted-foreground">Domenii profesionale</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {draft.specializations.map((key) => (
                              <span key={key} className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-xs font-medium">
                                {specializationText(key) || key}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <ContactItem label="Telefon" value={draft.public_phone} />
                      <ContactItem label="Email" value={draft.public_email} />
                      <ContactItem label="Website" value={draft.public_website_url} />
                      <ContactItem label="LinkedIn" value={draft.linkedin_url} />
                      <ContactItem label="Facebook" value={draft.facebook_url} />
                      <ContactItem label="Instagram" value={draft.instagram_url} />
                      {draft.accepts_independent_requests && (
                        <AdminNotice tone="warning" icon={false} className="font-semibold">
                          Cere activarea cererilor independente.
                        </AdminNotice>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="text-xs font-semibold text-muted-foreground">Locații asociate</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {locations.map((assignment) => (
                        <div key={assignment.id} className="rounded-xl border border-border bg-secondary/30 px-3 py-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {assignment.location?.name || "Locație indisponibilă"}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresă nepublicată"}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <StatusBadge label={assignment.active_status === "activ" ? "Asociere activă" : "Asociere inactivă"} tone={assignment.active_status === "activ" ? "success" : "neutral"} />
                                <StatusBadge label={profileControlLabel(assignment.location?.profile_control_status)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {locations.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nu există nicio locație asociată.</p>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="w-full shrink-0 rounded-2xl border border-border bg-secondary/20 p-3 xl:w-64">
                  <AdminDecisionBar
                    stack
                    busy={busy}
                    actions={primary}
                    secondaryActions={secondary}
                    onDecide={(action, note) => decide(profile, action, note)}
                  />
                </aside>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
