import React from "react";

export default function InboxFilters({ filter, search, status, onChange, onSearch, onStatus }) {
  return <div className="inbox-filters">
    <div className="inbox-tabs" aria-label="Filtre cereri">{[["active", "Active"], ["unread", "Necitite"], ["history", "Încheiate"]].map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => onChange(key)}>{label}</button>)}</div>
    <input className="inbox-search" type="search" aria-label="Caută cereri" placeholder="Caută cereri…" value={search} onChange={event => onSearch(event.target.value)} />
    {filter !== "history" && <select className="inbox-filter-select" aria-label="Starea cererii" value={status} onChange={event => onStatus(event.target.value)}>{[["", "Toate stările"], ["new", "Cereri noi"], ["viewed", "Văzute"], ["interested", "Putem ajuta"], ["needs_details", "Detalii necesare"], ["declined", "Nu putem ajuta"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}
  </div>;
}
