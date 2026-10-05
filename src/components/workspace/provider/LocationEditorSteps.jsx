import React from "react";
import "./ProviderLocationEditor.css";

export default function LocationEditorSteps({ label, steps, active, onChange, disabled = false }) {
  return <nav className="location-editor-steps" aria-label={label}>
    {steps.map((step, index) => <button key={step.id} type="button"
      aria-current={active === step.id ? "step" : undefined}
      disabled={disabled || step.disabled} onClick={() => onChange?.(step.id)}>
      <span className="location-editor-steps__number">{String(index + 1).padStart(2, "0")}</span>
      <span><strong>{step.label}</strong>{step.detail && <small>{step.detail}</small>}</span>
    </button>)}
  </nav>;
}
