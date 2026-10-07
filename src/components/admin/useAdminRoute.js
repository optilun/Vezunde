import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { resolveAdminTarget } from "@/lib/adminNavConfig";

// Starea panoului de admin trăiește în adresă (?s=secțiune&t=sub-tab&id=element), nu în useState
// (2026-10-07). Efect: butonul Înapoi și refresh-ul rămân în același loc, ecranele pot fi puse în
// favorite sau trimise ca link, iar o secțiune se poate deschide în alt tab de browser.
export function useAdminRoute() {
  const [params, setParams] = useSearchParams();
  const section = params.get("s") || "";
  const tab = params.get("t") || "";
  const id = params.get("id") || "";

  const route = useMemo(() => {
    const target = resolveAdminTarget(section, tab);
    return { section: target.section, tab: target.tab, id };
  }, [section, tab, id]);

  const go = useCallback((nextSection, nextTab = "", nextId = "", { replace = false } = {}) => {
    const target = resolveAdminTarget(nextSection, nextTab);
    const next = new URLSearchParams();
    if (target.section !== "dashboard") next.set("s", target.section);
    if (target.tab) next.set("t", target.tab);
    if (nextId) next.set("id", String(nextId));
    setParams(next, { replace });
  }, [setParams]);

  return { ...route, go };
}

// Sub-tab-ul curent al secțiunii. Un sub-tab necunoscut cade pe cel implicit.
// Al treilea element: `explicit` = adresa conține deja un sub-tab ales (nu cel implicit din lipsă).
export function useAdminSubTab(validKeys, defaultKey) {
  const { section, tab, go } = useAdminRoute();
  const explicit = validKeys.includes(tab);
  const value = explicit ? tab : defaultKey;
  const setValue = useCallback(
    (key, options) => go(section, key === defaultKey ? "" : key, "", options),
    [go, section, defaultKey],
  );
  return [value, setValue, { explicit }];
}

// Elementul deschis în detaliu (ex. o campanie, un profil de research), păstrat în adresă.
export function useAdminSelectedId() {
  const { section, tab, id, go } = useAdminRoute();
  const setId = useCallback((nextId) => go(section, tab, nextId || ""), [go, section, tab]);
  return [id, setId];
}
