// Profilurile deschise in aceasta sesiune a browserului (fila curenta), ca pe Airbnb: pinul unei
// locatii deja vazute devine gri pe harta. Nu pleaca nicaieri (doar sessionStorage), nu se
// pastreaza dupa inchiderea filei si nu influenteaza ordinea sau potrivirea.
const KEY = "viasee.visitedProfiles.v1";
const LIMIT = 200;

export function readVisitedProfiles() {
  try {
    const list = JSON.parse(window.sessionStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string" && id) : []);
  } catch {
    return new Set();
  }
}

export function markProfileVisited(id) {
  if (!id) return;
  try {
    const list = [...readVisitedProfiles()].filter((item) => item !== String(id));
    list.push(String(id));
    window.sessionStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // Stocarea poate lipsi (fereastra privata, setari stricte): pinul ramane doar nevizitat.
  }
}
