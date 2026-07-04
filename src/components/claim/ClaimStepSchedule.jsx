import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

const AVAILABILITY_OPTIONS = [
  { key: "astazi", label: "Putem primi pacienti astazi" },
  { key: "urmatoarele_zile", label: "In urmatoarele zile" },
  { key: "saptamana_aceasta", label: "Saptamana aceasta" },
  { key: "doar_programare", label: "Doar cu programare" },
  { key: "necunoscuta", label: "Prefer sa nu estimez" },
];

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
      <div>
        <div className="text-sm font-medium mb-2">Disponibilitate estimata</div>
        <div className="space-y-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update({ availability_status: opt.key })}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                data.availability_status === opt.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Disponibilitatea este afisata pacientilor doar cat timp este actuala.
        </p>
      </div>
      <ContinueButton onClick={() => onNext()} disabled={!data.opening_hours.trim()} />
    </div>
  );
}