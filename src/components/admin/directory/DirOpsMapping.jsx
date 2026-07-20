import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  GitMerge,
  Layers3,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Split,
  Tags,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const QUEUES = [
  { value: "all", label: "Toate" },
  { value: "organization_conflict", label: "Conflicte organizatie" },
  { value: "organization_unassigned", label: "Fara organizatie" },
  { value: "organization_probable", label: "Legaturi probabile" },
  { value: "type_needs_mapping", label: "Tip necanonic" },
  { value: "identity_needs_review", label: "Identitate neclarificata" },
  { value: "same_address_group", label: "Aceeasi adresa" },
];

const LINK_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmata" },
  { value: "probable", label: "Probabila" },
  { value: "conflict", label: "Conflict" },
  { value: "rejected", label: "Respinsa pentru organizatia selectata" },
  { value: "unassigned", label: "Fara organizatie" },
];

const CONFIDENCE_OPTIONS = [
  { value: "high", label: "Ridicata" },
  { value: "medium", label: "Medie" },
  { value: "low", label: "Scazuta" },
];

const IDENTITY_OPTIONS = [
  { value: "duplicate_same_entity", label: "Dublura a aceleiasi entitati" },
  { value: "same_address_distinct_unit", label: "Unitati distincte la aceeasi adresa" },
  { value: "rebrand_successor", label: "Aceeasi entitate dupa rebranding" },
  { value: "unrelated", label: "Fara relatie de identitate" },
];

const FLAG_LABELS = {
  organization_unassigned: "Fara organizatie",
  organization_probable: "Legatura probabila",
  organization_conflict: "Conflict organizatie",
  type_needs_mapping: "Tip necanonic",
  same_address_group: "Aceeasi adresa",
  identity_needs_review: "Identitate neclarificata",
  migration_review_required: "Revizuire de migrare",
};

function invoke(payload) {
  return base44.functions.invoke("directoryMappingOps", payload)
    .then((response) => response.data || {})
    .catch((requestError) => ({ error: requestError.response?.data?.error || requestError.message }));
}

function displayAddress(location) {
  return [location?.locality_name, location?.address].filter(Boolean).join(" · ") || "Adresa incompleta";
}

function typeKey(option) {
  return `${option.provider_type}::${option.provider_profile_type}`;
}

function StatCard({ icon: Icon, label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary/30"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold opacity-75">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value ?? 0}</div>
    </button>
  );
}

function PreviewBox({ preview, onApply, saving, detachConfirmed, onDetachConfirmed }) {
  if (!preview) return null;
  return (
    <div className="mt-4 rounded-2xl border border-foreground/20 bg-secondary/30 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide">Preview pregatit</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Verifica modificarile si avertismentele. Aplicarea este auditata si nu publica automat profilul.</p>
        </div>
      </div>
      {preview.warnings?.length > 0 && (
        <div className="mt-3 space-y-2">
          {preview.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
            </div>
          ))}
        </div>
      )}
      {preview.after?.link_status === "unassigned" && preview.before?.organization_id && (
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input type="checkbox" checked={detachConfirmed} onChange={(event) => onDetachConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>Confirm eliminarea asocierii organizationale curente.</span>
        </label>
      )}
      <button
        type="button"
        onClick={onApply}
        disabled={saving || (preview.after?.link_status === "unassigned" && preview.before?.organization_id && !detachConfirmed)}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-40 sm:w-auto"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aplica decizia
      </button>
    </div>
  );
}

