import React from "react";
import ToggleChip from "@/components/provider/ToggleChip";
import ContinueButton from "@/components/intake/ContinueButton";
import { SERVICES } from "@/lib/vezunde";
import { INVESTIGATIONS } from "@/lib/providerTaxonomy";

export default function WizServices({ data, update, next }) {
  const toggle = (key) => {
    const selected = data.services.includes(key)
      ? data.services.filter((k) => k !== key)
      : [...data.services, key];
    update({ services: selected });
  };
  const generalServices = Object.entries(SERVICES).filter(([k]) => !INVESTIGATIONS[k]);
  return (
    <div className="text-left">
      <div className="flex flex-wrap gap-2">
        {generalServices.map(([key, label]) => (
          <ToggleChip key={key} label={label} selected={data.services.includes(key)} onClick={() => toggle(key)} />
        ))}
      </div>
      <div className="mt-5 text-sm font-semibold">Investigatii</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(INVESTIGATIONS).map(([key, label]) => (
          <ToggleChip key={key} label={label} selected={data.services.includes(key)} onClick={() => toggle(key)} />
        ))}
      </div>
      <ContinueButton onClick={next} disabled={data.services.length === 0} />
    </div>
  );
}