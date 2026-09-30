// Grila de rezultate a directorului, definita o singura data (2026-09-30).
//
// Cardurile de pe /cauta stau intr-o grila cu linii fine intre celule, nu in carduri rotunjite
// separate. Recomandarile clientului (dupa cerere) folosesc acum acelasi card, deci si aceeasi grila:
// clasele stau aici, ca cele doua ecrane sa nu se departeze din nou.
//
// `hasPositions` = lista sta alaturi de harta (pe ecrane late harta ia jumatate din latime, deci
// lista are o singura coloana la `lg` si doua la `xl`).

export function resultGridClassName(hasPositions) {
  return hasPositions
    ? "grid border-t border-border sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
    : "grid border-t border-border sm:grid-cols-2";
}

// Celula unui card: linia de jos, linia din dreapta pe coloana din stanga, fundalul la selectie si
// hover. `group/cell` si `data-selected` (puse de apelant) schimba culorile din interiorul cardului.
export function resultCellClassName({ hasPositions, selected = false, hovered = false }) {
  const rightLine = hasPositions
    ? "sm:odd:border-r lg:odd:border-r-0 xl:odd:border-r"
    : "sm:odd:border-r";
  const background = selected ? "bg-[#eaeff7]" : hovered ? "bg-white/70" : "";
  return `group/cell h-full border-b border-border transition-colors ${rightLine} ${background}`;
}
