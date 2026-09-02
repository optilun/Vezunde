import React from "react";
import { CheckCircle2, Clock3, MapPin, MessageCircle, Send, Store } from "lucide-react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function RequestWorkspaceTimeline({ request, lifecycle, responses = [], resultCount = 0 }) {
  const events = [
    {
      key: "submitted",
      icon: Send,
      title: "Cererea a fost trimisa",
      description: request?.city ? `Cererea este asociata localitatii ${request.city}.` : "Cererea a fost salvata in VIASEE.",
      date: request?.submitted_at,
    },
    {
      key: "prepared",
      icon: Store,
      title: "Locațiile potrivite sunt disponibile",
      description: resultCount > 0
        ? `Am găsit ${resultCount} locații care corespund criteriilor selectate.`
        : "Rezultatele cererii sunt disponibile în secțiunea Locații.",
      date: request?.submitted_at,
    },
    ...responses.map((response) => ({
      key: `response-${response.location_id}`,
      icon: MessageCircle,
      title: `${response.location_name} a trimis un răspuns`,
      description: response.response_label || "Răspuns disponibil",
      date: response.submitted_at,
    })),
  ];

  if (lifecycle?.terminal) {
    events.push({
      key: "terminal",
      icon: CheckCircle2,
      title: `Cererea este ${String(lifecycle.state_label || lifecycle.state || "finalizata").toLowerCase()}`,
      description: "Nu mai sunt permise răspunsuri sau mesaje noi. Istoricul rămâne vizibil.",
      date: request?.resolved_at || request?.closed_at || request?.expires_at,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-extrabold text-foreground">Cronologia cererii</h3>
      </div>
      <div className="mt-4 space-y-4">
        {events.map((event, index) => {
          const Icon = event.icon;
          return (
            <div key={event.key} className="relative flex gap-3">
              {index < events.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%+4px)] w-px bg-border" />}
              <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground">{event.title}</p>
                  {formatDate(event.date) && <span className="text-[10px] text-muted-foreground">{formatDate(event.date)}</span>}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{event.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      {request?.city && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground">
          <MapPin className="h-3.5 w-3.5" /> {request.city}{request.county ? `, ${request.county}` : ""}
        </p>
      )}
    </div>
  );
}
