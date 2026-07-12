import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  DatabaseZap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const TYPE_LABELS = {
  organization_completeness: "Completitudine organizatie",
  location_completeness: "Completitudine locatie",
  organization_status: "Status organizatie",
  location_publication_alignment: "Status publicare",
  identical_active_submissions: "Cereri duplicate",
};

const FIELD_LABELS = {
  profile_completeness: "Completitudine",
  status: "Status",
  profile_control_status: "Control profil",
  public_visibility_status: "Vizibilitate publica",
  verification_state: "Stare verificare",
  is_verified: "Verificat",
  subject: "Subiect",
  active_count: "Cereri active",
  statuses: "Statusuri existente",
  keeper_status: "Status pastrat",
  duplicates_withdrawn: "Duplicate inchise",
};

function formatValue(key, value) {
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  if (value === null || value === undefined || value === "") return "Lipseste";
  if (key === "profile_completeness") return `${value}%`;
  return String(value);
}

function ValuesPanel({ title, values, proposed = false }) {
  const entries = Object.entries(values || {});
  return (
    <div className={`rounded-2xl border px-4 py-3 ${proposed ? "border-green-200 bg-green-50/70" : "border-border bg-secondary/30"}`}>
      <div className={`text-[11px] font-bold uppercase tracking-[0.12em] ${proposed ? "text-green-800" : "text-muted-foreground"}`}>{title}</div>
      <div className="mt-2 divide-y divide-border/60">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 py-2 text-xs">
            <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
            <strong className="max-w-[58%] break-words text-right">{formatValue(key, value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepairCard({ repair, expanded, busy, onToggle, onApply }) {
  return (
    <div className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{TYPE_LABELS[repair.repair_type] || repair.repair_type}</span>
            <span className="text-[11px] text-muted-foreground">{repair.entity_type}</span>
          </div>
          <h3 className="mt-2 text-sm font-bold leading-snug">{repair.title}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{repair.detail}</p>
        </div>
        <button type="button" onClick={onToggle} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
          {expanded ? "Ascunde" : "Previzualizeaza"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <ValuesPanel title="Valori actuale" values={repair.current_values} />
            <ValuesPanel title="Dupa reparatie" values={repair.proposed_values} proposed />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-green-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Reparatia modifica numai campurile afisate. Inainte de aplicare, backendul verifica din nou ca datele nu s-au schimbat.</span>
            </div>
            <button type="button" disabled={busy} onClick={onApply} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Confirma si aplica
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDataRepairs() {
  const [repairs, setRepairs] = useState(null);
  const [expandedId, setExpandedId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminDataIntegrityOps", { action: "scan" });
      if (response.data?.error) throw new Error(response.data.error);
      setRepairs(response.data?.repairs || []);
      setExpandedId((current) => (response.data?.repairs || []).some((repair) => repair.id === current) ? current : "");
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut genera reparatiile sigure.");
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyRepair = async (repair) => {
    setBusyId(repair.id);
    setError("");
    setMessage("");
    try {
      const response = await base44.functions.invoke("adminDataIntegrityOps", {
        action: "apply",
        repair_id: repair.id,
        expected_signature: repair.expected_signature,
        confirm: true,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setMessage("Reparatia a fost aplicata si inregistrata in Istoric audit.");
      setExpandedId("");
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Reparatia nu a putut fi aplicata.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-bold">Reparatii controlate</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Sunt propuse numai reparatii deterministe: recalcularea completitudinii, alinierea unor statusuri deja confirmate si inchiderea duplicatelor active identice. Fiecare reparatie necesita confirmare separata.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading || !!busyId} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recalculeaza
        </button>
      </div>

      {message && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {repairs === null && !error && <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se pregatesc previzualizarile...</div>}

      {repairs && repairs.length === 0 && !error && (
        <div className="mt-4"><EmptyState icon={CheckCircle2} title="Nu exista reparatii sigure de aplicat." subtitle="Problemele care necesita decizie umana raman vizibile in verificarea read-only de mai sus." /></div>
      )}

      {repairs && repairs.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/35 px-4 py-3 text-xs">
            <span className="font-semibold">Reparatii disponibile</span>
            <span className="rounded-full bg-card px-2.5 py-1 font-bold">{repairs.length}</span>
          </div>
          {repairs.map((repair) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              expanded={expandedId === repair.id}
              busy={busyId === repair.id}
              onToggle={() => setExpandedId((current) => current === repair.id ? "" : repair.id)}
              onApply={() => applyRepair(repair)}
            />
          ))}
        </div>
      )}
    </AdminCard>
  );
}
