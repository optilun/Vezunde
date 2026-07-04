import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";
import { RESEARCH_STATUS_LABELS, MISSING_FIELD_LABELS } from "@/lib/researchCatalog";
import ResearchStatusPanel from "./ResearchStatusPanel";
import ResearchChecklist from "./ResearchChecklist";
import ResearchEvidencePanel from "./ResearchEvidencePanel";

const box = "bg-card border border-border rounded-xl p-5";

export default function ResearchProfile({ locationId, onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("researchOps", { action: "profile", location_id: locationId });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;

  const { location: loc, organization: org, services, evidence, duplicates, checklist, missing_fields } = data;
  const activeEvidence = evidence.filter((e) => e.evidence_status === "active");
  const warnings = missing_fields.map((k) => `Lipseste: ${MISSING_FIELD_LABELS[k] || k}`);
  if (services.length === 0) warnings.push("Locatia nu are niciun serviciu inregistrat.");
  if (activeEvidence.length === 0) warnings.push("Locatia nu are nicio dovada activa.");

  return (
    <div>
      <button onClick={onBack} className="text-xs font-semibold text-muted-foreground hover:text-foreground">&larr; Inapoi la coada</button>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-xl font-bold">{loc.name}</h2>
        <span className="text-xs bg-secondary rounded-full px-2.5 py-1">{PCS_LABELS[loc.profile_control_status || "directory"] || loc.profile_control_status}</span>
        <span className="text-xs bg-accent text-accent-foreground rounded-full px-2.5 py-1">Research: {RESEARCH_STATUS_LABELS[loc.research_status || "new"]}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {org?.name ? `${org.name} · ` : ""}{PROVIDER_TYPES[loc.provider_type] || loc.provider_type} · {loc.city}{loc.county ? `, ${loc.county}` : ""}
      </p>

      {warnings.length > 0 && (
        <div className="mt-4 border border-destructive/40 bg-destructive/5 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-destructive">Avertismente date lipsa</p>
          <ul className="mt-1.5 text-sm space-y-0.5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <div className={box}>
          <h3 className="font-heading font-bold text-sm">A. Date de baza</h3>
          <dl className="mt-3 text-sm space-y-1.5">
            <div><dt className="inline text-muted-foreground">Adresa: </dt><dd className="inline">{loc.address || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Telefon public: </dt><dd className="inline">{loc.phone_public || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Email public: </dt><dd className="inline">{loc.public_email || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Website: </dt><dd className="inline">{loc.website || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Program: </dt><dd className="inline">{loc.opening_hours || "—"}</dd></div>
            <div><dt className="inline text-muted-foreground">Descriere: </dt><dd className="inline">{loc.description || "—"}</dd></div>
          </dl>
        </div>

        <div className={box}>
          <h3 className="font-heading font-bold text-sm">B. Surse existente pe profil</h3>
          {loc.source_url ? (
            <div className="mt-3 text-sm space-y-1">
              <div className="break-all"><span className="text-muted-foreground">URL: </span>{loc.source_url}</div>
              <div><span className="text-muted-foreground">Tip: </span>{loc.source_type || "—"} · <span className="text-muted-foreground">Verificat la: </span>{loc.source_checked_at ? loc.source_checked_at.slice(0, 10) : "—"}</div>
              <div><span className="text-muted-foreground">Incredere: </span>{loc.data_confidence || "—"} · <span className="text-muted-foreground">Colectat de: </span>{loc.collected_by || "—"}</div>
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">Nicio sursa inregistrata pe profil.</p>}
        </div>

        <div className={box}>
          <h3 className="font-heading font-bold text-sm">C. Servicii existente ({services.length})</h3>
          {services.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Niciun serviciu.</p> : (
            <ul className="mt-3 text-sm space-y-1.5">
              {services.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.service_key}</span>
                  <span className="text-muted-foreground"> · {s.confirmation_level}{s.is_active === false ? " · inactiv" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ResearchStatusPanel location={loc} onReload={load} />
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <ResearchChecklist locationId={loc.id} checklist={checklist} onReload={load} />

        <div className={box}>
          <h3 className="font-heading font-bold text-sm">G. Candidati duplicate</h3>
          <p className="mt-1 text-xs text-muted-foreground">Detectate dupa nume normalizat, adresa, domeniu website, telefon si organizatie. Nu se face fuziune automata.</p>
          {duplicates.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Niciun candidat de duplicat gasit.</p> : (
            <ul className="mt-3 text-sm space-y-2">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <span className="font-medium">{d.name}</span> — {d.city}{d.address ? `, ${d.address}` : ""}
                  <span className="block text-xs text-muted-foreground">Motiv: {d.match_reasons.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => onNavigate && onNavigate("audit")} className="mt-4 text-xs font-semibold underline underline-offset-4">
            I. Vezi istoricul de audit
          </button>
        </div>
      </div>

      <div className="mt-4">
        <ResearchEvidencePanel location={loc} organization={org} services={services} evidence={evidence} onReload={load} />
      </div>
    </div>
  );
}