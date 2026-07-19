import React, { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Info, Link2, MapPin, Plus, RefreshCcw, TriangleAlert, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

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
  if (relation === "same_organization") return "Deja asociata organizatiei";
  if (relation === "unassigned_directory") return "Profil neasociat din director";
  return candidate.organization_name ? `Organizatie actuala: ${candidate.organization_name}` : "Profil asociat altei organizatii";
}

function ReviewCard({ item, busy, onDecision }) {
  const [note, setNote] = useState("");
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
  const noteId = `new-location-review-note-${item.id}`;
  const selectedCandidate = duplicates.find((candidate) => candidate.id === resolution.targetId) || null;
  const selectedRelation = selectedCandidate ? candidateRelation(selectedCandidate, item.organization?.id) : null;

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

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-bold">{location.public_display_name || location.name || "Locatie"}</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
              {isExistingRequest ? "Asociere profil existent" : "Locatie noua pentru organizatie existenta"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.organization?.name || "Organizatie"} · trimisa {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ro-RO") : "la o data necunoscuta"}
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">In verificare</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Adresa</div>
          <div className="mt-1 break-words text-sm font-semibold">{location.address || "-"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Localitate / judet</div>
          <div className="mt-1 text-sm font-semibold">{location.city || "-"}{location.county ? `, ${location.county}` : ""}</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Telefon</div>
          <div className="mt-1 break-all text-sm font-semibold">{location.public_phone || location.phone || "-"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Email</div>
          <div className="mt-1 break-all text-sm font-semibold">{location.public_email || "-"}</div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-foreground/10 bg-[#f8f5ef] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card"><Link2 className="h-4 w-4" /></div>
          <div>
            <h4 className="text-sm font-bold">Rezolutia identitatii locatiei</h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Alege daca se creeaza un punct fizic separat sau se foloseste profilul deja existent. Alegerea este salvata in audit.
            </p>
          </div>
        </div>

        {!isExistingRequest && (
          <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${resolution.mode === "create_new" ? "border-foreground bg-card" : "border-border bg-card/60"}`}>
            <input
              type="radio"
              name={`resolution-${item.id}`}
              checked={resolution.mode === "create_new"}
              onChange={() => { setResolution({ mode: "create_new", targetId: "" }); setConfirmTransfer(false); }}
              className="mt-0.5"
            />
            <span>
              <span className="flex items-center gap-2 text-xs font-bold"><Plus className="h-3.5 w-3.5" /> Creeaza o locatie fizica separata</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Foloseste aceasta optiune numai daca potrivirile sunt alte puncte de lucru.</span>
            </span>
          </label>
        )}

        {duplicates.length > 0 && (
          <div className="mt-3 space-y-2">
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
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      {relation === "other_organization" ? <RefreshCcw className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                      {relation === "other_organization" ? "Transfera profilul existent" : "Foloseste profilul existent"}
                      {candidate.score !== undefined && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{candidate.score}%</span>}
                    </span>
                    <span className="mt-1 block text-xs font-semibold">{candidate.name || "Profil existent"}</span>
                    <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">{candidate.address || "Adresa indisponibila"}{candidate.city ? ` · ${candidate.city}` : ""}</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${relation === "other_organization" ? "bg-amber-100 text-amber-900" : relation === "same_organization" ? "bg-green-100 text-green-900" : "bg-blue-50 text-blue-900"}`}>
                      {candidateLabel(candidate, item.organization?.id)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {resolution.mode === "create_new" && hasStrongCandidate && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <input type="checkbox" checked={confirmSeparate} onChange={(event) => setConfirmSeparate(event.target.checked)} className="mt-0.5" />
            <span>Confirm ca este o locatie fizica diferita. Voi explica diferenta in nota deciziei.</span>
          </label>
        )}

        {resolution.mode === "transfer_existing" && selectedRelation === "other_organization" && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-950">
            <input type="checkbox" checked={confirmTransfer} onChange={(event) => setConfirmTransfer(event.target.checked)} className="mt-0.5" />
            <span>
              <b>Confirm transferul dintre organizatii.</b> Membershipurile vechii organizatii pentru aceasta locatie vor fi dezactivate, iar ownerii organizatiei destinatie vor primi acces.
            </span>
          </label>
        )}
      </section>

      {location.lat !== null && location.lat !== undefined && location.lng !== null && location.lng !== undefined && (
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-all">Coordonate: {location.lat}, {location.lng}</span>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor={noteId} className="text-xs font-bold text-foreground">Nota deciziei</label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Pentru transfer sau pentru crearea separata in prezenta unei potriviri puternice, descrie verificarea facuta."
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Nota este obligatorie pentru informatii suplimentare, respingere, transfer intre organizatii si ignorarea unei potriviri puternice.
        </p>
      </div>

      {(resolution.mode === "transfer_existing" || (resolution.mode === "create_new" && hasStrongCandidate)) && note.trim().length < 20 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Nota de verificare trebuie sa aiba cel putin 20 de caractere.
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "approve", note, resolutionPayload)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50 sm:w-auto"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Aproba rezolutia
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "request_more_info", note, resolutionPayload)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50 sm:w-auto"
        >
          <Info className="h-3.5 w-3.5" /> Cere informatii
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "reject", note, resolutionPayload)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50 sm:w-auto"
        >
          <XCircle className="h-3.5 w-3.5" /> Respinge
        </button>
      </div>
    </article>
  );
}

export default function AdminNewLocationReview() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setItems(merged);
  };

  useEffect(() => { load(); }, []);

  const decide = async (item, action, note, resolutionPayload) => {
    const normalizedNote = String(note || "").trim();
    if ((action === "request_more_info" || action === "reject") && !normalizedNote) {
      setError(action === "request_more_info" ? "Completeaza nota cu informatiile care trebuie adaugate." : "Completeaza motivul respingerii.");
      document.getElementById(`new-location-review-note-${item.id}`)?.focus();
      return;
    }

    setBusy(true);
    setError("");
    const response = await base44.functions.invoke("providerLocationIdentityResolutionOps", {
      action,
      submission_id: item.id,
      note: normalizedNote,
      ...resolutionPayload,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setBusy(false);
    if (response.data?.error) {
      setError(response.data.error);
      document.getElementById(`new-location-review-note-${item.id}`)?.focus();
      return;
    }
    await load();
  };

  if (!items) return <p className="text-sm text-muted-foreground">Se incarca solicitarile de locatii...</p>;

  return (
    <AdminCard className="p-4 sm:p-5">
      <div>
        <h2 className="font-heading text-base font-bold">Locatii si profiluri existente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Verifica identitatea punctului fizic. Poti crea o locatie separata, reutiliza un profil neasociat sau transfera controlat un profil existent.
        </p>
      </div>
      {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <EmptyState title="Nu exista solicitari noi de locatii" subtitle="Cererile trimise de furnizori vor aparea aici." />
        ) : items.map((item) => <ReviewCard key={item.id} item={item} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
