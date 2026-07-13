import React from "react";
import { ArrowRight, Building2, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const partnerTypes = [
  "Lentile oftalmice",
  "Rame si accesorii",
  "Aparatura optica / oftalmologica",
  "Laboratoare B2B",
  "Training si cursuri",
  "Software si servicii pentru optici",
];

const placeholderPartners = [
  { title: "Furnizori lentile", description: "Companii care lucreaza cu optici, cabinete si clinici.", tag: "B2B" },
  { title: "Laboratoare partenere", description: "Servicii de montaj, prelucrare sau colaborari pentru optici.", tag: "Laborator" },
  { title: "Training si servicii", description: "Cursuri, consultanta, marketing, software sau servicii operationale.", tag: "Servicii" },
];

export default function Partners() {
  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Building2 className="w-3.5 h-3.5" /> Marketplace profesional
          </div>
          <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-extrabold tracking-tight">Parteneri pentru optici si clinici</h1>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">O zona separata de directorul pacientilor, dedicata firmelor care ofera produse, servicii, aparatura, training sau solutii pentru profesionistii din optica si oftalmologie.</p>
        </div>

        <div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="font-semibold">Ai o firma care lucreaza cu optici sau clinici?</div>
            <p className="mt-1 text-sm text-muted-foreground">Trimite profilul pentru verificare. Profilurile B2B nu apar in cautarea pacientilor.</p>
          </div>
          <Link to="/inscriere-partener" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-5 py-3 text-sm font-semibold shrink-0">
            Inscrie firma <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5"><Search className="w-5 h-5" /><div className="mt-4 font-semibold">Cautare B2B</div><p className="mt-1 text-sm text-muted-foreground">Opticile si clinicile vor putea cauta furnizori dupa categorie, servicii si zona.</p></div>
          <div className="rounded-2xl border border-border bg-card p-5"><ShieldCheck className="w-5 h-5" /><div className="mt-4 font-semibold">Profiluri verificate</div><p className="mt-1 text-sm text-muted-foreground">Furnizorii nu intra in cautarea pacientilor. Apar doar in zona profesionala.</p></div>
          <div className="rounded-2xl border border-border bg-card p-5"><CheckCircle2 className="w-5 h-5" /><div className="mt-4 font-semibold">Monetizare separata</div><p className="mt-1 text-sm text-muted-foreground">Abonamentele si promovarea vor fi activate numai dupa definirea produsului comercial.</p></div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="font-heading text-2xl font-bold">Categorii pregatite</h2><p className="mt-1 text-sm text-muted-foreground">Structura de baza pentru viitorul marketplace profesional.</p></div>
          <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">Modul in dezvoltare</div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {partnerTypes.map((type) => <span key={type} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">{type}</span>)}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {placeholderPartners.map((partner) => (
            <div key={partner.title} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-5 min-h-[170px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center font-heading font-bold">{partner.title.slice(0, 1)}</div>
                  <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{partner.tag}</span>
                </div>
                <h3 className="mt-4 font-semibold">{partner.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{partner.description}</p>
              </div>
              <div className="border-t border-border px-5 py-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profiluri in curand</span>
                <span className="inline-flex items-center gap-1 font-medium">Detalii <ArrowRight className="w-3.5 h-3.5" /></span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
