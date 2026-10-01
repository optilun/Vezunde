// Merge only the already-public directory projection. Missing pins never remove a card.
export function completeDirectoryRows(data) {
  const byId = new Map();
  for (const row of [...(data?.results || []), ...(data?.unmapped_results || [])]) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function directoryRowsInView(rows, { followViewport, visibleIds }) {
  if (!followViewport || visibleIds === null) return rows;
  const ids = new Set(visibleIds);
  return rows.filter(row => ids.has(row.id));
}
