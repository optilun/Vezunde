import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, ClipboardList, Search } from "lucide-react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function PersonalOverview({ user, workspace, onNavigate }) {
  const latest = workspace?.latest_claim_status;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cont personal</div>
        <h1 className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Salut, {user.full_name || "acolo"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Gaseste locatii, urmareste solicitarile tale si schimba usor intre spatiile disponibile ale contului.</p>
      </section>

      {latest && (
        <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold">Ultima solicitare de furnizor</div>
                <div className="mt-1 text-xs text-muted-foreground">{CLAIM_STATUS_LABELS[latest.status] || latest.status}</div>
              </div>
            </div>
            <button onClick={() => onNavigate("requests")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
              Vezi solicitarile <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary"><Search className="h-4 w-4" /></div>
          <h2 className="mt-4 text-base font-bold">Cauta o locatie</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Gaseste optici, clinici si cabinete potrivite nevoii tale.</p>
          <Link to="/cauta" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
            Incepe cautarea <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-[22px] border border-border bg-accent/40 p-4 shadow-sm sm:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
          <h2 className="mt-4 text-base font-bold">Reprezinti o locatie?</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Adauga sau revendica profilul unei optici, clinici ori al unui cabinet.</p>
          <Link to="/adauga-sau-revendica" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 sm:w-auto">
            Adauga sau revendica <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
