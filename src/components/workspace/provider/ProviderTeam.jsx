import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Trash2, UserPlus, Send, Eye, EyeOff, Clock3, Stethoscope, X } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";
import LocationEditorSteps from "./LocationEditorSteps";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40";

// 2026-09-03: lista de profesii vine din shared/professionalIdentity.js. Era rescrisa aici, in
// ProviderProfile, in AdminProfessionalProfileReview si in inca trei locuri.
const PROFESSIONAL_TYPES = PROFESSIONAL_TYPE_LABELS;

const INVITE_STATUS_LABELS = {
  pending: "În așteptare",
  accepted: "Acceptată",
  expired: "Expirată",
  revoked: "Revocată",
  declined: "Refuzată",
};

function roleLabel(key) {
  return PROFESSIONAL_TYPES[key] || key;
}

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("ro-RO"); } catch { return ""; }
}

function assignmentStatus(item) {
  if (item.active_status === "inactiv") return { label: "Eliminat", className: "bg-red-50 text-red-700" };
  if (item.public_status === "public" && item.visibility_consent_status === "accepted" && item.is_public && item.verification_status === "verified") {
    return { label: "Public", className: "bg-green-100 text-green-800" };
  }
  if (item.visibility_consent_status === "pending") return { label: "Așteaptă acordul", className: "bg-blue-50 text-blue-800" };
  if (item.visibility_consent_status === "declined") return { label: "Afișare refuzată", className: "bg-amber-50 text-amber-800" };
  if (item.visibility_consent_status === "revoked") return { label: "Acord retras", className: "bg-amber-50 text-amber-800" };
  if (item.profile_review_status === "pending_review") return { label: "În verificare", className: "bg-amber-50 text-amber-800" };
  if (item.profile_review_status === "needs_more_info") return { label: "Necesită completări", className: "bg-amber-50 text-amber-800" };
  return { label: "Privat", className: "bg-secondary text-muted-foreground" };
}

function EmptyCard({ children }) {
  return <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center text-xs text-muted-foreground">{children}</p>;
}

