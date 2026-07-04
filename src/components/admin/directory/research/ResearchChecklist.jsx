import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CHECKLIST_ITEMS } from "@/lib/researchCatalog";

// Each checklist action is explicit — nothing is marked complete automatically.
export default function ResearchChecklist({ locationId, checklist, onReload }) {
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);

  const toggle = async (key, done) => {
    setSavingKey(key);
    setError(null);
    try {
      await base44.functions.invoke("researchOps", { action: "set_checklist_item", location_id: locationId, item_key: key, done });
      await onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSavingKey(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-bold text-sm">E. Checklist research</h3>
      <ul className="mt-3 space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const state = checklist[item.key];
          return (
            <li key={item.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!state?.done}
                disabled={savingKey === item.key}
                onChange={(e) => toggle(item.key, e.target.checked)}
              />
              <span>
                {item.label}
                {state?.done && (
                  <span className="block text-[11px] text-muted-foreground">
                    {state.at ? state.at.slice(0, 10) : ""}{state.by ? ` · ${state.by}` : ""}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}