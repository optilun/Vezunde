import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function StepDone({ provider }) {
  return (
    <div className="text-center py-6">
      <CheckCircle2 className="w-12 h-12 mx-auto text-foreground/70" strokeWidth={1.5} />
      <h2 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">Solicitarea a fost trimisa</h2>
      <p className="mt-3 text-muted-foreground text-sm max-w-sm mx-auto">
        Solicitarea ta{provider ? ` catre ${provider.name}` : ""} a fost inregistrata. Poti oricand suna direct sau vizita locatia.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/cauta" className="px-5 py-2.5 rounded-full border border-border text-sm font-medium hover:border-foreground/40 transition-colors">
          Vezi toti furnizorii
        </Link>
        <Link to="/" className="px-5 py-2.5 rounded-full text-white text-sm font-medium" style={{ backgroundColor: "#171717" }}>
          Inapoi acasa
        </Link>
      </div>
    </div>
  );
}