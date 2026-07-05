import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

// Module 3H.1B.UI: visual "public profile" grouping — description is an
// existing supported field (ProviderLocation.description); name/website are
// echoed read-only from earlier steps. No new fields or persistence added.
export default function WizPublicProfile({ data, update, next }) {
  const loc = data.location;
  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Nume public</div>
        <div className="font-semibold">{loc.name || "—"}</div>
        {loc.website && <div className="text-sm text-muted-foreground mt-1">{loc.website}</div>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Descriere scurta (optional)</label>
        <textarea
          className={inputCls}
          rows={4}
          placeholder="Cateva randuri despre locatie, pentru pacienti"
          value={loc.description}
          onChange={(e) => update({ location: { ...loc, description: e.target.value } })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Nu vom publica automat informatiile trimise. Profilul public devine vizibil doar dupa verificare.
      </p>
      <ContinueButton onClick={next} />
    </div>
  );
}