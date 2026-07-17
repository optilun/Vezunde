import React, { useEffect, useState } from "react";
import { CheckCircle2, Info, MapPin, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

function ReviewCard({ item, busy, onDecision }) {
  const [note, setNote] = useState("");
  const location = item.payload?.location || {};
  const duplicates = item.payload?.duplicate_candidates || [];
  const noteId = `new-location-review-note-${item.id}`;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-bold">{location.public_display_name || "Locație nouă"}</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
              Locație nouă pentru organizație existentă
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.organization?.name || "Organizație"} · trimisă {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ro-RO") : "dată necunoscută"}
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
          În verificare
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Adresă</div>
          <div className="mt-1 break-words text-sm font-semibold">{location.address || "-"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Localitate / județ</div>
          <div className="mt-1 text-sm font-semibold">
            {location.city || "-"}{location.county ? `, ${location.county}` : ""}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Telefon</div>
          <div className="mt-1 break-all text-sm font-semibold">{location.public_phone || "-"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Email</div>
          <div className="mt-1 break-all text-sm font-semibold">{location.public_email || "-"}</div>
        </div>
      </div>

      {duplicates.length > 0 && (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-bold text-amber-900">Potriviri posibile detectate</h4>
          <div className="mt-2 space-y-2">
            {duplicates.map((candidate) => (
              <div key={candidate.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{candidate.name}</div>
                  <div className="mt-1 break-words text-muted-foreground">
                    {candidate.address}{candidate.city ? ` · ${candidate.city}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900">
                  {candidate.score}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {location.lat !== null
        && location.lat !== undefined
        && location.lng !== null
        && location.lng !== undefined && (
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
          placeholder="Scrie informațiile care lipsesc sau motivul respingerii. Pentru aprobare, nota este opțională."
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Nota este obligatorie pentru solicitarea de informații și pentru respingere.
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "approve", note)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50 sm:w-auto"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobă și asociază
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "request_more_info", note)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50 sm:w-auto"
        >
          <Info className="h-3.5 w-3.5" /> Cere informații
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(item, "reject", note)}
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
    const response = await base44.functions.invoke("providerLocationExpansionOps", {
      action: "admin_list",
    }).catch((requestError) => ({
      data: {
        error: requestError.response?.data?.error || requestError.message,
        submissions: [],
      },
    }));
    if (response.data?.error) setError(response.data.error);
    setItems(response.data?.submissions || []);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (item, action, note) => {
    const normalizedNote = String(note || "").trim();
    if ((action === "request_more_info" || action === "reject") && !normalizedNote) {
      setError(
        action === "request_more_info"
          ? "Completează nota cu informațiile care trebuie adăugate."
          : "Completează motivul respingerii.",
      );
      document.getElementById(`new-location-review-note-${item.id}`)?.focus();
      return;
    }

    setBusy(true);
    setError("");
    const response = await base44.functions.invoke("providerLocationExpansionOps", {
      action,
      submission_id: item.id,
      note: normalizedNote,
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message },
    }));
    setBusy(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    await load();
  };

  if (!items) {
    return <p className="text-sm text-muted-foreground">Se încarcă solicitările de locații...</p>;
  }

  return (
    <AdminCard className="p-4 sm:p-5">
      <div>
        <h2 className="font-heading text-base font-bold">Locații noi pentru organizații existente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Verifică datele punctului de lucru și eventualele potriviri înainte de aprobare.
        </p>
      </div>
      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      )}
      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <EmptyState
            title="Nu există solicitări noi de locații"
            description="Cererile trimise de furnizori vor apărea aici."
          />
        ) : (
          items.map((item) => (
            <ReviewCard key={item.id} item={item} busy={busy} onDecision={decide} />
          ))
        )}
      </div>
    </AdminCard>
  );
}
