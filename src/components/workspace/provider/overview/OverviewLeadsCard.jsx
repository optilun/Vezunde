// Cererile de la clienti, in prezentarea generala (2026-08-23).
//
// Prezentarea generala raspundea doar la intrebari administrative - cat e completat
// profilul, ce am trimis la aprobare - si la nimic din ce aduce clienti. Cardul acesta
// aduce contoarele din modulul de leaduri pe prima pagina.
//
// Cifrele se insumeaza pe toate locatiile la care ai acces, ca restul prezentarii generale.
// Daca apelul esueaza sau nu ai drept pe cereri, cardul pur si simplu nu apare - nu afisam
// zerouri inventate.
import React, { useEffect, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

const TONES = {
  green: { border: "#ccd2ba", bg: "#dfe3d2" },
  blue: { border: "#c6d3da", bg: "#dce5e9" },
  amber: { border: "#dac69b", bg: "#eadcba" },
};

// Cate locatii interogam cel mult: contoarele se cer per locatie, iar o organizatie mare
// nu trebuie sa porneasca zeci de apeluri doar pentru un rezumat.
const MAX_LOCATIONS = 6;

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function OverviewLeadsCard({ locationIds, onNavigate }) {
  const [counters, setCounters] = useState(null);
  const key = (locationIds || []).join(",");

  useEffect(() => {
    const ids = key ? key.split(",").filter(Boolean).slice(0, MAX_LOCATIONS) : [];
    if (ids.length === 0) return undefined;
    let active = true;

    Promise.all(ids.map((id) => base44.functions.invoke("providerLeadInboxOps", {
      action: "list",
      location_id: id,
      scope: "active",
      status: "",
      limit: 1,
    }).then(responseData)))
      .then((results) => {
        if (!active) return;
        setCounters(results.reduce((total, item) => ({
          new: total.new + (Number(item?.counters?.new) || 0),
          active: total.active + (Number(item?.counters?.active) || 0),
          history: total.history + (Number(item?.counters?.history) || 0),
        }), { new: 0, active: 0, history: 0 }));
      })
      .catch(() => { if (active) setCounters(null); });

    return () => { active = false; };
  }, [key]);

  if (!counters) return null;

  const tiles = [
    { label: "Cereri noi", value: counters.new, tone: TONES.green },
    { label: "În lucru", value: counters.active, tone: TONES.blue },
    { label: "În istoric", value: counters.history, tone: TONES.amber },
  ];

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-6">
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />
      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">
          <Inbox aria-hidden="true" className="h-3.5 w-3.5" /> Cereri de la clienți
        </p>
        <h2 className="mt-2 font-heading text-[1.6rem] font-extrabold leading-[1.04] tracking-[-0.04em]">Ce cer clienții acum.</h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} style={{ borderColor: tile.tone.border, backgroundColor: tile.tone.bg }} className="relative overflow-hidden rounded-[1.4rem] border px-5 py-4">
              <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
              <p className="relative z-10 font-heading text-[2.1rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{tile.value}</p>
              <p className="relative z-10 mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">{tile.label}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavigate("leads")}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#171717] px-5 font-heading text-[13px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Deschide cererile <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
