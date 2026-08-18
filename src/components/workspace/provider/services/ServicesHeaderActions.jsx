// Actiunile ecranului de servicii, in antet, sus-dreapta (2026-08-18). Inainte stateau
// intr-o bara la baza continutului care arata ca un card plutit. Logica nu se schimba:
// apeleaza aceleasi handlere expuse prin snapshot (salvare, trimitere, retragere).
import React from "react";
import { Save, Send, X } from "lucide-react";

export default function ServicesHeaderActions({ snapshot }) {
  if (!snapshot) return null;
  const { hasSave, hasSubmit, hasWithdraw, canSave, canSubmit, canWithdraw, saving } = snapshot;
  if (!hasSave && !hasSubmit && !hasWithdraw) return null;

  return (
    <div className="services-header-actions" data-tone={snapshot.actionTone || "info"}>
      <div className="services-header-actions__buttons">
        {hasSave && (
          <button
            type="button"
            className="services-header-actions__btn"
            disabled={!canSave || saving}
            onClick={snapshot.onSave}
          >
            <Save aria-hidden="true" /> Salvează draftul
          </button>
        )}
        {hasSubmit && (
          <button
            type="button"
            className="services-header-actions__btn is-primary"
            disabled={!canSubmit || saving}
            title={snapshot.dirty ? "Salvează modificările înainte de trimitere" : ""}
            onClick={snapshot.onSubmit}
          >
            <Send aria-hidden="true" /> Trimite spre aprobare
          </button>
        )}
        {hasWithdraw && (
          <button
            type="button"
            className="services-header-actions__btn"
            disabled={!canWithdraw || saving}
            onClick={snapshot.onWithdraw}
          >
            <X aria-hidden="true" /> Retrage cererea
          </button>
        )}
      </div>
      <p className="services-header-actions__status">
        <strong>{snapshot.actionStatus}</strong>
        {snapshot.actionMessage && <span>{snapshot.actionMessage}</span>}
      </p>
    </div>
  );
}