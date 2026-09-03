// Un singur scriitor in document.head, cu suprascriere per entitate.
//
// 2026-09-03. Paginile de profil aveau nevoie de title, description si JSON-LD proprii,
// dar RouteSeo e montat o singura data, global, in App.jsx si nu primeste nimic.
// OrganizationProfile.jsx incercase deja varianta evidenta - `<RouteSeo title=... />` -
// iar rezultatul e instructiv: RouteSeo e declarat fara parametri, deci props-urile erau
// ignorate tacut, si pe ruta aceea ajunsesera doua instante care scriau in acelasi head.
//
// De aceea nu se monteaza a doua instanta. Pagina anunta ce a incarcat, iar instanta
// globala ramane singurul loc care atinge head-ul. Suprascrierea e legata de pathname:
// daca navighezi mai departe inainte ca datele sa ajunga, raspunsul intarziat nu mai
// suprascrie pagina noua.

let current = null;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

export function setRouteSeoOverride(pathname, meta) {
  const path = String(pathname || '');
  if (!path || !meta) return;
  current = { pathname: path, meta };
  notify();
}

export function clearRouteSeoOverride(pathname) {
  const path = String(pathname || '');
  if (!current || (path && current.pathname !== path)) return;
  current = null;
  notify();
}

export function getRouteSeoOverride() {
  return current;
}

export function subscribeRouteSeoOverride(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
