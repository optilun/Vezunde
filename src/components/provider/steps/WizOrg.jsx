import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizOrg({ data, update, next }) {
  const org = data.organization;
  const loc = data.location;
  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Nume organizatie *" value={org.name} onChange={(e) => update({ organization: { ...org, name: e.target.value } })} />
      <input className={inputCls} placeholder="Nume locatie *" value={loc.name} onChange={(e) => update({ location: { ...loc, name: e.target.value } })} />
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer pt-1">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4"
          checked={org.multi_location}
          onChange={(e) => update({ organization: { ...org, multi_location: e.target.checked } })}
        />
        <span>Face parte dintr-o organizatie cu mai multe locatii</span>
      </label>
      <ContinueButton onClick={next} disabled={!org.name.trim() || !loc.name.trim()} />
    </div>
  );
}