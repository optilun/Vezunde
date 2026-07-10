import React, { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, Info, Loader2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

function PhotoBox({ title, photoUrl, emptyText }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-3 py-2 text-xs font-bold">{title}</div>
      <div className="aspect-video border-t border-border bg-secondary/35">
        {photoUrl ? (
          <img src={photoUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
            <ImagePlus className="h-7 w-7" />
            <p className="mt-2 text-xs">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ item, busy, onDecision }) {
  const [note, setNote] = useState("");
  return (
    <article className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">{item.location?.name || "Locație"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.location?.city || "Localitate necompletată"} · trimisă {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ro-RO") : "dată necunoscută"}
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">În verificare</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PhotoBox title="Fotografie publicată acum" photoUrl={item.location?.current_photo_url} emptyText="Nu există fotografie publicată" />
        <PhotoBox title={item.remove_photo ? "Eliminare propusă" : "Fotografie propusă"} photoUrl={item.remove_photo ? "" : item.proposed_photo_url} emptyText={item.remove_photo ? "Fotografia actuală va fi eliminată" : "Previzualizarea nu este disponibilă"} />
      </div>

      {item.remove_photo && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Furnizorul solicită eliminarea fotografiei principale. Profilul va rămâne fără fotografie după aprobare.
        </div>
      )}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="Notă admin. Obligatorie pentru completări sau respingere."
        className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(item.id, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50">
          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobă
        </button>
        <button disabled={busy} onClick={() => onDecision(item.id, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50">
          <Info className="h-3.5 w-3.5" /> Cere completări
        </button>
        <button disabled={busy} onClick={() => onDecision(item.id, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50">
          <XCircle className="h-3.5 w-3.5" /> Respinge
        </button>
      </div>
    </article>
  );
}

export default function AdminLocationPhotoReview() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const response = await base44.functions.invoke("locationPhotoOps", { action: "admin_list" }).catch((reason) => ({ data: { error: reason.response?.data?.error || reason.message, submissions: [] } }));
    if (response.data?.error) setError(response.data.error);
    setItems(response.data?.submissions || []);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (submissionId, action, note) => {
    setBusy(true);
    setError("");
    const response = await base44.functions.invoke("locationPhotoOps", {
      action,
      submission_id: submissionId,
      note: note || "",
    }).catch((reason) => ({ data: { error: reason.response?.data?.error || reason.message } }));
    setBusy(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    await load();
  };

  if (!items) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă fotografiile...</div>;

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-bold">Fotografii de locație în verificare</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aprobă o singură fotografie principală reală pentru fiecare locație. Fotografia existentă rămâne publică până la decizie.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{items.length} în așteptare</span>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <EmptyState icon={ImagePlus} title="Nicio fotografie în verificare" description="Fotografiile trimise de furnizori vor apărea aici." />
        ) : items.map((item) => <ReviewCard key={item.id} item={item} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
