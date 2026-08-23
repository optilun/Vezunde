// "Asa te vad clientii" (2026-08-23).
//
// Prezentarea generala arata cat de completat este profilul, dar nu si drumul catre pagina
// publica - singurul loc unde vezi ce vede clientul. Cardul este scurt inadins: o mica
// previzualizare si un buton.
import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MapPin } from "lucide-react";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

export default function OverviewPublicProfileCard({ organizationName, organizationType, localityName, publicProfileUrl, published }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-6">
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />
      <div className="relative z-10">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">Așa te văd clienții</p>
        <h2 className="mt-2 font-heading text-[1.6rem] font-extrabold leading-[1.04] tracking-[-0.04em]">Pagina ta publică.</h2>

        {/* Previzualizare simpla: exact primele lucruri pe care le vede cineva in director. */}
        <div className="mt-5 rounded-[1.4rem] border border-[#e3ddd0] bg-white/60 px-5 py-4">
          <p className="truncate font-heading text-[17px] font-extrabold tracking-[-0.03em] text-foreground">{organizationName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#e3ddd0] bg-[#fdfbf6] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{organizationType}</span>
            {localityName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3ddd0] bg-[#fdfbf6] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {localityName}
              </span>
            )}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {published
              ? "Profilul este publicat și poate fi găsit de clienți în director."
              : "Profilul nu este încă publicat, deci nu apare în căutări."}
          </p>
        </div>

        {publicProfileUrl && (
          <Link
            to={publicProfileUrl}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-5 font-heading text-[13px] font-bold text-foreground transition-colors hover:border-foreground/45"
          >
            Vezi profilul public <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}
