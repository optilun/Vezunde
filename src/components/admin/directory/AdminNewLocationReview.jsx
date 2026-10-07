import React, { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Info, Link2, MapPin, Plus, RefreshCcw, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminDecisionBar from "@/components/admin/ui/AdminDecisionBar";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { oldestFirst, waitingInfo } from "@/lib/adminFormat";

const DECISION_FLASH = {
  approve: "Rezoluție aprobată",
  request_more_info: "Cerere de informații trimisă",
  reject: "Cerere respinsă",
};

function candidateRelation(candidate, organizationId) {
  const candidateOrganizationId = String(candidate?.organization_id || "").trim();
  if (candidateOrganizationId && candidateOrganizationId === String(organizationId || "").trim()) return "same_organization";
  if (!candidateOrganizationId) return "unassigned_directory";
  return "other_organization";
}

function strongCandidate(candidate) {
  const reasons = Array.isArray(candidate?.reasons) ? candidate.reasons : [];
  return candidate?.confidence === "high"
    || Number(candidate?.score || 0) >= 72
    || reasons.includes("telefon identic")
    || reasons.includes("aceeasi adresa")
    || reasons.includes("aceeași adresă");
}

function candidateLabel(candidate, organizationId) {
  const relation = candidateRelation(candidate, organizationId);
  if (relation === "same_organization") return "Deja asociată organizației";
  if (relation === "unassigned_directory") return "Profil neasociat din director";
  return candidate.organization_name ? `Organizația actuală: ${candidate.organization_name}` : "Profil asociat altei organizații";
}

const RELATION_TONES = { same_organization: "success", unassigned_directory: "info", other_organization: "warning" };

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children || "—"}</dd>
    </div>
  );
}

