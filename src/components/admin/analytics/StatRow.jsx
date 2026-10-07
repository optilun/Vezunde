import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const fmt = (value) => (value === null || value === undefined ? "indisponibil" : Number(value).toLocaleString("ro-RO", { maximumFractionDigits: 1 }));

// Săgeata de lângă cifră: cu cât s-a schimbat față de perioada de dinainte (`since`, ex. „cele 30 de zile dinainte”).
function Change({ change, since }) {
  if (!change) return null;
  const { diff } = change;
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
  const tone = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-muted-foreground";
  const text = diff === 0 ? "la fel" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("ro-RO")}`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", tone)} title={since ? `Față de ${since}` : undefined}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {text}
      {since && <span className="sr-only"> față de {since}</span>}
    </span>
  );
}

export default function StatRow({ label, value, onClick = undefined, change = undefined, changeSince = undefined }) {
  const Tag = onClick ? "button" : "div";
  const unavailable = value === null || value === undefined;
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm", onClick && "transition-colors hover:bg-secondary")}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <Change change={change} since={changeSince} />
        <span className={cn("tabular-nums", unavailable ? "text-xs text-muted-foreground" : "font-semibold")}>{fmt(value)}</span>
      </span>
    </Tag>
  );
}
