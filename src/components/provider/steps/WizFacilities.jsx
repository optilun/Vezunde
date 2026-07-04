import React from "react";
import ToggleChip from "@/components/provider/ToggleChip";
import ContinueButton from "@/components/intake/ContinueButton";
import { FACILITIES } from "@/lib/vezunde";

export default function WizFacilities({ data, update, next }) {
  const toggle = (key) => {
    const selected = data.facilities.includes(key)
      ? data.facilities.filter((k) => k !== key)
      : [...data.facilities, key];
    update({ facilities: selected });
  };
  return (
    <div className="text-left">
      <div className="flex flex-wrap gap-2">
        {Object.entries(FACILITIES).map(([key, label]) => (
          <ToggleChip key={key} label={label} selected={data.facilities.includes(key)} onClick={() => toggle(key)} />
        ))}
      </div>
      <ContinueButton onClick={next} />
    </div>
  );
}