import React, { useState } from "react";
import { Check, X, Pencil } from "lucide-react";

const CONF = { low: "Încredere scăzută", medium: "Încredere medie", high: "Încredere ridicată" };

export default function AICopilotFieldRow({ label, value, evidence = [], decision, onDecide, disabled }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(value || "");
  const state = decision?.decision;

  return (
    <div className={`border rounded-md p-3 ${state === "approve" ? "border-success-border bg-success-soft" : state === "reject" ? "border-border opacity-60" : state === "needs_additional_source" ? "border-warning-border bg-warning-soft" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          {editing ? (
            <input className="mt-1 w-full border border-input rounded px-2 py-1 text-sm bg-card" value={edited} onChange={(e) => setEdited(e.target.value)} />
          ) : (
            <p className="text-sm font-medium mt-0.5">{value || <span className="text-muted-foreground italic">lipsește din sursă</span>}</p>
          )}
          {evidence.map((ev, i) => (
            <p key={i} className="text-xs text-muted-foreground mt-1">
              &quot;{ev.snippet}&quot; — <span className="italic">{ev.source_ref}</span> · {CONF[ev.confidence] || ev.confidence}
            </p>
          ))}
          {state === "needs_additional_source" && (
            <p className="text-xs text-warning mt-1 font-semibold">Necesită sursă suplimentară: {decision?.reason || "valoarea editată nu are dovadă în sursele stocate"}</p>
          )}
        </div>
        {!disabled && (
          <div className="flex gap-1 shrink-0">
            {editing ? (
              <button onClick={() => { setEditing(false); onDecide("approve", edited); }} className="p-1.5 rounded bg-success text-white" title="Salvează și aprobă"><Check className="w-3.5 h-3.5" /></button>
            ) : (
              <>
                {value && <button onClick={() => onDecide("approve")} className={`p-1.5 rounded ${state === "approve" ? "bg-success text-white" : "bg-secondary"}`} title="Aprobă"><Check className="w-3.5 h-3.5" /></button>}
                <button onClick={() => { setEdited(value || ""); setEditing(true); }} className="p-1.5 rounded bg-secondary" title="Editează"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onDecide("reject")} className={`p-1.5 rounded ${state === "reject" ? "bg-destructive text-destructive-foreground" : "bg-secondary"}`} title="Respinge"><X className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}