export default function ProviderTeam({ locationId }) {
  const [step, setStep] = useState("team");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [publicTeam, setPublicTeam] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState({ email: "", professional_type: "optometrist" });
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [currentProfessional, setCurrentProfessional] = useState(null);
  // Rezultatul unei invitații apare în cardul „Invită un specialist”; pe ecrane înguste cardul e
  // deasupra listei, așa că după „Trimite din nou” îl aducem în vizor.
  const inviteResultRef = useRef(null);
  const operationRef = useRef(false);

  // 2026-10-03 (structura conturilor, pasul 2): cererile „Lucrez aici” trimise de specialisti apar
  // separat, cu Aprobă / Refuză. Cererile refuzate sau anulate nu mai apar in lista.
  const associationRequests = useMemo(() => assignments.filter((item) => item.is_association_request), [assignments]);
  const listedAssignments = useMemo(() => assignments.filter((item) => !item.is_association_request
    && !(item.association_origin === "professional_request" && item.active_status !== "activ" && ["declined", "withdrawn"].includes(item.association_request_status))), [assignments]);
  const selfAssociated = Boolean(currentProfessional && assignments.some((item) => item.professional_id === currentProfessional.id && item.active_status === "activ"));
  const activeAssignments = useMemo(() => assignments.filter((item) => item.active_status === "activ"), [assignments]);
  const pendingInvitations = useMemo(() => invitations.filter((item) => item.status === "pending"), [invitations]);
  // 2026-10-04 (audit #19): invitațiile încheiate (expirate, acceptate, revocate) stau într-un
  // istoric pliat; cele expirate pot fi trimise din nou.
  const pastInvitations = useMemo(() => invitations.filter((item) => item.status !== "pending"), [invitations]);
  const pendingVisibility = useMemo(() => assignments.filter((item) => item.active_status === "activ" && item.visibility_consent_status === "pending"), [assignments]);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setLoadError("");
    const [publicRes, inviteRes, assignmentRes] = await Promise.all([
      base44.functions.invoke("getPublicProviderContent", { location_id: locationId }).catch((error) => ({ data: { team: [], error: error.response?.data?.error || error.message } })),
      base44.functions.invoke("professionalInvitationOps", { action: "list", location_id: locationId }).catch((error) => ({ data: { invitations: [], error: error.response?.data?.error || error.message } })),
      base44.functions.invoke("manageProfessionalAssignment", { action: "list", location_id: locationId }).catch((error) => ({ data: { assignments: [], error: error.response?.data?.error || error.message } })),
    ]);
    setPublicTeam(publicRes.data?.team || []);
    setInvitations(inviteRes.data?.invitations || []);
    setAssignments(assignmentRes.data?.assignments || []);
    setCurrentProfessional(assignmentRes.data?.current_user_professional || null);
    setLoading(false);
    if (inviteRes.data?.error || assignmentRes.data?.error || publicRes.data?.error) setLoadError(inviteRes.data?.error || assignmentRes.data?.error || publicRes.data?.error);
  };

  useEffect(() => {
    setNewLink("");
    setCopied(false);
    setMsg("");
    setForm({ email: "", professional_type: "optometrist" });
    setStep("team");
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se reincarca doar la schimbarea locatiei
  }, [locationId]);

  const createInvitation = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("Introdu un email valid.");
      return;
    }

    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    setNewLink("");
    setCopied(false);

    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "create",
      location_id: locationId,
      invited_email: email,
      professional_type: form.professional_type,
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));

    operationRef.current = false;
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }

    setForm({ email: "", professional_type: "optometrist" });
    setNewLink(response.data?.invitation_link || "");
    setMsg(response.data?.email_sent ? "Invitația a fost trimisă." : "Invitația a fost creată. Trimite specialistului linkul afișat mai jos.");
    await load();
  };

  const resendInvitation = async (invitationId) => {
    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    setNewLink("");
    setCopied(false);
    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "resend",
      invitation_id: invitationId,
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setNewLink(response.data?.invitation_link || "");
    setMsg(response.data?.email_sent ? "Invitația a fost trimisă din nou." : "Invitația nouă a fost creată. Trimite specialistului linkul afișat mai sus.");
    await load();
    requestAnimationFrame(() => inviteResultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const revokeInvitation = async (invitationId) => {
    const confirmed = window.confirm("Revoci această invitație?");
    if (!confirmed) return;

    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "revoke",
      invitation_id: invitationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Invitația a fost revocată.");
    await load();
  };

  const deactivateAssignment = async (professionalId) => {
    const confirmed = window.confirm("Elimini acest specialist din locație? Profilul profesional nu va fi șters.");
    if (!confirmed) return;

    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "deactivate",
      location_id: locationId,
      professional_id: professionalId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Asocierea specialistului cu această locație a fost eliminată.");
    await load();
  };

  const changeAssignmentVisibility = async (assignment, nextAction) => {
    const requesting = nextAction === "request_visibility";
    const confirmed = window.confirm(requesting
      ? "Trimiți specialistului solicitarea de a apărea public la această locație? Publicarea se face numai după acordul lui."
      : "Ascunzi specialistul de pe profilul public? O republicare va necesita un nou acord al specialistului.");
    if (!confirmed) return;

    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: requesting ? "request_visibility" : "set_visibility",
      location_id: locationId,
      professional_id: assignment.professional_id,
      ...(requesting ? {} : { public_status: "privat" }),
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg(requesting
      ? "Solicitarea a fost înregistrată. Specialistul trebuie să accepte afișarea din contul său."
      : "Specialistul a fost ascuns. O nouă afișare va necesita acordul lui.");
    await load();
  };

  const decideAssociation = async (assignment, action) => {
    const approving = action === "approve_association";
    const confirmed = window.confirm(approving
      ? `Aprobi asocierea lui ${assignment.full_name} cu această locație? Nu primește acces la contul organizației.`
      : `Refuzi cererea lui ${assignment.full_name}?`);
    if (!confirmed) return;
    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action,
      location_id: locationId,
      professional_id: assignment.professional_id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg(approving
      ? (response.data?.public_status === "public" ? "Cererea a fost aprobată. Specialistul apare public la această locație." : "Cererea a fost aprobată. Specialistul apare public după ce profilul lui este verificat.")
      : "Cererea a fost refuzată.");
    await load();
  };

  const addSelf = async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "add_self",
      location_id: locationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    operationRef.current = false;
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg(response.data?.public_status === "public"
      ? "Apari acum ca specialist la această locație."
      : "Ești asociat ca specialist. Apari public după ce profilul tău profesional este verificat și locația e publicată.");
    await load();
  };

  const copyLink = async () => {
    if (!newLink) return;
    try { await navigator.clipboard.writeText(newLink); setCopied(true); }
    catch { setMsg("Linkul nu a putut fi copiat. Selectează și copiază manual linkul de mai jos."); }
  };

  return (
    <div className="location-editor team-editor">
      <LocationEditorSteps label="Gestionarea specialiștilor" active={step} onChange={setStep} disabled={saving} steps={[
        {id:"team",label:"Specialiști",detail:activeAssignments.length + " asociați activi"},
        {id:"invite",label:"Invită un specialist",detail:pendingInvitations.length + (pendingInvitations.length === 1 ? " invitație în așteptare" : " invitații în așteptare")},
        {id:"requests",label:"Cereri și acorduri",detail:associationRequests.length + (associationRequests.length === 1 ? " cerere de asociere" : " cereri de asociere")},
      ]} />
      <div className="team-editor-summary">
        <div><span>Asociați activi</span><strong>{activeAssignments.length}</strong></div>
        <div><span>Vizibili public</span><strong>{publicTeam.length}</strong></div>
        <div><span>Acord în așteptare</span><strong>{pendingVisibility.length}</strong></div>
      </div>
      {msg && <p role="status" className="location-editor-notice">{msg}</p>}
      {loadError && <div className="location-editor-notice" role="alert">{loadError} <button type="button" onClick={load} disabled={loading} className="location-editor-button ml-2">Reîncearcă încărcarea</button></div>}
      {loading && <p role="status" className="location-editor-notice">Se încarcă specialiștii…</p>}
      {!loading && <div className={`team-editor-layout team-editor-layout--${step}`}>
      <div className="team-editor-list" hidden={step === "requests" && associationRequests.length === 0}>
        {associationRequests.length > 0 && (
          <section hidden={step !== "requests"} className="location-editor-panel">
            <div className="mb-3">
              <h2 className="text-sm font-bold">Cereri „Lucrez aici”</h2>
              <p className="mt-1 text-xs text-muted-foreground">Specialiști care spun că lucrează la această locație. Aprobă doar dacă știi că e adevărat. Aprobarea nu dă acces la contul organizației.</p>
            </div>
            <ul className="space-y-2">
              {associationRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold">{request.full_name}</div>
                    <div className="mt-0.5 text-muted-foreground">{roleLabel(request.professional_type)}{request.association_requested_at ? ` · cerere din ${formatDate(request.association_requested_at)}` : ""}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={saving} onClick={() => decideAssociation(request, "approve_association")} className="inline-flex items-center gap-1 rounded-full border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> Aprobă
                    </button>
                    <button type="button" disabled={saving} onClick={() => decideAssociation(request, "decline_association")} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                      <X className="h-3.5 w-3.5" /> Refuză
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section hidden={step !== "team"} className="location-editor-panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Specialiști asociați</h2>
              <p className="mt-1 text-xs text-muted-foreground">Poți solicita afișarea sau poți ascunde asocierea. Specialistul decide dacă profilul său devine public la această locație.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{activeAssignments.length} activi · {publicTeam.length} publici</span>
          </div>

          {listedAssignments.length === 0 ? <EmptyCard>Nu există specialiști asociați acestei locații.</EmptyCard> : (
            <ul className="space-y-2">
              {listedAssignments.map((assignment) => {
                const status = assignmentStatus(assignment);
                const isPublic = assignment.public_status === "public";
                const isPending = assignment.visibility_consent_status === "pending";
                return (
                  <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-3 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold">{assignment.full_name}</div>
                      <div className="mt-0.5 text-muted-foreground">{roleLabel(assignment.professional_type)}</div>
                      {assignment.active_status === "activ" && !isPublic && !isPending && !assignment.can_publish && assignment.publish_block_reason && (
                        <div className="mt-1 max-w-xl text-[11px] leading-relaxed text-amber-700">{assignment.publish_block_reason}</div>
                      )}
                      {isPending && <div className="mt-1 max-w-xl text-[11px] leading-relaxed text-blue-700">Așteptăm decizia specialistului. Până atunci asocierea rămâne privată.</div>}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      {assignment.active_status === "activ" && (
                        <>
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                              <Clock3 className="h-3.5 w-3.5" /> În așteptare
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={saving || (!isPublic && !assignment.can_publish)}
                              title={!isPublic && !assignment.can_publish ? assignment.publish_block_reason : ""}
                              onClick={() => changeAssignmentVisibility(assignment, isPublic ? "hide" : "request_visibility")}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {isPublic ? "Ascunde" : "Solicită afișarea"}
                            </button>
                          )}
                          <button type="button" disabled={saving} onClick={() => deactivateAssignment(assignment.professional_id)} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 className="h-3.5 w-3.5" /> Elimină
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section hidden={step !== "invite"} className="location-editor-panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Invitații profesionale</h2>
              <p className="mt-1 text-xs text-muted-foreground">Invitațiile expiră automat și pot fi revocate înainte de acceptare.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{pendingInvitations.length} în așteptare</span>
          </div>

          {invitations.length === 0 ? <EmptyCard>Nu există invitații pentru această locație.</EmptyCard> : pendingInvitations.length === 0 ? <EmptyCard>Nicio invitație în așteptare.</EmptyCard> : (
            <ul className="space-y-2">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold">{roleLabel(invitation.professional_type)}</div>
                    <div className="break-all text-muted-foreground">{invitation.invited_email_masked}</div>
                    {invitation.expires_at && invitation.status === "pending" && <div className="mt-0.5 text-[11px] text-muted-foreground">Expiră la {formatDate(invitation.expires_at)}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[invitation.status] || invitation.status}</span>
                    {invitation.status === "pending" && (
                      <button type="button" disabled={saving} onClick={() => revokeInvitation(invitation.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> Revocă
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pastInvitations.length > 0 && (
            <details className="group mt-3 rounded-2xl border border-border/70 px-3 py-2">
              <summary className="cursor-pointer list-none py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                Istoric invitații ({pastInvitations.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {pastInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold">{roleLabel(invitation.professional_type)}</div>
                      <div className="break-all text-muted-foreground">{invitation.invited_email_masked}</div>
                      {invitation.status === "expired" && invitation.expires_at && <div className="mt-0.5 text-[11px] text-muted-foreground">A expirat la {formatDate(invitation.expires_at)}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[invitation.status] || invitation.status}</span>
                      {invitation.status === "expired" && (
                        <button type="button" disabled={saving} onClick={() => resendInvitation(invitation.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                          <Send className="h-3.5 w-3.5" /> Trimite din nou
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <aside hidden={step === "requests"} className="space-y-4">
        {/* 2026-10-03 (structura conturilor, pasul 2): ownerul/managerul care e si specialist se
            afiseaza singur, fara sa-si trimita invitatie pe email. */}
        {!selfAssociated && (
          <section hidden={step !== "team"} className="location-editor-panel">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Stethoscope className="h-4 w-4" /></div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">Lucrezi și tu aici ca specialist?</h2>
                {currentProfessional ? (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Apari la această locație ca {currentProfessional.professional_type_label || "specialist"}, cu profilul tău profesional. Public doar după ce profilul e verificat de VIASEE.</p>
                    <button type="button" disabled={saving} onClick={addSelf} className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                      <Stethoscope className="h-3.5 w-3.5" /> Afișează-mă ca specialist
                    </button>
                  </>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Creează-ți mai întâi <Link to="/profil-profesional/nou" className="font-semibold underline">profilul profesional</Link>, apoi te poți afișa aici dintr-un clic.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        <section hidden={step !== "invite"} className="location-editor-panel team-editor-form">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Invită un specialist</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Completează emailul și profesia. Specialistul primește invitația și o acceptă din propriul cont.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor={`invite-email-${locationId}`} className="text-xs font-semibold text-muted-foreground">Email specialist</label>
              <input id={`invite-email-${locationId}`} type="email" autoComplete="email" disabled={saving} className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <label htmlFor={`invite-type-${locationId}`} className="text-xs font-semibold text-muted-foreground">Tip profesional</label>
              <select id={`invite-type-${locationId}`} disabled={saving} className={`${inputCls} mt-1.5`} value={form.professional_type} onChange={(event) => setForm({ ...form, professional_type: event.target.value })}>
                {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>

          <button type="button" disabled={saving || !form.email.trim()} onClick={createInvitation} className="location-editor-button location-editor-button--primary w-full">
            <Send className="h-4 w-4" /> {saving ? "Se creează invitația…" : "Trimite invitația"}
          </button>

          <div ref={inviteResultRef} />
          {newLink && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3">
              <div className="text-xs font-bold text-green-900">Linkul este afișat o singură dată</div>
              <p className="mt-1 break-all text-xs leading-relaxed text-green-900/80">{newLink}</p>
              <button type="button" onClick={copyLink} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-900">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiat" : "Copiază linkul"}
              </button>
            </div>
          )}



          <div className="mt-4 rounded-2xl border border-border bg-secondary/25 p-3">
            <div className="text-[11px] font-bold text-foreground">Separat de Acces și utilizatori</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Invitația nu acordă acces administrativ și nu publică automat profilul. Organizația poate solicita afișarea, iar specialistul decide din contul său dacă acceptă.</p>
          </div>
        </section>
      </aside>
      {step === "requests" && <section className="location-editor-panel" aria-label="Acorduri de afișare">
        <h2>Acorduri de afișare publică</h2>
        <p className="location-editor-intro">Asocierea și afișarea publică sunt separate. Specialistul își dă acordul din contul său.</p>
        {pendingVisibility.length ? <ul className="mt-4 space-y-3">{pendingVisibility.map(item => <li key={item.id} className="rounded-lg border border-border p-3"><strong className="text-sm">{item.full_name}</strong><p className="location-editor-intro">{roleLabel(item.professional_type)} · Așteaptă acordul specialistului</p></li>)}</ul> : <p className="location-editor-notice mt-4">Nu există acorduri în așteptare.</p>}
        {!associationRequests.length && <p className="location-editor-intro mt-4">Nu există cereri „Lucrez aici” de analizat.</p>}
      </section>}
      </div>}
    </div>
  );
}