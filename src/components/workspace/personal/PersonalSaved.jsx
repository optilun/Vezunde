import React from "react";
import { Bookmark } from "lucide-react";

export default function PersonalSaved() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Bookmark className="h-4 w-4" /></div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Locatii salvate</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Aici vei putea pastra locatiile pe care vrei sa le gasesti rapid mai tarziu.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-dashed border-border bg-card/70 px-5 py-12 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary"><Bookmark className="h-4 w-4 text-muted-foreground" /></div>
        <h2 className="mt-4 text-sm font-bold">Functionalitate in pregatire</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">Salvarea locatiilor va fi disponibila intr-o etapa ulterioara.</p>
      </section>
    </div>
  );
}
