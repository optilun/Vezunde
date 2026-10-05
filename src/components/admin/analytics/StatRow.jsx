import React from "react";

export const fmt = (value) => (value === null || value === undefined ? "indisponibil" : value.toLocaleString("ro-RO"));

export default function StatRow({ label, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary">
      <span className="text-muted-foreground">{label}</span>
      <span className={value === null ? "text-xs text-muted-foreground" : "font-semibold"}>{fmt(value)}</span>
    </Tag>
  );
}