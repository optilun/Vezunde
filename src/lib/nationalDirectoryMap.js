import { base44 } from "@/api/base44Client";
import { createNationalMapLoader } from "@/lib/nationalDirectoryMapLoader";
import { withPatientOperationTimeout } from "@/lib/patientOperationControl";
import { DIRECTORY_BROWSE_TIMEOUT_MS } from "@/lib/directoryBrowse";

export { NATIONAL_MAP_ERROR_MESSAGE } from "@/lib/nationalDirectoryMapLoader";

// Un singur incarcator pentru toata aplicatia: /cauta si pagina de rezultate impart aceeasi harta.
export const loadNationalDirectoryMap = createNationalMapLoader({
  // 2026-09-27 (audit /cauta, A5): fiecare incercare se opreste dupa 20 s; incarcatorul o considera
  // eroare trecatoare si reincearca (vezi isRetryableMapError), apoi arata mesajul cu „Reîncearcă”.
  invoke: (payload) => withPatientOperationTimeout(
    () => base44.functions.invoke("browseDirectoryProviders", payload),
    { timeoutMs: DIRECTORY_BROWSE_TIMEOUT_MS, operation: "national_directory_map" },
  ),
});
