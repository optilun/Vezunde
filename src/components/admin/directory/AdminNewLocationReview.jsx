import React, { useEffect, useState } from "react";
import { CheckCircle2, Info, MapPin, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

function ReviewCard({ item, busy, onDecision }) {
  const [note, setNote] = useState("");
  const location = item.payload?.location || {};
  const duplicates = item.payload?.duplicate_candidates || [];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-bold">{location.public_display_name || "Locație nouă"}</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">Locație nouă pentru organizație existentă</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.organization?.name || "Organizație"} · trimisă {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ro-RO") : "dată necunoscută"}</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">În review</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary/30 p-3"><div className="text-[11px] font-semibold text-muted-foreground">Adresă</div><div className="mt-1 text-sm font-semibold">{location.address || "-"}</div></div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3"><div className="text-[11px] font-semibold text-muted-foreground">Localitate / județ</div><div className="mt-1 text-sm font-semibold">{location.city || "-"}{location.county ? `, ${location.county}` : ""}</div></div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3"><div className="text-[11px] font-semibold text-muted-foreground">Telefon</div><div className="mt-1 text-sm font-semibold">{location.public_phone || "-"}</div></div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-3"><div className="text-[11px] font-semibold text-muted-foreground">Email</div><div className="mt-1 text-sm font-semibold">{location.public_email || "-"}</div></div>
      </div>

      {duplicates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-bold text-amber-900">Potriviri posibile detectate</div>
          <div className="mt-2 space-y-2">
            {duplicates.map((candidate) => (
              <div key={candidate.id} className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-xs">
                <div><div className="font-semibold">{candidate.name}</div><div className="mt-1 text-muted-foreground">{candidate.address}{candidate.city ? ` · ${candidate.city}` : ""}</div></div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900">{candidate.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(location.lat !== null && location.lat !== undefined && location.lng !== null && location.lng !== undefined) && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4" /> Coordonate: {location.lat}, {location.lng}</div>
      )}

      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notă admin. Obligatorie pentru respingere sau cerere de informații." rows={2} className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(item, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobă și asociază</button>
        <button disabled={busy} onClick={() => onDecision(item, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informații</button>
        <button disabled={busy} onClick={() => onDecision(item, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>
      </div>
    </div>
  );
}

export default function AdminNewLocationReview() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const res = await base44.functions.invoke("providerLocationExpansionOps", { action: "admin_list" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message, submissions: [] } }));
    if (res.data?.error) setError(res.data.error);
    setItems(res.data?.submissions || []);
  };

  useEffect(() => { load(); }, []);

  const decide = async (item, action, note) => {
    setBusy(true);
    setError("");
    const res = await base44.functions.invoke("providerLocationExpansionOps", { action, submission_id: item.id, note: note || "" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setBusy(false);
    if (res.data?.error) { setError(res.data.error); return; }
    await load();
  };

  if (!items) return <p className="text-sm text-muted-foreground">Se încarcă solicitările de locații...</p>;

  return (
    <AdminCard className="p-5">
      <div>
        <h2 className="font-heading text-base font-bold">Locații noi pentru organizații existente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Verifică datele punctului de lucru și eventualele potriviri înainte de aprobare.</p>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
      <div className="mt-5 space-y-4">
        {items.length === 0 ? <EmptyState title="Nu există solicitări noi de locații" description="Cererile trimise de furnizori vor apărea aici." /> : items.map((item) => <ReviewCard key={item.id} item={item} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
