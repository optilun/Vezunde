import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { criteriaQuery, searchStateFromUrl, searchUrlFor } from "@/lib/searchUrl";
import { knownLinkedState, serviceLabel } from "@/lib/searchLinkedState";

// B4 (audit /cauta, 2026-09-28): adresa urmeaza criteriile asezate (fara intrari noi in istoric,
// fara derulare). Textul scris liber nu intra in adresa (poate descrie simptome); ramane in pagina
// si in sesiune.
// 2026-09-29 (audit /cauta, D3): mutat din Search.jsx. `onLinkedState(next)` primeste criteriile
// unui link deschis cat timp /cauta e deja pe ecran.
export default function useSearchUrlSync({ criteriaSearch, settling, onLinkedState }) {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const applyLinked = useRef(onLinkedState);
  applyLinked.current = onLinkedState;
  const writtenCriteria = useRef(criteriaQuery(window.location.search));
  const replaceCriteria = (criteria) => {
    writtenCriteria.current = criteria;
    navigate({ pathname: routerLocation.pathname, search: searchUrlFor(routerLocation.search, criteria), hash: routerLocation.hash }, { replace: true, state: routerLocation.state });
  };
  // Un link deschis cat timp /cauta e deja pe ecran (ex. „Caută un oftalmolog” din avertisment)
  // inlocuieste criteriile; un link simplu catre /cauta (meniul) pastreaza cautarea curenta.
  useEffect(() => {
    const incoming = criteriaQuery(routerLocation.search);
    if (incoming === writtenCriteria.current) return;
    if (!incoming) { if (criteriaSearch) replaceCriteria(criteriaSearch); else writtenCriteria.current = ""; return; }
    const next = knownLinkedState(searchStateFromUrl(routerLocation.search, serviceLabel));
    writtenCriteria.current = incoming;
    applyLinked.current(next);
    // Ruleaza doar cand se schimba adresa; criteriile curente sunt citite, nu urmarite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.search]);
  useEffect(() => {
    if (settling) return;
    if (criteriaQuery(routerLocation.search) === criteriaSearch) { writtenCriteria.current = criteriaSearch; return; }
    replaceCriteria(criteriaSearch);
    // Ruleaza doar cand se schimba criteriile; adresa curenta este citita, nu urmarita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaSearch, settling]);
}
