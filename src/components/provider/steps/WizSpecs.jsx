import React from "react";
import ToggleChip from "@/components/provider/ToggleChip";
import ContinueButton from "@/components/intake/ContinueButton";
import { SPECIALIZATIONS } from "@/lib/providerTaxonomy";

export default function WizSpecs({ data, update, next }) {
  const toggle = (key) => {
    const selected = data.specializations.includes(key)
      ? data.specializations.filter((k) => k !== key)
      : [...data.specializations, key];
    update({ specializations: selected });
  };
  return (
    <div className="text-left">
      <div className="flex flex-wrap gap-2">
        {Object.entries(SPECIALIZATIONS).map(([key, label]) => (
          <ToggleChip key={key} label={label} selected={data.specializations.includes(key)} onClick={() => toggle(key)} />
        ))}
      </div>
      <ContinueButton onClick={next} />
    </div>
  );
}