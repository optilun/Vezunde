import { base44 } from "@/api/base44Client";
import { withPatientOperationTimeout } from "@/lib/patientOperationControl";

// 2026-09-27 (audit /cauta, A5). Cererile catre directorul public (browseDirectoryProviders) nu
// aveau limita de timp: un apel blocat lasa „Se încarcă…” pe ecran la nesfarsit, fara „Reîncearcă”.
// Acum orice apel se opreste dupa DIRECTORY_BROWSE_TIMEOUT_MS si intra pe calea de eroare deja
// existenta (mesaj + reincercare). Potrivirea are propriul prag (15 s, providerSemanticSearch.js).
export const DIRECTORY_BROWSE_TIMEOUT_MS = 20_000;

export function invokeDirectoryBrowse(payload, operation = "browse_directory") {
  return withPatientOperationTimeout(
    () => base44.functions.invoke("browseDirectoryProviders", payload),
    { timeoutMs: DIRECTORY_BROWSE_TIMEOUT_MS, operation },
  );
}
