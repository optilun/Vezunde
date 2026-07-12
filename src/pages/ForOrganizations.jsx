import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, ClipboardCheck, MapPinPlus, ShieldCheck } from "lucide-react";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";
import ProviderSearch from "@/components/provider/ProviderSearch";

const STEPS = [
  { icon: Building2, title: "Gaseste profilul", text: "Cauta optica, clinica sau cabinetul. Evitam crearea profilurilor duplicate." },
  { icon: ShieldCheck, title: "Confirma accesul", text: "Te autentifici si ne spui relatia ta cu organizatia si rolul solicitat." },
  { icon: ClipboardCheck, title: "Treci prin verificare", text: "VIASEE verifica solicitarea inainte sa acorde controlul asupra profilului." },
  { icon: CheckCircle2, title: "Configureaza workspace-ul", text: "Dupa aprobare completezi profilul, locatiile, programul, serviciile si specialistii." },
];

export default function ForOrganizations() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <SpecialistsHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
          <div className="grid items-start gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Pentru optici, clinici si cabinete
              </div>
              <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
                Administreaza prezenta organizatiei tale pe VIASEE.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Revendica un profil existent sau inscrie organizatia si prima locatie. Accesul este acordat numai dupa verificare.
              </p>
              <div className="mt-7 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Cautarea se face inainte de autentificare.</div>
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Profilul complet se configureaza dupa aprobarea accesului.</div>
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> Solicitarea nu publica automat o locatie noua.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              <div className="mb-5">
                <h2 className="font-heading text-xl font-bold">Incepe cu o cautare</h2>
                <p className="mt-1 text-sm text-muted-foreground">Verifica daca profilul exista deja in director.</p>
              </div>
              <ProviderSearch
                onClaim={(location) => navigate("/adauga-sau-revendica", { state: { selectedLocation: location } })}
                onNew={(prefill) => navigate("/adauga-sau-revendica", { state: { startNew: true, newLocationPrefill: prefill || null } })}
              />
            </div>
          </div>
        </section>

        <section id="cum-functioneaza" className="border-y border-border bg-card/55">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">Cum functioneaza inscrierea</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Cerem doar datele necesare pentru identificare si verificare. Restul profilului se completeaza in workspace.</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><Icon className="h-4 w-4" /></div>
                    <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold">{title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold"><MapPinPlus className="h-4 w-4" /> Organizatia nu este in director?</div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Adauga organizatia si prima locatie. Verificam identitatea si posibilele duplicate inainte de acordarea accesului.</p>
            </div>
            <button onClick={() => navigate("/adauga-sau-revendica", { state: { startNew: true } })} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background">
              Inscrie organizatia
            </button>
          </div>
        </section>
      </main>
      <SpecialistsFooter />
    </div>
  );
}
