import { base44 } from "@/api/base44Client";
import { createNationalMapLoader } from "@/lib/nationalDirectoryMapLoader";

export { NATIONAL_MAP_ERROR_MESSAGE } from "@/lib/nationalDirectoryMapLoader";

// Un singur incarcator pentru toata aplicatia: /cauta si pagina de rezultate impart aceeasi harta.
export const loadNationalDirectoryMap = createNationalMapLoader({
  invoke: (payload) => base44.functions.invoke("browseDirectoryProviders", payload),
});
