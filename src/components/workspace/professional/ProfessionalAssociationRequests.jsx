import React, { useState } from "react";
import { Building2, Clock3, MapPin, Search, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// 2026-10-03 (structura conturilor, pasul 2). Specialistul poate cere singur „Lucrez aici” la o
// locație administrată în VIASEE; organizația aprobă sau refuză. Până la aprobare nu apare nicăieri
// public, iar aprobarea nu îi dă acces la contul organizației.

function errorText(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

export default function ProfessionalAssociationRequests({ requests = [], activeLocationIds = [], onRefresh }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showPublicly, setShowPublicly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pending = requests.filter((request) => request.association_request_status === "pending");
  const declined = requests.filter((request) => request.association_request_status === "declined");
  const unavailable = new Set([...activeLocationIds, ...pending.map((request) => request.location_id)]);

  const search = async (event) => {
    event?.preventDefault();
    const q = query.trim();
    setMessage("");
    if (q.length < 2) {
      setError("Scrie cel puțin două litere din numele locației sau al orașului.");
      return;
    }
    setSearching(true);
    setError("");
    const response = await base44.functions.invoke("getClaimableProviderLocations", { q })
      .catch((requestError) => ({ data: { error: errorText(requestError, "Căutarea nu a funcționat.") } }));
    setSearching(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setResults(response.data?.locations || []);
    setSelected(null);
  };

  const send = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "request_association",
      location_id: selected.id,
      show_publicly: showPublicly,
    }).catch((requestError) => ({ data: { error: errorText(requestError, "Cererea nu a putut fi trimisă.") } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setMessage(response.data?.already_pending
      ? "Ai deja o cerere în așteptare pentru această locație."
      : "Cererea a fost trimisă. Locația o aprobă sau o refuză din contul ei.");
    setSelected(null);
    setResults(null);
    setQuery("");
    await onRefresh?.();
  };

  const cancel = async (request) => {
    setSaving(true);
    setError("");
    setMessage("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "cancel_association_request",
      location_id: request.location_id,
    }).catch((requestError) => ({ data: { error: errorText(requestError, "Cererea nu a putut fi anulată.") } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setMessage("Cererea a fost anulată.");
    await onRefresh?.();
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Building2 className="h-4 w-4" /></div>
        <div>
          <h2 className="text-sm font-bold">Lucrezi la o locație care nu apare aici?</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Caută optica, clinica sau cabinetul și trimite cererea „Lucrez aici”. Locația o aprobă din contul ei. Nu primești acces la contul organizației.</p>
        </div>
      </div>

      {message && <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">{error}</div>}

      {pending.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cereri în așteptare</div>
          {pending.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-3 py-3 text-xs">
              <div className="min-w-0">
                <div className="font-bold">{request.location?.name || "Locație"}</div>
                <div className="mt-0.5 text-muted-foreground">{request.location?.city || ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800"><Clock3 className="h-3.5 w-3.5" /> Așteaptă locația</span>
                <button type="button" disabled={saving} onClick={() => cancel(request)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50">
                  <X className="h-3.5 w-3.5" /> Anulează
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {declined.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cereri refuzate</div>
          {declined.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{request.location?.name || "Locație"}</span>
              <span>Locația a refuzat cererea</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={search} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="professional-association-search" className="sr-only">Caută locația</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="professional-association-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Numele locației sau orașul"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <button type="submit" disabled={searching} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          {searching ? "Se caută..." : "Caută"}
        </button>
      </form>

      {results && (
        <div className="mt-3 space-y-2">
          {results.length === 0 && <p className="rounded-2xl border border-dashed border-border px-4 py-4 text-center text-xs text-muted-foreground">Nicio locație găsită.</p>}
          {results.map((location) => {
            const managed = location.claim_action === "request_access";
            const already = unavailable.has(location.id);
            const isSelected = selected?.id === location.id;
            return (
              <div key={location.id} className={`rounded-2xl border px-3 py-3 text-xs ${isSelected ? "border-foreground/40 bg-secondary/40" : "border-border"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{location.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {[location.city, location.organization_name].filter(Boolean).join(" · ")}</div>
                  </div>
                  {already ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">Deja asociat sau cerere trimisă</span>
                  ) : managed ? (
                    <button type="button" onClick={() => setSelected(isSelected ? null : location)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary">
                      {isSelected ? "Renunță" : "Lucrez aici"}
                    </button>
                  ) : (
                    <span className="max-w-[16rem] text-right text-[11px] leading-snug text-muted-foreground">Locația nu e încă administrată în VIASEE, deci nimeni nu poate aproba cererea.</span>
                  )}
                </div>
                {isSelected && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <label className="flex items-start gap-2 text-xs leading-relaxed">
                      <input type="checkbox" checked={showPublicly} onChange={(event) => setShowPublicly(event.target.checked)} className="mt-0.5" />
                      <span>Vreau să apar public la această locație, după ce profilul meu este verificat de VIASEE.</span>
                    </label>
                    <button type="button" disabled={saving} onClick={send} className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">
                      <Send className="h-3.5 w-3.5" /> {saving ? "Se trimite..." : "Trimite cererea"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
