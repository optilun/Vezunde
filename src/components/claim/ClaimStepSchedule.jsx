import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

export default function ClaimStepSchedule({ data, update, onNext }) {
  return (
    <div className="space-y-4">
      <input
        value={data.opening_hours}
        onChange={(e) => update({ opening_hours: e.target.value })}
        placeholder="Program (ex: L-V 9:00-18:00)"
        className={FIELD}
      />
      <input
        value={data.saturday_hours}
        onChange={(e) => update({ saturday_hours: e.target.value })}
        placeholder="Program sambata (ex: S 10:00-14:00 sau Inchis)"
        className={FIELD}
      />
      <input
        value={data.availability_note}
        onChange={(e) => update({ availability_note: e.target.value })}
        placeholder="Disponibilitate estimata (ex: programari in 1-2 zile)"
        className={FIELD}
      />
      <ContinueButton onClick={() => onNext()} disabled={!data.opening_hours.trim()} />
    </div>
  );
}