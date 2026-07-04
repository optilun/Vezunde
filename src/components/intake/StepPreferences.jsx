import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { PREFERENCE_OPTIONS } from "@/lib/intake";

const NONE = "Nu am preferinte";

export default function StepPreferences({ data, update, onNext }) {
  const toggle = (pref) => {
    if (pref === NONE) {
      update({ preferences: [NONE] });
      return;
    }
    const current = data.preferences.filter((p) => p !== NONE);
    update({
      preferences: current.includes(pref) ? current.filter((p) => p !== pref) : [...current, pref],
    });
  };

  return (
    <div>
      <div className="space-y-3">
        {PREFERENCE_OPTIONS.map((pref) => (
          <ChoiceCard
            key={pref}
            label={pref}
            selected={data.preferences.includes(pref)}
            onClick={() => toggle(pref)}
          />
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.preferences.length === 0}>
        Vezi rezultatele
      </ContinueButton>
    </div>
  );
}