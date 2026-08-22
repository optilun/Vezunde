// Banda de status a locatiei, deasupra cererilor (2026-08-22).
//
// Inainte, tot panoul de status statea deschis intre tine si lista de cereri, si repeta
// feature-cu-feature exact ce spune deja LockedPreview langa fiecare sectiune blocata din
// detaliul cererii. Acum ramane aici o singura linie - starea locatiei si ce e limitat -
// iar explicatia completa traieste in tabul "Cont".
//
// Doar prezentare: starea vine din buildProviderStatusCenter, aceeasi functie ca inainte.
// Nu se decide nimic despre plan, Top 3 sau acordul clientului.
import React, { useMemo } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { buildProviderStatusCenter } from "../../../../../shared/providerStatusCenter.js";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

export default function ProviderAccessBand({ location, entitlement, counters, onOpenAccount }) {
  const status = useMemo(
    () => buildProviderStatusCenter({ location: location || {}, entitlement, counters }),
    [location, entitlement, counters],
  );

  const limited = status.capabilities.filter((item) => item.state === "limited" || item.state === "blocked");
  const tone = limited.length === 0 ? { border: "#ccd2ba", bg: "#dfe3d2" } : { border: "#dac69b", bg: "#eadcba" };
  const summary = limited.length === 0
    ? "Toate functiile locatiei sunt active."
    : `Limitate acum: ${limited.map((item) => item.label).join(" · ")}`;

  return (
    <div className="flex flex-col gap-3 rounded-[1.4rem] border border-[#e3ddd0] bg-[#fdfbf6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          style={{ borderColor: tone.border, backgroundColor: tone.bg }}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border"
        >
          <span className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
          {limited.length === 0
            ? <ShieldCheck className="relative z-10 h-4 w-4 text-black/55" />
            : <LockKeyhole className="relative z-10 h-4 w-4 text-black/55" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-[13.5px] font-extrabold tracking-[-0.025em] text-foreground">
            {status.overall_label}
          </p>
          <p className="truncate text-[12px] leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenAccount}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45"
      >
        Vezi contul <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
