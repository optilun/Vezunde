import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Stare de încărcare comună (2026-10-07): în loc de text gol („Se incarca...”), rânduri-fantomă
// care păstrează forma paginii și un anunț pentru cititoarele de ecran.
export default function AdminLoading({ label = "Se încarcă…", rows = 3 }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}
