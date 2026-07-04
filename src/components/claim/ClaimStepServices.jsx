import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { SERVICES } from "@/lib/vezunde";
import { SERVICE_GROUPS } from "@/lib/claimConfig";

export default function ClaimStepServices({ data, update, onNext }) {
  const toggle = (key) => {
    update({
      services: data.services.includes(key)
        ? data.services.filter((s) => s !== key)
        : [...data.services, key],
    });
  };

  return (
    <div>
      <div className="space-y-6">
        {SERVICE_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{group.title}</div>
            <div className="flex flex-wrap gap-2">
              {group.keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                    data.services.includes(key)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:border-foreground/40"
                  }`}
                >
                  {SERVICES[key]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.services.length === 0} />
    </div>
  );
}