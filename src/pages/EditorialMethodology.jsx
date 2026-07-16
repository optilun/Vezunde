import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, GuideCanvas, GuideNote } from "@/components/guides/GuideCanvas";

const STEPS = [
  {
    number: "01",
    title: "Pornim de la roluri și competențe",
    text: "Separăm clar evaluarea optometrică, realizarea și adaptarea ochelarilor și actul medical oftalmologic.",
  },
  {
    number: "02",
    title: "Verificăm formulările",
    text: "Folosim surse instituționale, documente profesionale și informații publice relevante pentru România. Evităm promisiunile și concluziile medicale personalizate.",
  },
  {
    number: "03",
    title: "Actualizăm când se schimbă informația",
    text: "Paginile afișează scopul lor editorial și sunt revizuite atunci când apar schimbări importante de practică, reglementare sau funcționare a platformei.",
  },
];

export default function EditorialMethodology() {
  return (
    <GuideCanvas>
      <Breadcrumbs current="Cum verificăm informațiile" />
      <header className="mt-10 border-t-[3px] border-[#171717] pt-7">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6f6a63] sm:text-xs">
          Standard editorial VIASEE
        </p>
        <h1 className="mt-6 max-w-6xl font-heading text-[clamp(3.2rem,8vw,8rem)] font-extrabold leading-[0.86] tracking-[-0.075em]">
          Informații clare,
          <span className="block font-display font-medium italic text-[#345bc8]">
            verificate cu grijă.
          </span>
        </h1>
        <p className="mt-8 max-w-3xl text-lg leading-8 text-[#514d47] sm:text-xl">
          Ghidurile VIASEE te ajută să înțelegi opțiunile și să alegi următorul pas. Ele nu înlocuiesc evaluarea unui profesionist și nu oferă diagnostic medical.
        </p>
      </header>

      <section aria-labelledby="proces" className="mt-20 sm:mt-28">
        <h2 id="proces" className="text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">Cum lucrăm</h2>
        <div className="mt-8 border-y-[3px] border-[#171717]">
          {STEPS.map((step) => (
            <div key={step.number} className="grid gap-4 border-b border-[#171717]/35 py-7 last:border-b-0 lg:grid-cols-[6rem_0.8fr_1.2fr] lg:gap-10">
              <span className="font-mono text-xs tracking-[0.18em]">{step.number}</span>
              <h3 className="text-xl font-extrabold leading-7 tracking-[-0.03em] sm:text-2xl">{step.title}</h3>
              <p className="leading-7 text-[#5f5a53]">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-8 rounded-[2rem] bg-[#e7dfea] p-7 sm:mt-28 sm:p-12 lg:grid-cols-[0.75fr_1.25fr] lg:p-16">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a63]">
          Corecții și actualizări
        </p>
        <div>
          <h2 className="text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">Ai observat o informație care trebuie revizuită?</h2>
          <p className="mt-5 max-w-2xl leading-7 text-[#514d47]">
            Trimite-ne pagina, formularea și sursa relevantă. Analizăm observația înainte de a actualiza conținutul.
          </p>
          <a href="mailto:contact@viasee.ro?subject=Observație%20ghid%20VIASEE" className="mt-7 inline-flex min-h-12 items-center gap-4 rounded-full bg-[#171717] px-6 text-sm font-semibold text-white">
            contact@viasee.ro <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <div className="mt-12 flex flex-col gap-5 border-t border-[#171717]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <GuideNote />
        <Link to="/ghid" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Înapoi la Ghid VIASEE</Link>
      </div>
    </GuideCanvas>
  );
}
