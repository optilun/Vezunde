import React from "react";

const SEVERITY = {
  strong_duplicate: {
    label: "Duplicat puternic",
    className: "bg-destructive/10 text-destructive",
  },
  possible_duplicate: {
    label: "Posibil duplicat",
    className: "bg-amber-100 text-amber-800",
  },
  likely_distinct: {
    label: "Probabil distinct",
    className: "bg-secondary text-muted-foreground",
  },
};

export default function DirOpsIdentityCandidates({
  check,
  reason,
  setReason,
  saving,
  onContinue,
  onCancel,
}) {
  const strong = check.blocking_level === "strong_duplicate_review_required";
  const reasonOk = reason.trim().length >= 15;

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold leading-relaxed">
        {strong
          ? "Duplicat puternic detectat — crearea normala este blocata."
          : "Posibile duplicate gasite — continuarea necesita un motiv."}
      </p>

      <ul className="mt-3 space-y-2">
        {check.candidates.map((candidate) => (
          <li
            key={candidate.location_id}
            className="rounded-xl border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words font-semibold">{candidate.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${SEVERITY[candidate.severity]?.className || ""}`}>
                {SEVERITY[candidate.severity]?.label || candidate.severity}
              </span>
            </div>
            <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {candidate.organization_name ? `${candidate.organization_name} · ` : ""}
              {candidate.locality_name}
              {candidate.county_name ? `, ${candidate.county_name}` : ""}
              {candidate.address ? ` · ${candidate.address}` : ""}
              {" · "}{candidate.profile_control_status}
            </div>
            {candidate.matched_fields?.length > 0 && (
              <div className="mt-1 break-words text-xs">
                Potrivire: {candidate.matched_fields.join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <label
          htmlFor="duplicate-override-reason"
          className="text-xs font-semibold text-muted-foreground"
        >
          Motiv pentru crearea ca locatie diferita (minim 15 caractere) *
        </label>
        <textarea
          id="duplicate-override-reason"
          className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explica de ce aceasta este o locatie distincta..."
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {reason.trim().length}/15 caractere minime
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        {strong ? (
          <button
            type="button"
            onClick={() => onContinue(true)}
            disabled={saving || !reasonOk}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-40 sm:w-auto sm:rounded-md"
          >
            Creeaza totusi ca locatie diferita
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onContinue(false)}
            disabled={saving || !reasonOk}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:w-auto sm:rounded-md"
          >
            Continua cu motiv
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto sm:rounded-md"
        >
          Anuleaza
        </button>
      </div>
    </div>
  );
}
