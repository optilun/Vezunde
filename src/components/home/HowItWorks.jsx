import React from "react";

const STEPS = [
  { title: "Descrie nevoia ta", text: "Scrie in cuvintele tale: un control, ochelari noi, o reparatie sau ceva ce te ingrijoreaza la vedere." },
  { title: "Raspunde la cateva intrebari", text: "Te ghidam pas cu pas ca sa intelegem pentru cine este, cat de urgent si in ce oras." },
  { title: "Vezi unde poti merge", text: "Iti aratam locurile potrivite, cu serviciile relevante si numar de telefon public, ca sa alegi tu." },
];

export default function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-5 mt-28 sm:mt-40">
      <div className="grid sm:grid-cols-[1fr_1.4fr] gap-10 sm:gap-16">
        <div>
          <p className="text-sm font-medium text-primary">Cum functioneaza</p>
          <h2 className="mt-3 font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.02em]">
            Simplu, ca o conversatie.
          </h2>
        </div>
        <div className="space-y-10">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-6">
              <span className="font-heading text-sm font-bold text-primary pt-1.5">0{i + 1}</span>
              <div>
                <h3 className="font-heading text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}