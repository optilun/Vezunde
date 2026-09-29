import { mapMarkerLabel, shortTypeLabel } from "./resultsMapLabels.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

// Small line icons in the same visual family as LocationThumb.
function markerIcon(type) {
  const paths = type === "optica_medicala" || type === "laborator_optic"
      ? '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2 15l2-9h3m15 9-2-9h-3"/>'
      : type === "clinica_oftalmologica"
        ? '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 21v-5h6v5M12 6v6m-3-3h6"/>'
        : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';
  return '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
}

// Marimea cercului unui grup creste cu numarul de locatii din el (vezi mapMarkers.css).
export function clusterSizeClass(count) {
  if (count >= 200) return "xl";
  if (count >= 50) return "l";
  if (count >= 10) return "m";
  return "s";
}

// 2026-09-27. Pinii noi, in stilul hartilor de cautare (Airbnb):
// - un grup este un cerc cu numarul de locatii, mai mare cand grupul e mai dens;
// - o locatie este o pastila alba cu pictograma tipului si numele; cand nu e loc, ramane doar
//   pictograma (numele apare la trecerea cu mouse-ul si la selectie);
// - `map_rank` (ordinea din lista potrivirii) inlocuieste pictograma cu numarul din lista;
// - `visited` (profil deschis in aceasta sesiune) face pinul gri;
// - pozitia aproximativa nu mai are contur punctat pe harta: se spune in cardul locatiei.
//   Atributul `data-approximate` ramane pentru cititoare si teste, fara stil propriu.
export function pillHtml(cluster, { active = false, hovered = false } = {}) {
  const group = cluster.count > 1;
  const lead = cluster.lead;
  const type = shortTypeLabel(lead.provider_type);
  const rank = !group && Number.isInteger(lead.map_rank) && lead.map_rank > 0 ? lead.map_rank : null;
  const accessible = group ? `Explorează grupul de ${cluster.count} locații` : `${rank ? `${rank}. ` : ""}${lead.name}, ${type}`;
  const badge = group ? ""
    : rank ? `<span class="viasee-marker-rank">${rank}</span>`
      : `<span class="viasee-marker-icon">${markerIcon(lead.provider_type)}</span>`;
  return `<span class="viasee-marker" data-map-marker="${escapeHtml(cluster.key)}"
    data-request="${!group && lead.is_request_result === true}" data-group="${group}" data-active="${active}" data-hovered="${hovered}"
    data-top="${!group && lead.tier === "top3"}" data-approximate="${!group && lead.map_precision !== "exact"}"
    data-visited="${!group && lead.visited === true}" data-ranked="${Boolean(rank)}" data-size="${group ? clusterSizeClass(cluster.count) : "one"}"
    data-label="${escapeHtml(accessible)}" data-compact="false">
    ${badge}
    <span class="viasee-marker-name">${escapeHtml(group ? String(cluster.count) : mapMarkerLabel(cluster))}</span>
  </span>`;
}

// Screen-space label decisions only. Never remove points, alter coordinates or counts.
export function compactMarkerKeys(items, gap = 6) {
  const kept = [];
  const compact = new Set();
  const sorted = [...items].sort((a, b) => b.priority - a.priority || String(a.key).localeCompare(String(b.key)));
  for (const item of sorted) {
    const overlaps = kept.some(other =>
      item.left < other.right + gap && item.right + gap > other.left &&
      item.top < other.bottom + gap && item.bottom + gap > other.top);
    if (overlaps && !item.pinned && !item.group) compact.add(item.key);
    else kept.push(item);
  }
  return compact;
}

export function layoutMapMarkers(container) {
  if (!container?.querySelectorAll) return;
  const pills = [...container.querySelectorAll("[data-map-marker]")];
  // Batch writes, then reads: no repeated forced layout per marker.
  pills.forEach(pill => { pill.dataset.compact = "false"; });
  const bounds = container.getBoundingClientRect();
  const items = pills.map(pill => {
    const root = pill.closest(".viasee-map-pill, .viasee-vector-marker");
    const active = pill.dataset.active === "true";
    const hovered = pill.dataset.hovered === "true" || root?.matches(":hover, :focus-visible");
    const group = pill.dataset.group === "true";
    const rect = pill.getBoundingClientRect();
    return { pill, root, key: pill.dataset.mapMarker, group, pinned: active || hovered,
      priority: active ? 5 : hovered ? 4 : group ? 3 : pill.dataset.top === "true" ? 2 : 1,
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  const visible = items.filter(item => item.right >= bounds.left && item.left <= bounds.right && item.bottom >= bounds.top && item.top <= bounds.bottom);
  const compact = compactMarkerKeys(visible);
  items.forEach(item => {
    const collapsed = compact.has(item.key);
    item.pill.dataset.compact = String(collapsed);
    if (item.root) {
      item.root.style.zIndex = String(item.pinned ? 40 : collapsed ? 1 : item.group ? 15 : 10);
      item.root.setAttribute("aria-label", item.pill.dataset.label);
      item.root.setAttribute("aria-pressed", item.pill.dataset.active);
    }
  });
}
