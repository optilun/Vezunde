import { useEffect, useState } from "react";
import { loadNationalDirectoryMap } from "@/lib/nationalDirectoryMap";
import { loadNationalMapSnapshot } from "@/lib/nationalMapEarly";

const NONE = [];

// 2026-09-30. Punctele directorului national, pentru harta de pe /cauta cand e aleasa o localitate.
//
// Harta nu mai ramane goala cand vizitatorul o muta in alta zona: primeste restul locatiilor din
// director, ca puncte de context (vezi shared/searchMapArea.js). Sunt aceleasi date publice ca pe
// harta Romaniei, prin aceiasi incarcatori (fisierul static apare imediat, lista actuala il
// inlocuieste cand soseste; harta nu se muta din cauza lor). Cererea porneste abia dupa ce lista
// localitatii e pe ecran (`enabled`), ca rezultatele ei sa nu astepte nimic. Daca nu se pot incarca,
// harta ramane cu punctele localitatii, ca pana acum: contextul e un plus, nu o conditie.
export default function useDirectoryContextPoints(enabled) {
  const [points, setPoints] = useState(NONE);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let live = false;
    loadNationalMapSnapshot().then((snapshot) => {
      if (active && !live && Array.isArray(snapshot?.results)) setPoints(snapshot.results);
    });
    loadNationalDirectoryMap().then((data) => {
      if (!active) return;
      live = true;
      if (Array.isArray(data?.results)) setPoints(data.results);
    }).catch(() => {});
    return () => { active = false; };
  }, [enabled]);
  return enabled ? points : NONE;
}
