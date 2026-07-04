import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import AICopilotSourceForm from "./AICopilotSourceForm";
import AICopilotDraftReview from "./AICopilotDraftReview";

// MODULE 3G.1 - AI Research Copilot (admin-only). Creates research sources and
// AI drafts only — never provider records. The only exit is prefilling the
// canonical "Adauga locatie" form.

const SRC_STATUS = { pending: "In asteptare", fetched: "Preluat", blocked: "Blocat", failed: "Esuat", manual: "Text manual" };
const DRAFT_STATUS = { draft: "Draft", in_review: "In review", ready_to_transfer: "Gata de transfer", rejected: "Respins", transferred: "Transferat" };

export default function AICopilot({ onNavigate }) {
  const [sources, setSources] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [reviewId, setReviewId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    Promise.all([
      base44.entities.ResearchSource.list("-created_date", 50),
      base44.entities.AIResearchDraft.list("-created_date", 100),
    ]).then(([s, d]) => { setSources(s); setDrafts(d); });
  };
  useEffect(load, []);

  const runAnalysis = async (sourceId) => {
    setRunningId(sourceId);
    setError(null);
    try {
      const res = await base44.functions.invoke("aiResearchOps", { action: "run_analysis", source_id: sourceId });
      load();
      setReviewId(res.data.draft_id);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setRunningId(null);
  };

  if (reviewId) {
    return <AICopilotDraftReview draftId={reviewId} onBack={() => { setReviewId(null); load(); }} onNavigate={onNavigate} />;
  }

  const usable = (s) => s.fetch_status === "fetched" || s.fetch_status === "manual";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold">AI Copilot — research asistat</h2>
          <p className="text-xs text-muted-foreground mt-1">Genereaza doar drafturi de research. Nu creeaza profiluri, nu publica si nu verifica nimic — singura iesire este pre-completarea formularului &quot;Adauga locatie&quot;.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="shrink-0 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
          {showForm ? "Inchide" : "Adauga sursa"}
        </button>
      </div>

      {showForm && <AICopilotSourceForm onDone={() => { setShowForm(false); load(); }} />}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 space-y-3">
        {sources === null && <p className="text-sm text-muted-foreground">Se incarca...</p>}
        {sources?.length === 0 && <p className="text-sm text-muted-foreground">Nicio sursa de research inca. Adauga un URL public sau un text manual.</p>}
        {sources?.map((s) => {
          const srcDrafts = drafts.filter((d) => d.source_id === s.id);
          return (
            <div key={s.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.source_title || s.source_domain || s.source_url || "Text manual"}</p>
                  {s.source_url && <p className="text-xs text-muted-foreground truncate">{s.source_url}</p>}
                  <p className="text-xs mt-1">
                    <span className={`font-semibold ${usable(s) ? "text-green-700" : "text-destructive"}`}>{SRC_STATUS[s.fetch_status] || s.fetch_status}</span>
                    {s.extracted_text_length > 0 && <span className="text-muted-foreground"> · {s.extracted_text_length} caractere</span>}
                  </p>
                  {s.extraction_error && <p className="text-xs text-destructive mt-1">{s.extraction_error}</p>}
                </div>
                {usable(s) && (
                  <button onClick={() => runAnalysis(s.id)} disabled={runningId === s.id} className="shrink-0 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold disabled:opacity-50">
                    {runningId === s.id ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Se analizeaza...</span> : "Ruleaza analiza"}
                  </button>
                )}
              </div>
              {srcDrafts.length > 0 && (
                <div className="mt-3 border-t border-border pt-2 space-y-1">
                  {srcDrafts.map((d) => (
                    <button key={d.id} onClick={() => setReviewId(d.id)} className="w-full flex items-center justify-between text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors">
                      <span>Draft AI din {new Date(d.created_date).toLocaleString("ro-RO")}</span>
                      <span className={`font-semibold ${d.status === "ready_to_transfer" ? "text-green-700" : d.status === "transferred" ? "text-muted-foreground" : "text-foreground"}`}>{DRAFT_STATUS[d.status] || d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}