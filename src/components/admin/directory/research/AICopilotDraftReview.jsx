import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";
import AICopilotApplyServices from "./AICopilotApplyServices";
import AICopilotFieldRow from "./AICopilotFieldRow";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const ORG_LABELS = { name: "Nume organizatie", legal_name: "Denumire legala", website: "Website organizatie" };
const LOC_LABELS = { name: "Nume locatie", provider_type: "Tip furnizor", address: "Adresa", locality_text: "Localitate (text sursa)", county_text: "Judet (text sursa)", phone_public: "Telefon public", public_email: "Email public", website: "Website locatie", opening_hours: "Program" };

const pj = (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };

export default function AICopilotDraftReview({ draftId, onBack, onNavigate }) {
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState(null);

  const load = () => {
    base44.functions.invoke("aiResearchOps", { action: "get_draft", draft_id: draftId })
      .then((res) => { setBundle(res.data); setDupes(pj(res.data.draft.duplicate_candidates_json, null)); })
      .catch((e) => setError(e.response?.data?.error || e.message));
  };
  useEffect(load, [draftId]);

  if (error) return <div><button onClick={onBack} className="text-sm underline">Inapoi</button><p className="mt-3 text-sm text-destructive">{error}</p></div>;
  if (!bundle) return <p className="text-sm text-muted-foreground">Se incarca draftul...</p>;

  const d = bundle.draft;
  const org = pj(d.organization_json, {});
  const loc = pj(d.location_json, {});
  const services = pj(d.services_json, []);
  const specs = pj(d.specializations_json, []);
  const evidence = pj(d.field_evidence_json, {});
  const decisions = pj(d.review_decisions_json, {});
  const conflicts = pj(d.conflicts_json, []);
  const missing = pj(d.missing_fields_json, []);
  const warnings = pj(d.warnings, []);
  const localityCandidates = pj(d.locality_candidates_json, []);
  const transferred = d.status === "transferred";

  const decide = async (field, decision, value) => {
    setBusy(true);
    setError(null);
    try {
      await base44.functions.invoke("aiResearchOps", { action: "review_field", draft_id: draftId, field, decision, value });
      load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setBusy(false);
  };

  const searchDupes = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("aiResearchOps", { action: "search_duplicate_candidates", draft_id: draftId });
      setDupes(res.data.duplicate_candidates);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setBusy(false);
  };

  const transfer = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("aiResearchOps", { action: "transfer_to_directory_form", draft_id: draftId });
      sessionStorage.setItem("dirops_prefill", JSON.stringify(res.data.prefill));
      onNavigate("adauga");
    } catch (e) { setError(e.response?.data?.error || e.message); setBusy(false); }
  };

  const row = (group, field, labels, obj) => (
    <AICopilotFieldRow
      key={`${group}.${field}`}
      label={labels[field]}
      value={obj[field]}
      evidence={evidence[`${group}.${field}`] || []}
      decision={decisions[`${group}.${field}`]}
      disabled={transferred || busy}
      onDecide={(dec, val) => decide(`${group}.${field}`, dec, val)}
    />
  );

  const selectedCand = localityCandidates.find((c) => c.siruta_code === d.selected_locality_siruta_code);

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Inapoi la surse</button>
      <h2 className="font-heading font-bold mt-3">Review draft AI</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Sursa: {bundle.source?.source_title || bundle.source?.source_url || "text manual"} · Status draft: <span className="font-semibold">{d.status}</span>
      </p>
      {transferred && <p className="mt-2 text-sm text-green-700 font-semibold">Draft transferat in formularul Adauga locatie la {new Date(d.transferred_at).toLocaleString("ro-RO")}.</p>}

      {warnings.length > 0 && (
        <div className="mt-4 border border-amber-400/50 bg-amber-50 rounded-md p-3">
          <p className="text-xs font-semibold">Avertismente</p>
          <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="mt-3 border border-destructive/40 bg-destructive/5 rounded-md p-3">
          <p className="text-xs font-semibold text-destructive">Conflicte in sursa</p>
          <ul className="mt-1 text-xs list-disc pl-4">{conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      <h3 className="font-heading font-bold text-sm mt-6">Organizatie</h3>
      <div className="mt-2 space-y-2">{Object.keys(ORG_LABELS).map((f) => row("organization", f, ORG_LABELS, org))}</div>

      <h3 className="font-heading font-bold text-sm mt-6">Locatie</h3>
      <div className="mt-2 space-y-2">{Object.keys(LOC_LABELS).map((f) => row("location", f, LOC_LABELS, loc))}</div>

      <h3 className="font-heading font-bold text-sm mt-6">Servicii sugerate</h3>
      {services.length === 0 && <p className="text-xs text-muted-foreground mt-1">Niciun serviciu explicit gasit in sursa.</p>}
      <div className="mt-2 space-y-2">
        {services.map((s) => (
          <AICopilotFieldRow key={s.service_key} label={`Serviciu: ${s.service_key}`} value={s.service_key}
            evidence={[{ snippet: s.explicit_text, source_ref: (s.source_refs || [])[0] || "sursa", confidence: s.confidence }]}
            decision={decisions[`service:${s.service_key}`]} disabled={transferred || busy}
            onDecide={(dec) => decide(`service:${s.service_key}`, dec)} />
        ))}
      </div>

      <h3 className="font-heading font-bold text-sm mt-6">Specializari sugerate</h3>
      {specs.length === 0 && <p className="text-xs text-muted-foreground mt-1">Nicio specializare explicita gasita in sursa.</p>}
      <div className="mt-2 space-y-2">
        {specs.map((s) => (
          <AICopilotFieldRow key={s.specialization_key} label={`Specializare: ${s.specialization_key}`} value={s.specialization_key}
            evidence={[{ snippet: s.explicit_text, source_ref: "sursa", confidence: s.confidence }]}
            decision={decisions[`specialization:${s.specialization_key}`]} disabled={transferred || busy}
            onDecide={(dec) => decide(`specialization:${s.specialization_key}`, dec)} />
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-5 text-xs text-muted-foreground"><span className="font-semibold">Campuri lipsa din sursa:</span> {missing.join(", ")}</p>
      )}

      <h3 className="font-heading font-bold text-sm mt-6">Localitate canonica (obligatoriu inainte de transfer)</h3>
      <p className="text-xs text-muted-foreground mt-1">AI-ul nu seteaza niciodata codul SIRUTA. Alege explicit localitatea oficiala.</p>
      {!transferred && localityCandidates.length > 0 && !d.selected_locality_siruta_code && (
        <div className="mt-2 space-y-1">
          {localityCandidates.map((c) => (
            <button key={c.siruta_code} onClick={() => decide("locality", "approve", c.siruta_code)} disabled={busy}
              className="block w-full text-left px-3 py-2 rounded-md border border-border bg-card text-sm hover:bg-secondary transition-colors">
              {c.display_label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2">
        {d.selected_locality_siruta_code ? (
          <div className="flex items-center justify-between border border-green-600/40 bg-green-50/50 rounded-md px-3 py-2 text-sm">
            <span className="font-medium">{selectedCand?.display_label || `SIRUTA ${d.selected_locality_siruta_code}`}</span>
            {!transferred && <button onClick={() => decide("locality", "reject")} className="text-xs underline text-muted-foreground">Schimba</button>}
          </div>
        ) : (
          !transferred && <LocalityAutocomplete value={null} onSelect={(l) => l && decide("locality", "approve", l.siruta_code)} placeholder="Cauta localitatea oficiala..." />
        )}
      </div>

      <h3 className="font-heading font-bold text-sm mt-6">Posibile duplicate</h3>
      <button onClick={searchDupes} disabled={busy || transferred} className="mt-2 px-3 py-1.5 rounded-md bg-secondary text-xs font-semibold disabled:opacity-50">Verifica duplicate</button>
      {dupes && dupes.length === 0 && <p className="text-xs text-green-700 mt-2">Niciun duplicat gasit in director.</p>}
      {dupes?.map((c) => (
        <p key={c.id} className="text-xs text-destructive mt-2">{c.name} — {c.city}, {c.address} · {c.match_reasons.join(", ")}</p>
      ))}

      <h3 className="font-heading font-bold text-sm mt-6">Aplica serviciile aprobate pe o locatie existenta</h3>
      <AICopilotApplyServices draftId={draftId} duplicateCandidates={dupes} />

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!transferred && (
        <div className="mt-8 border-t border-border pt-4">
          <button onClick={transfer} disabled={busy || d.status !== "ready_to_transfer"} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
            Transfera in formularul Adauga locatie
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            Transferul doar pre-completeaza formularul canonic cu valorile aprobate — nu creeaza nicio inregistrare. Necesita aprobarea campurilor obligatorii (organizatie, nume, tip, adresa) si o localitate SIRUTA selectata.
            Pentru o locatie care exista deja in director, foloseste sectiunea de mai sus: scrie direct serviciile aprobate, fara sa le reintroduci manual.
          </p>
        </div>
      )}
    </div>
  );
}