import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";

// MODULE 3F.2.3 — Geography Contract regression checks (admin-only, read-only).
// Exercises ONLY rejection/empty paths — it NEVER creates provider, claim,
// geographic or any other records. See GEOGRAPHY_CONTRACT.md.

const invoke = async (fn, payload) => {
  try {
    const res = await base44.functions.invoke(fn, payload);
    return { status: res.status || 200, data: res.data || {} };
  } catch (e) {
    return { status: e.response?.status || 500, data: e.response?.data || { error: e.message } };
  }
};

const PROVENANCE = { source_url: "https://contract-check.invalid", source_type: "site_oficial", source_checked_at: "2026-01-01T00:00:00Z", data_confidence: "medium" };

const CHECKS = [
  {
    name: "Fara fallback geografic automat (judet/national/apropiere)",
    run: async () => {
      // Verificarea nu mai depinde de un oras gol (directorul are acum locatii peste tot,
      // iar un test bazat pe "zero rezultate" ar trece din motivul gresit). Verificam
      // direct regula: intr-o cautare cu scope=city, NICIUN rezultat nu are voie sa vina
      // din afara localitatii cerute.
      const r = await invoke("matchProviders", { locality_siruta_code: "54975", city: "Cluj-Napoca", scope: "city", limit: 20 });
      if (r.status !== 200 || !Array.isArray(r.data.results)) return false;
      const noOutsideResults = r.data.results.every((x) => !x.expansion_tier || x.expansion_tier === "oras");
      const scopeHonored = !r.data.query_scope || r.data.query_scope === "city" || r.data.query_scope === "locality";
      return noOutsideResults && scopeHonored;
    },
  },
  {
    name: "Coordonatele/place_id nu influenteaza matching-ul public",
    run: async () => {
      // Trimitem coordonate explicit si verificam ca (a) nu se scurg in raspuns si
      // (b) nu schimba rezultatele fata de aceeasi cautare fara coordonate.
      const withGeo = await invoke("matchProviders", { locality_siruta_code: "54975", city: "Cluj-Napoca", scope: "city", lat: 46.77, lng: 23.59, limit: 20 });
      const withoutGeo = await invoke("matchProviders", { locality_siruta_code: "54975", city: "Cluj-Napoca", scope: "city", limit: 20 });
      if (withGeo.status !== 200 || !Array.isArray(withGeo.data.results)) return false;
      const noLeak = withGeo.data.results.every((x) => x.lat === undefined && x.lng === undefined && x.place_id === undefined && x.distance_km === undefined);
      const idsOf = (res) => JSON.stringify((res.data.results || []).map((x) => x.id));
      const sameResults = idsOf(withGeo) === idsOf(withoutGeo);
      return noLeak && sameResults;
    },
  },
  {
    name: "Creare admin fara SIRUTA este respinsa",
    run: async () => {
      const r = await invoke("directoryOps", { action: "create_location", organization: { name: "Contract Check" }, location: { name: "Contract Check", provider_type: "optica_medicala", city: "Cluj-Napoca", county: "Cluj", address: "Str. Verificare 1" }, provenance: PROVENANCE });
      return r.status === 400;
    },
  },
  {
    name: "Creare admin cu SIRUTA invalid/inactiv este respinsa",
    run: async () => {
      const r = await invoke("directoryOps", { action: "create_location", organization: { name: "Contract Check" }, location: { name: "Contract Check", provider_type: "optica_medicala", locality_siruta_code: "999999", address: "Str. Verificare 1" }, provenance: PROVENANCE });
      return r.status === 400;
    },
  },
  {
    name: "Oras/judet trimise manual in conflict cu geografia canonica sunt respinse",
    run: async () => {
      const r = await invoke("directoryOps", { action: "create_location", organization: { name: "Contract Check" }, location: { name: "Contract Check", provider_type: "optica_medicala", locality_siruta_code: "54975", city: "Bucuresti", address: "Str. Verificare 1" }, provenance: PROVENANCE });
      return r.status === 400;
    },
  },
  {
    name: "Onboarding furnizor fara SIRUTA este respins (chiar cu date Google)",
    run: async () => {
      const r = await invoke("submitProviderClaim", { mode: "new_location", representation_confirmed: true, contact: { contact_name: "Contract Check", email: "contract@check.invalid" }, location: { name: "Contract Check", provider_type: "optica_medicala", city: "Cluj-Napoca", place_id: "google-place-x", lat: 46.77, lng: 23.59 } });
      return r.status === 400;
    },
  },
  {
    name: "Editarea directa oras/judet de catre furnizor este respinsa",
    run: async () => {
      const r = await invoke("updateProviderLocation", { location_id: "contract-check-id", staged: { fields: { city: "Bucuresti" } } });
      return r.status === 400 && /localitat/i.test(r.data.error || "");
    },
  },
  {
    name: "Schimbarea localitatii cu SIRUTA invalid este respinsa",
    run: async () => {
      const r = await invoke("updateProviderLocation", { location_id: "contract-check-id", staged: { fields: { locality_siruta_code: "999999" } } });
      return r.status === 400;
    },
  },
];

export default function GeoContractChecks() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runAll = async () => {
    setRunning(true);
    setResults(null);
    const out = [];
    for (const c of CHECKS) {
      let pass = false;
      try { pass = await c.run(); } catch { pass = false; }
      out.push({ name: c.name, pass });
    }
    setResults(out);
    setRunning(false);
  };

  const passed = results?.filter((r) => r.pass).length || 0;

  return (
    <div className="max-w-2xl space-y-5">
      <AdminCard className="p-5">
        <h2 className="font-heading font-bold text-sm">Contract geografic — verificari de regresie</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ruleaza doar cai de respingere / rezultate goale — nu creeaza niciun fel de inregistrari. Detalii: GEOGRAPHY_CONTRACT.md.
        </p>
        <button onClick={runAll} disabled={running} className="mt-4 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {running ? "Se ruleaza..." : "Ruleaza verificarile"}
        </button>
        {running && <Loader2 className="mt-4 w-5 h-5 animate-spin text-muted-foreground" />}
      </AdminCard>

      {results && (
        <AdminCard className="p-5">
          <p className={`text-sm font-semibold ${passed === results.length ? "text-green-700" : "text-destructive"}`}>
            {passed}/{results.length} verificari trecute
          </p>
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.name} className="flex items-start gap-2 text-sm">
                {r.pass ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                <span>{r.name}</span>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
    </div>
  );
}