export default function DirOpsMapping() {
  const [queue, setQueue] = useState("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [orgForm, setOrgForm] = useState({ organization_id: "", link_status: "confirmed", confidence: "high", note: "", evidence_summary: "" });
  const [orgPreview, setOrgPreview] = useState(null);
  const [detachConfirmed, setDetachConfirmed] = useState(false);
  const [typeForm, setTypeForm] = useState({ type_key: "", note: "" });
  const [typePreview, setTypePreview] = useState(null);
  const [identityForm, setIdentityForm] = useState({ related_location_id: "", relationship_type: "same_address_distinct_unit", canonical_location_id: "", confidence: "high", note: "", evidence_summary: "" });
  const [identityPreview, setIdentityPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await invoke({ action: "overview", queue, query, limit: 250 });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setData(null);
      return;
    }
    setData(result);
    if (selectedId && !result.rows.some((row) => row.id === selectedId)) {
      setSelectedId("");
      setContext(null);
    }
  }, [queue, query, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadContext = useCallback(async (locationId) => {
    if (!locationId) return;
    setContextLoading(true);
    setError("");
    const result = await invoke({ action: "location_context", location_id: locationId });
    setContextLoading(false);
    if (result.error) {
      setError(result.error);
      setContext(null);
      return;
    }
    setContext(result);
    const location = result.location;
    setOrgForm({
      organization_id: location.organization_id || "",
      link_status: location.active_link?.link_status || (location.organization_id ? "confirmed" : "unassigned"),
      confidence: location.active_link?.confidence || "high",
      note: "",
      evidence_summary: location.active_link?.evidence_summary || "",
    });
    setTypeForm({ type_key: location.canonical_type_key || "", note: "" });
    const firstCandidate = result.same_address_candidates?.[0] || result.similar_candidates?.[0] || null;
    setIdentityForm({
      related_location_id: firstCandidate?.id || "",
      relationship_type: result.same_address_candidates?.length ? "same_address_distinct_unit" : "duplicate_same_entity",
      canonical_location_id: location.id,
      confidence: "high",
      note: "",
      evidence_summary: "",
    });
    setOrgPreview(null);
    setTypePreview(null);
    setIdentityPreview(null);
    setDetachConfirmed(false);
  }, []);

  const selectLocation = (locationId) => {
    setSelectedId(locationId);
    setMessage("");
    void loadContext(locationId);
  };

  const refreshAfterSave = async (successMessage) => {
    setMessage(successMessage);
    setOrgPreview(null);
    setTypePreview(null);
    setIdentityPreview(null);
    await Promise.all([load(), loadContext(selectedId)]);
  };

  const previewOrganization = async () => {
    setError("");
    const result = await invoke({ action: "preview_organization_link", location_id: selectedId, ...orgForm });
    if (result.error) return setError(result.error);
    setOrgPreview(result);
    setDetachConfirmed(false);
  };

  const applyOrganization = async () => {
    setSaving(true);
    setError("");
    const result = await invoke({
      action: "apply_organization_link",
      location_id: selectedId,
      ...orgForm,
      confirmation_token: orgPreview?.confirmation_token,
      detach_confirmed: detachConfirmed,
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    await refreshAfterSave("Relatia organizatie-locatie a fost salvata si auditata.");
  };

  const selectedType = useMemo(() => (data?.canonical_type_options || []).find((option) => typeKey(option) === typeForm.type_key) || null, [data, typeForm.type_key]);

  const previewType = async () => {
    if (!selectedType) return setError("Selecteaza un tip canonic.");
    setError("");
    const result = await invoke({
      action: "preview_canonical_type",
      location_id: selectedId,
      provider_type: selectedType.provider_type,
      provider_profile_type: selectedType.provider_profile_type,
    });
    if (result.error) return setError(result.error);
    setTypePreview(result);
  };

  const applyType = async () => {
    if (!selectedType) return;
    setSaving(true);
    setError("");
    const result = await invoke({
      action: "apply_canonical_type",
      location_id: selectedId,
      provider_type: selectedType.provider_type,
      provider_profile_type: selectedType.provider_profile_type,
      note: typeForm.note,
      confirmation_token: typePreview?.confirmation_token,
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    await refreshAfterSave("Tipul canonic al locatiei a fost actualizat fara schimbarea publicarii sau verificarii.");
  };

  const identityCandidates = useMemo(() => {
    const rows = [...(context?.same_address_candidates || []), ...(context?.similar_candidates || [])];
    return [...new Map(rows.map((row) => [row.id, row])).values()];
  }, [context]);

  const previewIdentity = async () => {
    setError("");
    const result = await invoke({
      action: "preview_identity_relation",
      primary_location_id: selectedId,
      ...identityForm,
    });
    if (result.error) return setError(result.error);
    setIdentityPreview(result);
  };

  const applyIdentity = async () => {
    setSaving(true);
    setError("");
    const result = await invoke({
      action: "apply_identity_relation",
      primary_location_id: selectedId,
      ...identityForm,
      confirmation_token: identityPreview?.confirmation_token,
    });
    setSaving(false);
    if (result.error) return setError(result.error);
    await refreshAfterSave("Relatia de identitate dintre locatii a fost inregistrata. Nu s-a facut nicio consolidare automata.");
  };

  const summary = data?.summary || {};
  const selected = context?.location || data?.rows?.find((row) => row.id === selectedId) || null;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-base font-bold">Mapare organizatii si locatii</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Clarifica legaturile organizationale, tipurile canonice, dublurile, rebrandingul si unitatile distincte de la aceeasi adresa. Nicio decizie nu publica, verifica sau combina automat profiluri.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reincarca
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard icon={Layers3} label="Total locatii" value={summary.total_locations} active={queue === "all"} onClick={() => setQueue("all")} />
          <StatCard icon={AlertTriangle} label="Conflicte" value={summary.organization_conflict} active={queue === "organization_conflict"} onClick={() => setQueue("organization_conflict")} />
          <StatCard icon={Building2} label="Fara organizatie" value={summary.organization_unassigned} active={queue === "organization_unassigned"} onClick={() => setQueue("organization_unassigned")} />
          <StatCard icon={Link2} label="Probabile" value={summary.organization_probable} active={queue === "organization_probable"} onClick={() => setQueue("organization_probable")} />
          <StatCard icon={Tags} label="Tip necanonic" value={summary.type_needs_mapping} active={queue === "type_needs_mapping"} onClick={() => setQueue("type_needs_mapping")} />
          <StatCard icon={MapPin} label="Aceeasi adresa" value={summary.same_address_group} active={queue === "same_address_group"} onClick={() => setQueue("same_address_group")} />
          <StatCard icon={Split} label="Identitate neclara" value={summary.identity_needs_review} active={queue === "identity_needs_review"} onClick={() => setQueue("identity_needs_review")} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta dupa nume, oras, adresa sau organizatie" className="min-h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm" />
          </label>
          <select value={queue} onChange={(event) => setQueue(event.target.value)} className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm">
            {QUEUES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{data?.total_filtered ?? 0} rezultate in coada curenta</div>
      </section>

      {message && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">{message}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <div className="grid gap-5 2xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.6fr)]">
        <section className="rounded-3xl border border-border bg-card p-3 sm:p-4">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca locatiile...</div>
          ) : !data?.rows?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nu exista locatii in aceasta coada.</div>
          ) : (
            <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
              {data.rows.map((row) => (
                <button key={row.id} type="button" onClick={() => selectLocation(row.id)} className={`w-full rounded-2xl border p-3.5 text-left transition ${selectedId === row.id ? "border-foreground bg-secondary/40" : "border-border bg-background hover:bg-secondary/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{row.name}</div>
                      <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{displayAddress(row)}</span></div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{row.organization?.name || "Fara organizatie"}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.flags.slice(0, 4).map((flag) => <span key={flag} className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold">{FLAG_LABELS[flag] || flag}</span>)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          {!selectedId ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <GitMerge className="mb-3 h-8 w-8" /> Selecteaza o locatie pentru mapare.
            </div>
          ) : contextLoading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca contextul...</div>
          ) : selected ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Locatie selectata</div>
                  <h3 className="mt-1 text-lg font-extrabold">{selected.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{displayAddress(selected)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.provider_type || "tip lipsa"} · {selected.provider_profile_type || "profil lipsa"}</p>
                </div>
                <button type="button" onClick={() => { setSelectedId(""); setContext(null); }} className="rounded-full border border-border p-2 hover:bg-secondary" aria-label="Inchide"><X className="h-4 w-4" /></button>
              </div>

              <section>
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><h4 className="text-sm font-bold">Relatie organizatie-locatie</h4></div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold text-muted-foreground">Organizatie
                    <select value={orgForm.organization_id} disabled={orgForm.link_status === "unassigned"} onChange={(event) => { setOrgForm((current) => ({ ...current, organization_id: event.target.value })); setOrgPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-50">
                      <option value="">Selecteaza organizatia</option>
                      {(data?.organizations || []).map((organization) => <option key={organization.id} value={organization.id}>{organization.name} ({organization.location_count})</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">Decizie
                    <select value={orgForm.link_status} onChange={(event) => { const value = event.target.value; setOrgForm((current) => ({ ...current, link_status: value, organization_id: value === "unassigned" ? "" : current.organization_id })); setOrgPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      {LINK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">Incredere
                    <select value={orgForm.confidence} onChange={(event) => { setOrgForm((current) => ({ ...current, confidence: event.target.value })); setOrgPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      {CONFIDENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">Nota administrativa
                    <input value={orgForm.note} onChange={(event) => setOrgForm((current) => ({ ...current, note: event.target.value.slice(0, 1200) }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" placeholder="De ce este corecta decizia" />
                  </label>
                </div>
                <label className="mt-3 block text-xs font-semibold text-muted-foreground">Rezumat dovezi
                  <textarea rows={2} value={orgForm.evidence_summary} onChange={(event) => setOrgForm((current) => ({ ...current, evidence_summary: event.target.value.slice(0, 1600) }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <button type="button" onClick={previewOrganization} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-xs font-semibold hover:bg-secondary sm:w-auto"><Link2 className="h-4 w-4" /> Genereaza preview</button>
                <PreviewBox preview={orgPreview} onApply={applyOrganization} saving={saving} detachConfirmed={detachConfirmed} onDetachConfirmed={setDetachConfirmed} />
              </section>

              <section className="border-t border-border pt-6">
                <div className="flex items-center gap-2"><Tags className="h-4 w-4" /><h4 className="text-sm font-bold">Tip canonic al locatiei</h4></div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="text-xs font-semibold text-muted-foreground">Tip
                    <select value={typeForm.type_key} onChange={(event) => { setTypeForm((current) => ({ ...current, type_key: event.target.value })); setTypePreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                      <option value="">Selecteaza tipul canonic</option>
                      {(data?.canonical_type_options || []).map((option) => <option key={typeKey(option)} value={typeKey(option)}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-muted-foreground">Nota administrativa
                    <input value={typeForm.note} onChange={(event) => setTypeForm((current) => ({ ...current, note: event.target.value.slice(0, 1200) }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
                  </label>
                </div>
                <button type="button" onClick={previewType} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-xs font-semibold hover:bg-secondary sm:w-auto"><Tags className="h-4 w-4" /> Genereaza preview</button>
                <PreviewBox preview={typePreview} onApply={applyType} saving={saving} detachConfirmed={true} onDetachConfirmed={() => {}} />
              </section>

              <section className="border-t border-border pt-6">
                <div className="flex items-center gap-2"><Split className="h-4 w-4" /><h4 className="text-sm font-bold">Identitate, dubluri si unitati distincte</h4></div>
                {identityCandidates.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-xs text-muted-foreground">Nu exista candidati apropiati dupa nume sau adresa.</p>
                ) : (
                  <>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold text-muted-foreground">Locatie comparata
                        <select value={identityForm.related_location_id} onChange={(event) => { setIdentityForm((current) => ({ ...current, related_location_id: event.target.value })); setIdentityPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                          {identityCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {displayAddress(candidate)}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-muted-foreground">Relatie
                        <select value={identityForm.relationship_type} onChange={(event) => { const value = event.target.value; setIdentityForm((current) => ({ ...current, relationship_type: value, canonical_location_id: ["duplicate_same_entity", "rebrand_successor"].includes(value) ? (current.canonical_location_id || selectedId) : "" })); setIdentityPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                          {IDENTITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      {["duplicate_same_entity", "rebrand_successor"].includes(identityForm.relationship_type) && (
                        <label className="text-xs font-semibold text-muted-foreground">Profil canonic pastrat
                          <select value={identityForm.canonical_location_id} onChange={(event) => { setIdentityForm((current) => ({ ...current, canonical_location_id: event.target.value })); setIdentityPreview(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                            <option value={selectedId}>{selected.name}</option>
                            {identityCandidates.filter((candidate) => candidate.id === identityForm.related_location_id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                          </select>
                        </label>
                      )}
                      <label className="text-xs font-semibold text-muted-foreground">Incredere
                        <select value={identityForm.confidence} onChange={(event) => setIdentityForm((current) => ({ ...current, confidence: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                          {CONFIDENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold text-muted-foreground">Nota administrativa
                      <textarea rows={3} value={identityForm.note} onChange={(event) => setIdentityForm((current) => ({ ...current, note: event.target.value.slice(0, 1200) }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Explica distinctia functionala, dublura sau istoricul rebrandingului" />
                    </label>
                    <label className="mt-3 block text-xs font-semibold text-muted-foreground">Rezumat dovezi
                      <textarea rows={2} value={identityForm.evidence_summary} onChange={(event) => setIdentityForm((current) => ({ ...current, evidence_summary: event.target.value.slice(0, 1600) }))} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <button type="button" onClick={previewIdentity} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-xs font-semibold hover:bg-secondary sm:w-auto"><Split className="h-4 w-4" /> Genereaza preview</button>
                    <PreviewBox preview={identityPreview} onApply={applyIdentity} saving={saving} detachConfirmed={true} onDetachConfirmed={() => {}} />
                  </>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
