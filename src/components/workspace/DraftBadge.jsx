import React from "react";

export default function DraftBadge() {
  return (
    <div className="inline-flex flex-col gap-0.5 rounded-lg bg-secondary px-3 py-2 text-xs">
      <span className="font-semibold">Draft privat</span>
      <span className="text-muted-foreground">Va putea fi trimis spre review dupa aprobarea solicitarii.</span>
    </div>
  );
}