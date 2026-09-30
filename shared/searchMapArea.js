import { boundsForPoints, framingForPoints, mapPointFromResult } from "./resultsMapPoints.js";

// 2026-09-30. Harta de pe /cauta „ca pe Airbnb”.
//
// Pana acum, dupa ce alegeai o localitate, harta avea doar punctele acelei localitati: daca o mutai
// in alta zona, ramanea goala, iar lista nu se schimba. Aici sta logica pura (fara React) pentru:
// - punctele de context: celelalte locatii din directorul national, puse pe harta langa rezultatele
//   cautarii, ca harta sa aiba puncte oriunde o duci. NU intra in lista, nu au numar, nu schimba
//   potrivirea, ordinea sau rezultatele; sunt doar geografie;
// - zona cautata: dreptunghiul localitatii (fara coordonatele aberante, ca la incadrarea hartii);
// - „am plecat din zona”: cand vizitatorul a mutat harta in alta parte sau a micsorat-o mult, pagina
//   ii propune „Caută în această zonă”.

/**
 * Rezultatele cautarii, urmate de restul punctelor din director (fara duplicate). Rezultatele
 * raman primele si neschimbate (ele poarta numarul si detaliile potrivirii); un punct din director
 * care exista deja intre rezultate nu se adauga a doua oara. Punctele fara pozitie valida nu se
 * adauga deloc.
 */
export function withDirectoryContext(results, directory) {
  const base = Array.isArray(results) ? results : [];
  const extra = [];
  const seen = new Set(base.map((row) => row?.id).filter(Boolean));
  for (const row of Array.isArray(directory) ? directory : []) {
    if (!row?.id || seen.has(row.id) || !mapPointFromResult(row)) continue;
    seen.add(row.id);
    extra.push(row);
  }
  return extra.length ? [...base, ...extra] : base;
}

/** Dreptunghiul zonei cautate ([[sud, vest], [nord, est]]) sau null. Coordonatele aberante nu il lungesc. */
export function searchAreaBounds(results) {
  const points = (Array.isArray(results) ? results : []).map(mapPointFromResult).filter(Boolean);
  if (points.length === 0) return null;
  return boundsForPoints(framingForPoints(points).points);
}

// Sub aceste dimensiuni (in grade, ~5,5 km si ~4 km) o zona se socoteste de marimea unui cartier:
// o localitate cu o singura locatie nu trebuie sa „piarda” zona la cea mai mica mutare.
export const AREA_MIN_LAT_SPAN = 0.05;
export const AREA_MIN_LNG_SPAN = 0.07;
// Centrul hartii poate iesi din zona cu un sfert din dimensiunea ei (pe fiecare parte) fara sa
// conteze ca s-a plecat din zona.
export const AREA_EDGE_SHARE = 0.25;
// Harta micsorata peste acest raport fata de zona (dimensiunea mai mare a dreptunghiului vizibil,
// in kilometri, impartita la a zonei) inseamna ca vizitatorul priveste regiunea, nu localitatea.
export const AREA_ZOOM_OUT_RATIO = 3;

function isBounds(bounds) {
  return Array.isArray(bounds) && bounds.length === 2
    && bounds.every((corner) => Array.isArray(corner) && corner.length === 2 && corner.every((value) => Number.isFinite(Number(value))));
}

/**
 * Vizitatorul a plecat din zona cautata? `viewportBounds` si `areaBounds` sunt
 * [[sud, vest], [nord, est]]. Adevarat cand centrul hartii a iesit din zona (cu marja) sau cand harta
 * arata o suprafata de peste AREA_ZOOM_OUT_RATIO ori zona. Fara date valide: fals.
 */
export function viewportLeftSearchArea(viewportBounds, areaBounds) {
  if (!isBounds(viewportBounds) || !isBounds(areaBounds)) return false;
  const [[viewSouth, viewWest], [viewNorth, viewEast]] = viewportBounds.map((corner) => corner.map(Number));
  const [[areaSouth, areaWest], [areaNorth, areaEast]] = areaBounds.map((corner) => corner.map(Number));
  const areaLat = Math.max(areaNorth - areaSouth, AREA_MIN_LAT_SPAN);
  const areaLng = Math.max(areaEast - areaWest, AREA_MIN_LNG_SPAN);
  const areaCenterLat = (areaSouth + areaNorth) / 2;
  const areaCenterLng = (areaWest + areaEast) / 2;
  const viewCenterLat = (viewSouth + viewNorth) / 2;
  const viewCenterLng = (viewWest + viewEast) / 2;
  const outsideLat = Math.abs(viewCenterLat - areaCenterLat) > areaLat / 2 + areaLat * AREA_EDGE_SHARE;
  const outsideLng = Math.abs(viewCenterLng - areaCenterLng) > areaLng / 2 + areaLng * AREA_EDGE_SHARE;
  if (outsideLat || outsideLng) return true;
  // Dimensiunile in kilometri, nu in grade: un grad de longitudine e mai scurt decat unul de latitudine.
  const cosine = Math.cos(((viewSouth + viewNorth) / 2) * Math.PI / 180);
  const viewMajor = Math.max(viewNorth - viewSouth, (viewEast - viewWest) * cosine);
  const areaMajor = Math.max(areaLat, areaLng * cosine);
  return viewMajor > AREA_ZOOM_OUT_RATIO * areaMajor;
}

export default { withDirectoryContext, searchAreaBounds, viewportLeftSearchArea };
