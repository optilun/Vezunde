// Presentation only: review progress never changes approval or prerequisite rules.
export function stableSignature(value) {
  if (Array.isArray(value)) return "[" + value.map(stableSignature).sort().join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableSignature(value[key])).join(",") + "}";
  return JSON.stringify(value ?? null);
}

export function reviewFingerprint(value) {
  const input = stableSignature(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function selectionChanges(before = [], after = [], label = value => value) {
  const oldSet = new Set(before);
  const newSet = new Set(after);
  return [
    ...[...newSet].filter(key => !oldSet.has(key)).map(key => ({ key, label: label(key), kind: "added" })),
    ...[...oldSet].filter(key => !newSet.has(key)).map(key => ({ key, label: label(key), kind: "removed" })),
  ];
}

export function getEditorStatus({ saving, error, dirty, pendingReview, hasDraft, hasChanges, approvedCount }) {
  if (error) return { tone: "error", title: "Modificările nu au fost confirmate", detail: error };
  if (saving) return { tone: "info", title: "Se salvează…", detail: "Așteaptă confirmarea înainte să închizi pagina." };
  if (dirty) return { tone: "warning", title: "Ai modificări nesalvate", detail: "Salvează progresul ca să îl poți relua mai târziu." };
  if (pendingReview) return { tone: "pending", title: "Cererea este în verificare", detail: "Poți salva alte modificări. Le trimiți după soluționarea cererii curente." };
  if (hasDraft && hasChanges) return { tone: "ready", title: "Modificările sunt salvate", detail: "Verifică rezumatul, apoi trimite spre aprobare." };
  if (approvedCount > 0) return { tone: "live", title: "Oferta este la zi", detail: "Serviciile aprobate sunt păstrate. Poți modifica orice secțiune." };
  return { tone: "info", title: "Configurează oferta locației", detail: "Alege spațiile existente și serviciile pe care le oferi." };
}

// A failed or rejected save must never mark a step reviewed or advance navigation.
export async function saveBeforeContinuing({ dirty, save, onSuccess }) {
  try {
    if (dirty && await save() !== true) return false;
    onSuccess?.();
    return true;
  } catch {
    return false;
  }
}
