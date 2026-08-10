import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Baby,
  Check,
  Eye,
  Glasses,
  Layers,
  Microscope,
  Ruler,
  Scissors,
  Stethoscope,
  Wrench,
} from "lucide-react";

// PROTOTIP (2026-08-06) - nu e legat inca de datele reale.
// Scopul: sa validam directia inainte sa schimbam fluxul real de configurare a
// serviciilor. Ideea centrala: intrebam intai furnizorul CE FACE, in limbajul lui,
// si abia apoi ii aratam serviciile concrete din ariile bifate. Zonele functionale
// (magazin / cabinet / atelier) se deduc in fundal, nu i le cerem la inceput.
//
// Ruta: /prototip-servicii

const AREAS = [
  {
    key: "optical_retail",
    icon: Glasses,
    title: "Ochelari si rame",
    hint: "Vand ochelari de vedere, rame, ochelari de soare",
    count: 9,
  },
  {
    key: "lenses_and_measurements",
    icon: Layers,
    title: "Lentile pentru ochelari",
    hint: "Monofocale, progresive, tratamente",
    count: 11,
  },
  {
    key: "optometry",
    icon: Eye,
    title: "Consultatii de vedere",
    hint: "Masor dioptriile, testez acuitatea vizuala",
    count: 8,
  },
  {
    key: "contact_lenses",
    icon: Eye,
    title: "Lentile de contact",
    hint: "Adaptare, control, lentile speciale",
    count: 15,
  },
  {
    key: "technical_activities",
    icon: Wrench,
    title: "Reglaje si reparatii",
    hint: "Ajustari, schimb surub, indreptat rame",
    count: 24,
  },
  {
    key: "ophthalmology_consults",
    icon: Stethoscope,
    title: "Consultatii medicale oftalmologice",
    hint: "Consult cu medic oftalmolog",
    count: 8,
  },
  {
    key: "investigations",
    icon: Microscope,
    title: "Investigatii",
    hint: "OCT, camp vizual, fund de ochi",
    count: 14,
  },
  {
    key: "children_and_prevention",
    icon: Baby,
    title: "Copii si preventie",
    hint: "Consultatii pentru copii, screening",
    count: 7,
  },
  {
    key: "specialties",
    icon: Ruler,
    title: "Specialitati medicale",
    hint: "Retina, glaucom, cataracta",
    count: 19,
  },
  {
    key: "procedures_surgery",
    icon: Scissors,
    title: "Proceduri si chirurgie",
    hint: "Interventii, laser",
    count: 14,
  },
];

export default function PrototipServicii() {
  const navigate = useNavigate();
  const [picked, setPicked] = useState(() => new Set());

  const toggle = (key) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const pickedCount = picked.size;
  const serviceCount = AREAS
    .filter((area) => picked.has(area.key))
    .reduce((sum, area) => sum + area.count, 0);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto w-full max-w-2xl px-5 pt-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inapoi
        </button>

        {/* Bara de progres: patru etape, nu noua destinatii */}
        <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1 flex-1 rounded-full bg-foreground" />
          <span className="h-1 flex-1 rounded-full bg-border" />
          <span className="h-1 flex-1 rounded-full bg-border" />
          <span className="h-1 flex-1 rounded-full bg-border" />
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pasul 1 din 4
        </p>

        <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ce faci la aceasta locatie?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Bifeaza tot ce se aplica. Serviciile concrete le alegi la pasul urmator, doar
          din ariile bifate aici.
        </p>

        <div className="mt-6 space-y-2.5">
          {AREAS.map((area) => {
            const Icon = area.icon;
            const active = picked.has(area.key);
            return (
              <button
                key={area.key}
                type="button"
                onClick={() => toggle(area.key)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-foreground bg-card shadow-sm"
                    : "border-border bg-card/60 hover:bg-card"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{area.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {area.hint}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-foreground bg-foreground text-background" : "border-border"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Un singur buton primar, mereu vizibil */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-5 py-3.5">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {pickedCount === 0
              ? "Bifeaza cel putin o arie ca sa continui"
              : `${pickedCount} arii alese \u00b7 ~${serviceCount} servicii de parcurs la pasul urmator`}
          </p>
          <button
            type="button"
            disabled={pickedCount === 0}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-bold text-background disabled:opacity-40"
          >
            Continua
          </button>
        </div>
      </div>
    </div>
  );
}
