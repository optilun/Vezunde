import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizSchedule({ data, update, next }) {
  const s = data.schedule;
  const set = (k, v) => update({ schedule: { ...s, [k]: v } });
  return (
    <div className="space-y-3 text-left">
      <input className={inputCls} placeholder="Program (ex: L-V 9:00-18:00)" value={s.opening_hours} onChange={(e) => set("opening_hours", e.target.value)} />
      <input className={inputCls} placeholder="Program sambata (optional)" value={s.saturday_hours} onChange={(e) => set("saturday_hours", e.target.value)} />
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer pt-1">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4"
          checked={s.availability_confirmed}
          onChange={(e) => set("availability_confirmed", e.target.checked)}
        />
        <span>Confirm ca disponibilitatea declarata mai jos este actuala</span>
      </label>
      {s.availability_confirmed && (
        <select className={inputCls} value={s.availability_status} onChange={(e) => set("availability_status", e.target.value)}>
          <option value="">Alege disponibilitatea</option>
          {Object.entries(AVAILABILITY_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )}
      <ContinueButton onClick={next} />
    </div>
  );
}