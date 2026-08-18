// Faza 2: dialogul de confirmare la eliminarea unei zone sau activitati cu dependente.
import React from "react";
import { AlertTriangle } from "lucide-react";

export default function DependencyRemovalDialog({ request, onCancel, onConfirm }) {
  if (!request) return null;
  const approved = request.approved === true;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dependency-removal-title" className="w-full max-w-lg rounded-[24px] border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-900"><AlertTriangle className="h-4 w-4" /></span>
          <div>
            <h2 id="dependency-removal-title" className="text-base font-bold">{approved ? "Propune eliminarea cu dependențe" : "Elimină opțiunea din draft"}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">„{request.label}” are elemente asociate. Confirmarea le va marca împreună, astfel încât configurația să rămână coerentă.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.serviceCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Servicii</div></div>
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.capabilityCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Activități</div></div>
          <div className="rounded-2xl bg-secondary/45 p-3 text-center"><div className="text-xl font-extrabold">{request.resourceCount || 0}</div><div className="mt-1 text-[10px] font-semibold text-muted-foreground">Resurse</div></div>
        </div>
        {approved && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">Configurația aprobată nu este ștearsă imediat. După trimiterea cererii, serviciile afectate sunt ascunse public până la soluționare.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Renunță</button>
          <button type="button" onClick={onConfirm} className="rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background">{approved ? "Propune eliminarea tuturor" : "Elimină din draft"}</button>
        </div>
      </div>
    </div>
  );
}