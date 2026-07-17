import React, { useEffect, useState } from "react";
import { Clock3, Info, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";
import { AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40";

export default function ApplicantHoursDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({ opening_hours: "", saturday_hours: "", availability_status: "necunoscuta" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((item) => item.section === "operating_hours");
    setDraft(existing || null);
    if (!existing) {
      setValues({ opening_hours: "", saturday_hours: "", availability_status: "necunoscuta" });
      return;
    }
    try {
      setValues({ availability_status: "necunoscuta", ...JSON.parse(existing.payload_json || "{}") });
    } catch (_error) {
      setValues({ opening_hours: "", saturday_hours: "", availability_status: "necunoscuta" });
    }
  }, [workspace]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const response = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      section: "operating_hours",
      payload: values,
      claim_request_id: workspace.claim?.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Draftul programului a fost salvat.");
    await onRefresh?.();
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Program</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Introdu programul într-o formă ușor de înțeles. După confirmarea accesului îl vei putea configura separat pentru fiecare zi și pentru excepții.
        </p>
        <div className="mt-3"><DraftBadge /></div>
      </header>

      <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Clock3 className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold">Orele obișnuite de lucru</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Folosește formatul 24 de ore și menționează zilele închise.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Luni–Vineri</label>
            <input
              className={`${inputCls} mt-1.5`}
              value={values.opening_hours}
              onChange={(event) => setValues({ ...values, opening_hours: event.target.value })}
              placeholder="Exemplu: 09:00–18:00"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Poți scrie și intervale diferite, de exemplu: L–J 09:00–18:00, V 09:00–16:00.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Sâmbătă și duminică</label>
            <input
              className={`${inputCls} mt-1.5`}
              value={values.saturday_hours}
              onChange={(event) => setValues({ ...values, saturday_hours: event.target.value })}
              placeholder="Exemplu: S 09:00–14:00, D închis"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Dacă locația este închisă în weekend, scrie clar „Închis”.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-bold">Cum sunt primiți clienții și pacienții</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Această informație este opțională și nu schimbă programul de lucru.</p>
        <select
          className={`${inputCls} mt-4`}
          value={values.availability_status}
          onChange={(event) => setValues({ ...values, availability_status: event.target.value })}
        >
          <option value="necunoscuta">Nu publica încă această informație</option>
          {Object.entries(AVAILABILITY_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-secondary/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Alege doar o variantă care descrie corect modul actual de lucru. O vei putea modifica ulterior.</span>
        </div>
      </section>

      <div className="sticky bottom-0 z-20 rounded-[20px] border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto"
        >
          <Save className="h-4 w-4" /> {saving ? "Se salvează..." : "Salvează draftul"}
        </button>
        {msg && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}
