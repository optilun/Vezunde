// Starea blocului de upgrade (2026-08-22).
//
// Blocul apare plutitor peste modulul de leaduri, iar butonul care il recheama sta in bara
// de sus a spatiului de lucru - doua componente care nu se cunosc intre ele. In loc sa trec
// starea prin toata ierarhia, o tin intr-un magazin mic la nivel de modul: leadurile spun
// cand este relevant (plan fara Pro) si il deschid la intrare, bara de sus il poate
// redeschide, iar X-ul il inchide pana la urmatoarea intrare sau reincarcare.
//
// Nu retine nimic intre reincarcari - asta e intentionat: la fiecare intrare in modul si la
// fiecare refresh blocul apare din nou.
import { useEffect, useState } from "react";

let state = { available: false, open: false };
const listeners = new Set();

function publish(next) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

/** Leadurile anunta daca blocul are sens pentru locatia curenta. */
export function setUpgradeSpotlightAvailable(available) {
  const value = Boolean(available);
  if (state.available === value) return;
  publish({ available: value, open: value ? state.open : false });
}

export function openUpgradeSpotlight() {
  if (!state.available || state.open) return;
  publish({ ...state, open: true });
}

export function closeUpgradeSpotlight() {
  if (!state.open) return;
  publish({ ...state, open: false });
}

export function useUpgradeSpotlight() {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(state);
    return () => { listeners.delete(setSnapshot); };
  }, []);
  return snapshot;
}
