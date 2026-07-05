import React from "react";

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const SEVERITY = {
  strong_duplicate: { label: "Duplicat puternic", cls: "bg-red-100 text-red-800" },
  possible_duplicate: { label: "Posibil duplicat", cls: "bg-amber-100 text-amber-800" },
  likely_distinct: { label: "Probabil distinct", cls: "bg-secondary text-foreground" },
};

// Module 3H.1B.2: admin-only Identity Gate context attached to a claim request.
export default function AdminClaimIdentityContext({ claim }) {
  const snap = parse(claim.identity_check_snapshot);
  const payload = parse(claim.submitted_payload);
  const note = snap?.identity_difference_note || payload?.identity_difference_note || "";
  const proposed = payload?.proposed_location;
  if (!snap && !note && !proposed) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs space-y-2">
      {snap?.blocking_level && snap.blocking_level !== "none" && (
        <div>
          <span className="font-semibold">Identity Gate:</span>{" "}
          <span className={`px-2 py-0.5 rounded-full font-semibold ${snap.blocking_level === "strong_duplicate_review_required" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
            {snap.blocking_level === "strong_duplicate_review_required" ? "duplicat puternic — review obligatoriu" : "avertisment posibil duplicat"}
          </span>
        </div>
      )}
      {proposed && (
        <div>
          <span className="font-semibold">Locatie propusa:</span> {proposed.name} · {proposed.locality_name}{proposed.county_name ? `, ${proposed.county_name}` : ""}{proposed.address ? ` · ${proposed.address}` : ""}
        </div>
      )}
      {(snap?.candidates || []).map((c) => (
        <div key={c.location_id} className="rounded-md border border-border bg-card p-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{c.name}</span>
            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${SEVERITY[c.severity]?.cls || "bg-secondary"}`}>{SEVERITY[c.severity]?.label || c.severity}</span>
            <span className="text-muted-foreground">scor {c.score}</span>
          </div>
          <div className="text-muted-foreground mt-0.5">{c.locality_name}{c.county_name ? `, ${c.county_name}` : ""}{c.address ? ` · ${c.address}` : ""}</div>
          {c.matched_fields?.length > 0 && <div className="text-muted-foreground mt-0.5">Potrivire: {c.matched_fields.join(", ")}</div>}
        </div>
      ))}
      {note && (
        <div>
          <span className="font-semibold">Explicatia furnizorului:</span> {note}
        </div>
      )}
    </div>
  );
}