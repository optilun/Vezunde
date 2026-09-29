import { SERVICES, DIRECTORY_PROVIDER_FILTER_LABELS, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { CANONICAL_SERVICE_REGISTRY } from "@/lib/canonicalServiceCatalog";

// 2026-09-29 (audit /cauta, D3): mutat din Search.jsx, neschimbat. Il folosesc si pagina (la
// deschidere) si sincronizarea cu adresa (useSearchUrlSync).
export const serviceLabel = (key) => SERVICES[key] || CANONICAL_SERVICE_REGISTRY[key]?.label || "";

// Dintr-un link se pastreaza doar valorile cunoscute; restul (scrise gresit sau vechi) se ignora,
// ca pe ecran sa nu apara chei tehnice drept filtre.
export function knownLinkedState(state) {
  return {
    ...state,
    service: serviceLabel(state.service) ? state.service : "",
    providerType: state.providerType.split(",").filter((key) => DIRECTORY_PROVIDER_FILTER_LABELS[key]).join(","),
    filterServiceKeys: state.filterServiceKeys.filter((key) => CANONICAL_SERVICE_REGISTRY[key]),
    professionalType: PROFESSIONAL_TYPES[state.professionalType] ? state.professionalType : "",
  };
}
