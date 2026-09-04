import React, { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Loader2,
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

// 2026-09-03: etichetele veneau din a sasea copie a taxonomiei. Acum din shared/professionalIdentity.js.
const TYPE_LABELS = PROFESSIONAL_TYPE_LABELS;

function specializationText(key) {
  return professionalSpecializationLabel(key);
}

// Arhivarea este singura actiune care scoate offline deliberat un profil public, deci cere
// motiv scris. Aprobarea nu cere, pentru ca nu ia nimic nimanui.
const NOTE_REQUIRED_ACTIONS = new Set(["request_more_info", "reject", "archive", "restore"]);

const NOTE_PROMPTS = {
  request_more_info: "Completează nota cu informațiile care trebuie adăugate.",
  reject: "Completează motivul respingerii.",
  archive: "Scrie motivul pentru care profilul este scos din public.",
  restore: "Scrie motivul reactivării.",
};

const DECISION_MESSAGES = {
  approve: "Profilul specialistului a fost aprobat și publicat.",
  request_more_info: "Au fost solicitate completări.",
  reject: "Profilul a fost respins.",
  archive: "Profilul a fost arhivat și scos din public. Asocierile au trecut pe privat.",
  restore: "Profilul a fost reactivat ca draft. Republicarea cere o nouă aprobare.",
};

const STATUS_FILTERS = [
  { key: "pending_review", label: "În verificare" },
  { key: "approved", label: "Aprobate" },
  { key: "needs_more_info", label: "Completări cerute" },
  { key: "rejected", label: "Respinse" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ro-RO");
  } catch (_error) {
    return value;
  }
}

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
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary font-heading text-lg font-bold">
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

export default function AdminProfessionalProfileReview() {
  const [items, setItems] = useState([]);
  // 2026-09-03: coada nu mai arata doar `pending_review`. Fara filtru, un profil deja aprobat sau
  // arhivat era invizibil pentru admin, deci arhivarea si reactivarea nu aveau de unde sa fie
  // pornite - exact motivul pentru care statusul `archived` a stat nefolosit in enum.
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});
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
      setItems(response.data?.profiles || []);
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

  const setDecisionNote = (profileId, value) => {
    setDecisionNotes((current) => ({ ...current, [profileId]: value }));
  };

  const decide = async (profile, action) => {
    const note = String(decisionNotes[profile.id] || "").trim();
    if (NOTE_REQUIRED_ACTIONS.has(action) && !note) {
      setMessage("");
      setError(NOTE_PROMPTS[action] || "Completează nota deciziei.");
      document.getElementById(`professional-review-note-${profile.id}`)?.focus();
      return;
    }

    setBusyId(profile.id);
    setError("");
    setMessage("");
    try {
      const response = await base44.functions.invoke("adminProfessionalProfileReview", {
        action,
        professional_id: profile.id,
        note,
      });
      if (response.data?.error) throw new Error(response.data.error);

      setMessage(DECISION_MESSAGES[action] || "Decizia a fost aplicată.");
      setDecisionNotes((current) => {
        const next = { ...current };
        delete next[profile.id];
        return next;
      });
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Decizia nu a putut fi aplicată.",
      );
    } finally {
      setBusyId("");
    }
  };

  const anyBusy = Boolean(busyId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">Profiluri de specialiști în verificare</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprobarea publică identitatea profesională și asocierile eligibile cu locațiile.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || anyBusy}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reîncarcă
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setStatusFilter(filter.key)}
            disabled={anyBusy}
            className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              statusFilter === filter.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div aria-live="polite" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {loading && (
        <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Se încarcă profilurile...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <UserRound className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nu există profiluri de specialiști în această stare.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Profilurile apar aici după ce specialistul își completează datele și le trimite spre review.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((profile) => {
          const draft = profile.draft || {};
          const locations = profile.assignments || [];
          const busy = busyId === profile.id;
          const noteId = `professional-review-note-${profile.id}`;

          return (
            <article key={profile.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <ProfilePhoto draft={draft} name={profile.full_name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">
                          {draft.public_display_name || profile.full_name}
                        </h3>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                          {TYPE_LABELS[profile.professional_type] || profile.professional_type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Identitate de cont: {profile.full_name || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Trimis: {formatDate(profile.submitted_at)} · Completitudine: {profile.profile_completeness || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Descriere profesională</div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                        {draft.professional_bio || "Descriere necompletată."}
                      </p>

                      <div className="mt-4 text-xs font-semibold text-muted-foreground">Domenii profesionale</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(draft.specializations || []).map((key) => (
                          <span key={key} className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-xs font-medium">
                            {specializationText(key) || key}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ContactItem label="Telefon" value={draft.public_phone} />
                      <ContactItem label="Email" value={draft.public_email} />
                      <ContactItem label="Website" value={draft.public_website_url} />
                      <ContactItem label="LinkedIn" value={draft.linkedin_url} />
                      <ContactItem label="Facebook" value={draft.facebook_url} />
                      <ContactItem label="Instagram" value={draft.instagram_url} />
                      {draft.accepts_independent_requests && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                          Solicită activarea cererilor independente.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="text-xs font-semibold text-muted-foreground">Locații asociate</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {locations.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl border border-border bg-secondary/30 px-3 py-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {assignment.location?.name || "Locație indisponibilă"}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresă nepublicată"}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                Asociere: {assignment.active_status === "activ" ? "activă" : "inactivă"} · locație: {assignment.location?.profile_control_status || "necunoscut"}
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
                  <label htmlFor={noteId} className="text-xs font-bold text-foreground">
                    Nota deciziei
                  </label>
                  <textarea
                    id={noteId}
                    rows={4}
                    value={decisionNotes[profile.id] || ""}
                    onChange={(event) => setDecisionNote(profile.id, event.target.value)}
                    placeholder="Scrie ce trebuie completat sau motivul respingerii. Pentru aprobare, nota este opțională."
                    className="mt-2 w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    Nota este obligatorie pentru solicitarea de completări și pentru respingere.
                  </p>

                  {/* Deciziile de review au sens doar cat draftul e in verificare. Afisate mereu,
                      ar fi promis administratorului o actiune pe care serverul o respinge cu 409. */}
                  <div className={`mt-3 grid gap-2 ${profile.profile_review_status === "pending_review" ? "" : "hidden"}`}>
                    <button
                      type="button"
                      onClick={() => decide(profile, "approve")}
                      disabled={anyBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {busy ? "Se procesează..." : "Aprobă"}
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(profile, "request_more_info")}
                      disabled={anyBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      <MessageSquareMore className="h-4 w-4" /> Cere completări
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(profile, "reject")}
                      disabled={anyBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-card px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Respinge
                    </button>
                  </div>

                  {/* Ciclul de viata al persoanei, nu doar al draftului. Arhivarea inchide pagina
                      publica si trece asocierile pe privat; reactivarea readuce profilul in lucru,
                      nu il republica - pentru asta e nevoie de o noua aprobare. */}
                  <div className="mt-3 border-t border-border pt-3">
                    {profile.public_visibility_status === "archived" ? (
                      <button
                        type="button"
                        onClick={() => decide(profile, "restore")}
                        disabled={anyBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" /> Reactivează ca draft
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => decide(profile, "archive")}
                        disabled={anyBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" /> Arhivează profilul
                      </button>
                    )}
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Arhivarea scoate profilul din căutare și din paginile publice. Nu șterge date.
                    </p>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
