import React from "react";
import { Link } from "react-router-dom";
import { Boxes, Webhook, Database, Plug, ArrowUpRight } from "lucide-react";

const futureModules = [
  {
    icon: Database,
    title: "Data Models",
    description: "Entities for Vezunde's core domain will be defined here.",
    status: "Not started",
  },
  {
    icon: Plug,
    title: "API Integrations",
    description: "Third-party service connections will be added as the product scope grows.",
    status: "Not started",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Inbound webhook endpoints can be introduced without architectural changes.",
    status: "Not started",
  },
  {
    icon: Boxes,
    title: "Modules",
    description: "Feature surfaces will land here as independent, focused pages.",
    status: "Not started",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-semibold">
              V
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Vezunde</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
            <span className="px-3 py-1.5 rounded-md">Overview</span>
            <span className="px-3 py-1.5 rounded-md opacity-50 cursor-not-allowed" aria-disabled>
              Modules
            </span>
            <span className="px-3 py-1.5 rounded-md opacity-50 cursor-not-allowed" aria-disabled>
              Integrations
            </span>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground border border-border rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Starter structure ready
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-heading font-semibold tracking-tight leading-[1.1]">
            Vezunde is set up and ready to grow.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            This is a clean, independent foundation — no authentication, billing, or external
            services connected yet. Architecture is prepared so data models, API integrations,
            and webhooks can be added later without rework.
          </p>
        </div>

        {/* Future modules grid */}
        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          {futureModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {mod.status}
                  </span>
                </div>
                <h3 className="mt-4 font-heading font-medium">{mod.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {mod.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-14 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpRight className="w-4 h-4" />
          <span>Add pages, entities, and integrations as the product takes shape.</span>
        </div>
      </main>
    </div>
  );
}