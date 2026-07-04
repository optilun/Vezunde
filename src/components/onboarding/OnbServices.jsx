import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { SERVICES } from "@/lib/vezunde";

export default function OnbServices({ data, update, onNext }) {
  const toggle = (key) => {
    update({
      services: data.services.includes(key)
        ? data.services.filter((s) => s !== key)
        : [...data.services, key],
    });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(SERVICES).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              data.services.includes(key)
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.services.length === 0} />
    </div>
  );
}