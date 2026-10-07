import React from "react";
import { Building2, History, MapPin, UploadCloud } from "lucide-react";

// Ecranele care nu au loc permanent în meniu (2026-09-12), ca legături scurte, nu ca plăci mari.
// Sunt singura cale spre ele, deci rămân mereu aici. (Înlocuiește QuickActionsGrid: 3 din cele 6
// plăci vechi dublau meniul.)
const LINKS = [
  { icon: Building2, label: "Adaugă locație", section: "adauga" },
  { icon: UploadCloud, label: "Import director", section: "import_directory" },
  { icon: MapPin, label: "Actualizează SIRUTA", section: "geografie" },
  { icon: History, label: "Istoric audit", section: "audit" },
];

export default function QuickLinks({ onNavigate }) {
  return (
    <div>
      <h2 className="mb-2 font-heading text-sm font-bold">Alte ecrane</h2>
      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <button
            key={link.section}
            type="button"
            onClick={() => onNavigate(link.section)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            <link.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
