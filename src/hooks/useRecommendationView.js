import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";

// Vederea ecranului de recomandari (2026-09-30), mutata din pagina RequestMatches fara schimbari de
// comportament: ce a ales pacientul (locatia selectata, modul Locatii / Specialisti, lista sau harta
// pe telefon, „doar zona de pe harta”, filtrele din bara) si cat a derulat, salvate O SINGURA DATA in
// sesiune (`recommendations`, cu cheia vederii) si regasite la intoarcerea dintr-un profil.
//
// Nu tine nimic despre rezultate: lista, ordinea, Top 3 si cererea raman in pagina si in MatchResults.
// Nu cheama serverul.

export default function useRecommendationView({ hasResults }) {
  const location = useLocation();
  const navigate = useNavigate();
  const viewKey = useRef(location.state?.resultsViewKey || location.key).current;
  const restored = useRef(readSearchSession().recommendations).current;
  const savedView = restored?.key === viewKey ? restored : {};
  const restoreScroll = useRef(savedView.scrollTop || 0);
  const initialSelection = useRef(true);
  const listRef = useRef(null);

  const [selectedId, setSelectedId] = useState(savedView.selectedId || null);
  const [resultMode, setResultMode] = useState(savedView.mode === "professionals" ? "professionals" : "locations");
  const [mobileView, setMobileView] = useState(savedView.mobileView === "map" ? "map" : "list");
  const [filterToViewport, setFilterToViewport] = useState(savedView.filterToViewport === true);
  // Filtrele din bara (tip locatie, doar verificate) se pastreaza la intoarcerea dintr-un profil.
  const [listFilters, setListFilters] = useState(savedView.filters || null);

  const saveView = useCallback(() => {
    writeSearchSession({ recommendations: {
      key: viewKey, selectedId, mode: resultMode, mobileView, filterToViewport, filters: listFilters,
      scrollTop: restoreScroll.current || listRef.current?.scrollTop || 0,
    } });
  }, [viewKey, selectedId, resultMode, mobileView, filterToViewport, listFilters]);
  useEffect(() => { saveView(); }, [saveView]);
  // Cheia vederii ajunge in starea rutei (inlocuire, fara o intrare noua in istoric), ca la intoarcerea
  // dintr-un profil sa se regaseasca vederea salvata.
  useEffect(() => {
    if (!hasResults) return;
    if (location.state?.resultsViewKey !== viewKey) {
      navigate(location.pathname, { replace: true, state: { ...location.state, resultsViewKey: viewKey } });
    }
  }, [hasResults, viewKey, location.pathname, location.state, navigate]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !restoreScroll.current) return;
    const apply = () => {
      const target = restoreScroll.current;
      if (!target) return;
      list.scrollTop = target;
      if (Math.abs(list.scrollTop - target) < 2) restoreScroll.current = 0;
    };
    const observer = new ResizeObserver(apply);
    if (list.firstElementChild) observer.observe(list.firstElementChild);
    const stop = () => { restoreScroll.current = 0; observer.disconnect(); };
    list.addEventListener("wheel", stop, { passive: true });
    list.addEventListener("touchstart", stop, { passive: true });
    const frame = requestAnimationFrame(apply);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); list.removeEventListener("wheel", stop); list.removeEventListener("touchstart", stop); };
  }, []);


  // Cand alegi o locatie (pe harta sau din lista), lista se deruleaza pana la cardul ei.
  useEffect(() => {
    if (initialSelection.current) { initialSelection.current = false; return; }
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const card = [...(list?.querySelectorAll("[data-result-location-id]") || [])].find(node => node.dataset.resultLocationId === selectedId);
      if (!card || !list) return;
      const parent = list.getBoundingClientRect();
      const item = card.getBoundingClientRect();
      if (item.top < parent.top || item.bottom > parent.bottom) list.scrollTop += item.top - parent.top - 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, mobileView]);

  return {
    viewKey,
    savedView,
    listRef,
    saveView,
    selectedId, setSelectedId,
    resultMode, setResultMode,
    mobileView, setMobileView,
    filterToViewport, setFilterToViewport,
    listFilters, setListFilters,
  };
}
