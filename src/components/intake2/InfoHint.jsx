import React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 2026-09-27, cererea owner-ului: cardurile chestionarului aratau prea mult text deodata.
// Explicatiile raman disponibile, dar se deschid cu butonul "i" (atingere, click sau tastatura).
// Pe card ramane doar ce e necesar pentru a raspunde.
export default function InfoHint({ items = [], label = "Mai multe informații", className = "" }) {
  const paragraphs = (Array.isArray(items) ? items : [items])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      {/* collisionPadding: pe telefon fereastra ramane la 16px de marginea ecranului (test live,
          2026-09-27: la 375px lipea de marginea din dreapta). */}
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className="w-[min(20rem,calc(100vw-2rem))] space-y-2 text-sm font-normal leading-relaxed tracking-normal text-muted-foreground"
      >
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