function ReviewCard({ item, busy, onDecision }) {
  const [resolution, setResolution] = useState(() => {
    if (item.payload?.kind === "associate_existing_location") {
      const candidate = item.payload?.candidate || {};
      const relation = candidateRelation(candidate, item.organization?.id);
      return {
        mode: relation === "other_organization" ? "transfer_existing" : "use_existing",
        targetId: candidate.id || item.payload?.target_location_id || "",
      };
    }
    return { mode: "create_new", targetId: "" };
  });
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [confirmSeparate, setConfirmSeparate] = useState(false);
  const isExistingRequest = item.payload?.kind === "associate_existing_location" || item.item_key === "existing_location";
  const location = isExistingRequest ? item.payload?.candidate || {} : item.payload?.location || {};
  const duplicates = useMemo(() => {
    if (isExistingRequest) return item.payload?.candidate ? [item.payload.candidate] : [];
    return item.payload?.duplicate_candidates || [];
  }, [isExistingRequest, item.payload]);
  const hasStrongCandidate = duplicates.some(strongCandidate);
  const selectedCandidate = duplicates.find((candidate) => candidate.id === resolution.targetId) || null;
  const selectedRelation = selectedCandidate ? candidateRelation(selectedCandidate, item.organization?.id) : null;
  const needsConfirmedTransfer = resolution.mode === "transfer_existing" && selectedRelation === "other_organization";
  const needsConfirmedSeparate = resolution.mode === "create_new" && hasStrongCandidate;
  const approvalNoteRequired = resolution.mode === "transfer_existing" || needsConfirmedSeparate;
  const waiting = waitingInfo(item.submitted_at);
  const hasCoordinates = location.lat !== null && location.lat !== undefined && location.lng !== null && location.lng !== undefined;

  const selectCandidate = (candidate) => {
    const relation = candidateRelation(candidate, item.organization?.id);
    setResolution({
      mode: relation === "other_organization" ? "transfer_existing" : "use_existing",
      targetId: candidate.id,
    });
    setConfirmTransfer(false);
    setConfirmSeparate(false);
  };

  const resolutionPayload = {
    resolution_mode: resolution.mode,
    target_location_id: resolution.targetId,
    confirm_cross_organization_transfer: confirmTransfer,
    confirm_separate_location: confirmSeparate,
  };

  // Aceleași reguli ca la server, dar afișate înainte de apel, chiar sub butoane.
  const validate = (action) => {
    if (action !== "approve") return null;
    if ((resolution.mode === "use_existing" || resolution.mode === "transfer_existing") && !resolution.targetId) return "Alege profilul existent.";
    if (needsConfirmedTransfer && !confirmTransfer) return "Bifează confirmarea transferului între organizații.";
    if (needsConfirmedSeparate && !confirmSeparate) return "Bifează confirmarea că este o locație fizică diferită.";
    return null;
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-bold">{location.public_display_name || location.name || "Locație"}</h3>
            <StatusBadge label={isExistingRequest ? "Asociere profil existent" : "Locație nouă pentru organizație existentă"} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.organization?.name || "Organizație"}</p>
        </div>
        {waiting && <StatusBadge label={`Trimisă ${waiting.label}`} tone={waiting.tone} className="self-start" />}
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 rounded-xl border border-border bg-secondary/30 p-3 sm:grid-cols-2">
        <Detail label="Adresă">{location.address}</Detail>
        <Detail label="Localitate / județ">{[location.city, location.county].filter(Boolean).join(", ")}</Detail>
        <Detail label="Telefon">{location.public_phone || location.phone}</Detail>
        <Detail label="Email">{location.public_email}</Detail>
      </dl>
      {hasCoordinates && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="break-all">Coordonate: {location.lat}, {location.lng}</span>
        </p>
      )}

      <fieldset className="mt-4 rounded-2xl border border-border bg-secondary/20 p-3 sm:p-4">
        <legend className="sr-only">Cum se rezolvă identitatea locației</legend>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h4 className="text-sm font-bold" aria-hidden="true">Cum se rezolvă identitatea locației?</h4>
          <AdminHint label="Despre rezoluția identității">
            Alege dacă se creează un punct fizic separat sau se folosește un profil deja existent. Alegerea rămâne în istoric.
          </AdminHint>
        </div>

        {!isExistingRequest && (
          <label className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${resolution.mode === "create_new" ? "border-foreground bg-card" : "border-border bg-card/60"}`}>
            <input
              type="radio"
              name={`resolution-${item.id}`}
              checked={resolution.mode === "create_new"}
              onChange={() => { setResolution({ mode: "create_new", targetId: "" }); setConfirmTransfer(false); }}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              <span className="flex items-center gap-2 text-xs font-bold"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Creează o locație fizică separată</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Doar dacă potrivirile sunt alte puncte de lucru.</span>
            </span>
          </label>
        )}

        {duplicates.length > 0 && (
          <div className="mt-2 space-y-2">
            {duplicates.map((candidate) => {
              const relation = candidateRelation(candidate, item.organization?.id);
              const mode = relation === "other_organization" ? "transfer_existing" : "use_existing";
              const checked = resolution.mode === mode && resolution.targetId === candidate.id;
              return (
                <label key={candidate.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? "border-foreground bg-card" : "border-border bg-card/60"}`}>
                  <input
                    type="radio"
                    name={`resolution-${item.id}`}
                    checked={checked}
                    onChange={() => selectCandidate(candidate)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      {relation === "other_organization" ? <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {relation === "other_organization" ? "Transferă profilul existent" : "Folosește profilul existent"}
                      {candidate.score !== undefined && <StatusBadge label={`${candidate.score}% potrivire`} />}
                    </span>
                    <span className="mt-1 block text-xs font-semibold">{candidate.name || "Profil existent"}</span>
                    <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">{candidate.address || "Adresă indisponibilă"}{candidate.city ? ` · ${candidate.city}` : ""}</span>
                    <StatusBadge label={candidateLabel(candidate, item.organization?.id)} tone={RELATION_TONES[relation]} className="mt-2" />
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {needsConfirmedSeparate && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-warning-border bg-warning-soft p-3 text-xs text-warning">
            <input type="checkbox" checked={confirmSeparate} onChange={(event) => setConfirmSeparate(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Confirm că este o locație fizică diferită. Explic diferența în notă.</span>
          </label>
        )}

        {needsConfirmedTransfer && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-danger-border bg-danger-soft p-3 text-xs text-danger">
            <input type="checkbox" checked={confirmTransfer} onChange={(event) => setConfirmTransfer(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Confirm transferul între organizații.</b> Membrii vechii organizații pentru această locație sunt dezactivați, iar proprietarii cu acces la toată organizația destinatară primesc acces. Profilul devine revendicat: o verificare anterioară nu se păstrează, iar starea de publicare rămâne neschimbată.
            </span>
          </label>
        )}
      </fieldset>

      <AdminDecisionBar
        className="mt-4"
        busy={busy}
        validate={validate}
        onDecide={(action, note) => onDecision(item, action, note, resolutionPayload)}
        actions={[
          {
            key: "approve",
            label: "Aprobă rezoluția",
            icon: CheckCircle2,
            tone: "primary",
            note: approvalNoteRequired ? "required" : "optional",
            minNote: approvalNoteRequired ? 20 : undefined,
            noteLabel: "Verificarea făcută",
            notePlaceholder: "Descrie verificarea (minim 20 de caractere). Rămâne în istoric.",
            confirmLabel: "Aprobă rezoluția",
          },
          { key: "request_more_info", label: "Cere informații", icon: Info, note: "required", noteLabel: "Ce informații lipsesc?", notePlaceholder: "Furnizorul vede acest mesaj.", noteRequiredMessage: "Scrie ce informații trebuie completate.", confirmLabel: "Trimite cererea" },
          { key: "reject", label: "Respinge", icon: XCircle, tone: "danger", note: "required", noteLabel: "Motivul respingerii", notePlaceholder: "Furnizorul vede acest motiv.", noteRequiredMessage: "Scrie motivul respingerii.", confirmLabel: "Respinge cererea" },
        ]}
      />
    </article>
  );
}

export default function AdminNewLocationReview() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = async () => {
    setError("");
    const [newLocationsResponse, existingLocationsResponse] = await Promise.all([
      base44.functions.invoke("providerLocationExpansionOps", { action: "admin_list" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.functions.invoke("providerLocationIdentityResolutionOps", { action: "admin_list" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
    ]);
    const errors = [newLocationsResponse.data?.error, existingLocationsResponse.data?.error].filter(Boolean);
    if (errors.length) setError(errors.join(" "));
    const merged = [
      ...(newLocationsResponse.data?.submissions || []).map((item) => ({ ...item, item_key: item.item_key || "new_location" })),
      ...(existingLocationsResponse.data?.submissions || []),
    ].filter((item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index);
    setItems(oldestFirst(merged, (item) => item.submitted_at || item.created_date));
  };

  useEffect(() => { load(); }, []);

  // Aruncă la eroare (mesajul apare sub butoanele cardului). După reușită, cardul dispare imediat.
  const decide = async (item, action, note, resolutionPayload) => {
    setBusy(true);
    try {
      const response = await base44.functions.invoke("providerLocationIdentityResolutionOps", {
        action,
        submission_id: item.id,
        note: String(note || "").trim(),
        ...resolutionPayload,
      });
      if (response.data?.error) throw new Error(response.data.error);
    } finally {
      setBusy(false);
    }
    const remaining = Math.max(0, (items?.length || 1) - 1);
    setItems((current) => (current || []).filter((entry) => entry.id !== item.id));
    setFlash(`${DECISION_FLASH[action] || "Decizie aplicată"}. ${remaining === 0 ? "Coada e goală." : `Mai ${remaining === 1 ? "e 1" : `sunt ${remaining}`} în coadă.`}`);
    refreshCounts();
    load().catch(() => {});
  };

  if (!items) return <AdminLoading label="Se încarcă solicitările de locații…" />;

  return (
    <AdminCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="font-heading text-base font-bold">Locații și profiluri existente</h2>
          <AdminHint label="Ce se verifică aici">
            Verifică identitatea punctului fizic. Poți crea o locație separată, reutiliza un profil neasociat sau transfera controlat un profil existent.
          </AdminHint>
        </div>
        <StatusBadge label={`${items.length} în așteptare`} />
      </div>
      {error && <AdminNotice tone="danger" className="mt-4">{error}</AdminNotice>}
      {flash && <AdminNotice tone="success" className="mt-4" onDismiss={() => setFlash("")}>{flash}</AdminNotice>}
      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <EmptyState title="Nu există solicitări noi de locații." subtitle="Cererile trimise de furnizori vor apărea aici." />
        ) : items.map((item) => <ReviewCard key={item.id} item={item} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
