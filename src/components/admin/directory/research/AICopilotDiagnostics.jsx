import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// 3G.1.1 PART 6: admin-only regression diagnostics. Runs in-memory checks in
// the backend function - creates NO records of any kind.
export default function AICopilotDiagnostics() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("aiResearchOps", { action: "diagnostics" });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setRunning(false);
  };

  return (
    <div className="mt-10 border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Verificari de siguranta (3G.1.1)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ruleaza verificarile de regres pentru SSRF, limite de fetch, dovezi si izolarea datelor. Nu creeaza nicio inregistrare.</p>
        </div>
        <button onClick={run} disabled={running} className="shrink-0 px-3 py-1.5 rounded-md bg-secondary text-xs font-semibold disabled:opacity-50">
          {running ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Se verifica...</span> : "Ruleaza verificarile"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {result && (
        <ul className="mt-3 space-y-1.5">
          {result.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {c.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-green-700 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
              <span><span className="font-semibold">{c.check}</span> — <span className="text-muted-foreground">{c.details}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}