import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { clearRouteSeoOverride, setRouteSeoOverride } from "@/lib/routeSeoOverride";

// 2026-09-03. Pagina anunta ce a incarcat; RouteSeo, montat global, ramane singurul care
// scrie in document.head. Vezi src/lib/routeSeoOverride.js pentru de ce nu se monteaza o a
// doua instanta de RouteSeo.
//
// Dependenta e continutul serializat, nu obiectul: altfel un obiect nou la fiecare render
// ar reporni efectul la infinit. Metadatele de profil sunt cateva campuri de text plus un
// graf JSON-LD mic, deci costul e neglijabil.
export function useEntitySeo(meta) {
  const { pathname } = useLocation();
  const serialized = meta ? JSON.stringify(meta) : "";

  useEffect(() => {
    if (!serialized) return undefined;
    setRouteSeoOverride(pathname, JSON.parse(serialized));
    return () => clearRouteSeoOverride(pathname);
  }, [pathname, serialized]);
}

export default useEntitySeo;
