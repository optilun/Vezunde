import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function SpecialistsCta() {
  return (
    <section className="max-w-6xl mx-auto px-5 mt-24 sm:mt-32">
      <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
        <div className="max-w-xl">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Esti optician, optometrist sau medic oftalmolog?</h2>
          <p className="mt-3 text-muted-foreground">Creeaza-ti prezenta pe Vezunde si fii gasit de pacientii care au nevoie exact de serviciile tale. Fara licitatii, fara bugete de promovare.</p>
        </div>
        <div className="flex flex-col sm:items-end gap-3 shrink-0">
          <Link to="/pentru-specialisti" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-6 py-3 font-medium hover:opacity-90 transition-opacity">
            Afla mai multe <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/revendica-profil" className="text-sm font-medium text-primary hover:underline text-center sm:text-right">
            Revendica un profil existent
          </Link>
        </div>
      </div>
    </section>
  );
}