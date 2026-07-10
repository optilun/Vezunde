import React, { useEffect, useState } from "react";
import { CheckCircle2, MapPin, MessageSquareMore, RefreshCw, UserRound, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TYPE_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

const SPECIALIZATION_LABELS = {
  general_ophthalmology: "Oftalmologie generală",
  pediatric_ophthalmology: "Oftalmologie pediatrică",
  glaucoma: "Glaucom",
  retina: "Retină",
  cornea: "Cornee",
  cataract: "Cataractă",
  refractive_surgery: "Chirurgie refractivă",
  dry_eye: "Ochi uscat",
  myopia_management: "Managementul miopiei",
  refraction: "Refracție și determinarea dioptriilor",
  contact_lenses: "Lentile de contact",
  pediatric_optometry: "Optometrie pediatrică",
  binocular_vision: "Vedere binoculară",
  low_vision: "Vedere slabă",
  occupational_vision: "Vedere ocupațională",
  frame_consulting: "Consiliere rame",
  ophthalmic_lenses: "Lentile oftalmice",
  progressive_lenses: "Lentile progresive",
  lens_fitting: "Montaj lentile",
  adjustments_repairs: "Reglaje și reparații",
  children_eyewear: "Ochelari pentru copii",
  protective_eyewear: "Ochelari de protecție",
};

function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("ro-RO"); } catch (_error) { return value; }
}

function initials(value) {
  return String(value || "S").split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function ProfilePhoto({ draft, name }) {
  if (draft.profile_photo_url) {
    return <img src={draft.profile_photo_url} alt={`Fotografie ${draft.public_display_name || name}`} className="h-16 w-16 rounded-2xl border border-border object-cover" />;
  }
  return <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary font-heading text-lg font-bold">{initials(draft.public_display_name || name)}</div>;
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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminProfessionalProfileReview", { action: "list", status: "pending_review" });
      setItems(response.data?.profiles || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut încărca profilurile profesionale.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (profile, action) => {
    let note = "";
    if (action === "request_more_info") {
      note = window.prompt("Ce informații trebuie completate?") || "";
      if (!note.trim()) return;
    }
    if (action === "reject") {
      note = window.prompt("Motivul respingerii") || "";
      if (!note.trim()) return;
    }
    if (action === "approve") {
      note = window.prompt("Notă internă opțională pentru aprobare") || "";
    }

    setBusyId(profile.id);
    setError("");
    setMessage("");
    try {
      await base44.functions.invoke("adminProfessionalProfileReview", {
        action,
        professional_id: profile.id,
        note,
      });
      setMessage(action === "approve" ? "Profilul specialistului a fost aprobat și publicat." : action === "request_more_info" ? "Au fost solicitate completări." : "Profilul a fost respins.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Decizia nu a putut fi aplicată.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">Profiluri de specialiști în verificare</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aprobarea publică identitatea profesională și asocierile eligibile cu locațiile.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reîncarcă
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {message && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      {loading && <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Se încarcă profilurile...</div>}

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <UserRound className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nu există profiluri de specialiști în verificare.</p>
          <p className="mt-1 text-xs text-muted-foreground">Profilurile apar aici după ce specialistul își completează datele și le trimite spre review.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((profile) => {
          const draft = profile.draft || {};
          const locations = profile.assignments || [];
          const busy = busyId === profile.id;
          return (
            <article key={profile.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <ProfilePhoto draft={draft} name={profile.full_name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">{draft.public_display_name || profile.full_name}</h3>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{TYPE_LABELS[profile.professional_type] || profile.professional_type}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Identitate de cont: {profile.full_name || "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Trimis: {formatDate(profile.submitted_at)} · Completitudine: {profile.profile_completeness || 0}%</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Descriere profesională</div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{draft.professional_bio || "Descriere necompletată."}</p>

                      <div className="mt-4 text-xs font-semibold text-muted-foreground">Domenii profesionale</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(draft.specializations || []).map((key) => <span key={key} className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-xs font-medium">{SPECIALIZATION_LABELS[key] || key}</span>)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ContactItem label="Telefon" value={draft.public_phone} />
                      <ContactItem label="Email" value={draft.public_email} />
                      <ContactItem label="Website" value={draft.public_website_url} />
                      <ContactItem label="LinkedIn" value={draft.linkedin_url} />
                      <ContactItem label="Facebook" value={draft.facebook_url} />
                      <ContactItem label="Instagram" value={draft.instagram_url} />
                      {draft.accepts_independent_requests && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Solicită activarea cererilor independente.</div>}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="text-xs font-semibold text-muted-foreground">Locații asociate</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {locations.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl border border-border bg-secondary/30 px-3 py-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-semibold">{assignment.location?.name || "Locație indisponibilă"}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresă nepublicată"}</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">Asociere: {assignment.active_status === "activ" ? "activă" : "inactivă"} · locație: {assignment.location?.profile_control_status || "necunoscut"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {locations.length === 0 && <p className="text-sm text-muted-foreground">Nu există nicio locație asociată.</p>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 xl:w-48 xl:flex-col">
                  <button onClick={() => decide(profile, "approve")} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> Aprobă
                  </button>
                  <button onClick={() => decide(profile, "request_more_info")} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
                    <MessageSquareMore className="h-4 w-4" /> Cere completări
                  </button>
                  <button onClick={() => decide(profile, "reject")} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    <XCircle className="h-4 w-4" /> Respinge
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
