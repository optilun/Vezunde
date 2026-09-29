import React, { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

function render(value, variables) {
  return String(value || "").replace(/{{\s*([a-z_]+)\s*}}/g, (_match, key) => String(variables?.[key] ?? ""));
}

function readError(error) {
  return error?.response?.data?.error || error?.message || "Operatia nu a reusit.";
}

export default function AutomaticEmailWorkspace() {
  const [templates, setTemplates] = useState([]);
  const [external, setExternal] = useState([]);
  const [variables, setVariables] = useState({});
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async (preferredKey = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", { action: "list" });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      const nextTemplates = data.templates || [];
      const nextExternal = data.external || [];
      setTemplates(nextTemplates);
      setExternal(nextExternal);
      setVariables(data.sample_variables || {});
      const key = preferredKey || selectedKey || nextTemplates[0]?.key || "";
      setSelectedKey(key);
      const active = nextTemplates.find((item) => item.key === key);
      if (active) setDraft({ subject: active.effective_subject || "", body: active.effective_body || "" });
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const all = useMemo(() => [...templates, ...external], [templates, external]);
  const selected = all.find((item) => item.key === selectedKey) || null;
  const editable = selected?.owner === "viasee";
  const changed = editable && (
    draft.subject !== selected.effective_subject || draft.body !== selected.effective_body
  );
  const previewSubject = editable ? render(draft.subject, variables) : "";
  const previewBody = editable ? render(draft.body, variables) : "";
  const groups = [...new Set(all.map((item) => item.group))];
  const matches = (item) => {
    const needle = search.trim().toLocaleLowerCase("ro-RO");
    return !needle || [item.title, item.trigger, item.recipient, item.group].join(" ").toLocaleLowerCase("ro-RO").includes(needle);
  };

  const choose = (item) => {
    setSelectedKey(item.key);
    setError("");
    setNotice("");
    if (item.owner === "viasee") {
      setDraft({ subject: item.effective_subject || "", body: item.effective_body || "" });
    }
  };

  const save = async () => {
    if (!selected || !editable || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", {
        action: "save", key: selected.key,
        subject_template: draft.subject, body_template: draft.body,
      });
      if (response.data?.error) throw new Error(response.data.error);
      await load(selected.key);
      setNotice("Sablonul a fost salvat. Noile trimiteri folosesc aceasta versiune.");
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!selected || !editable || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", { action: "reset", key: selected.key });
      if (response.data?.error) throw new Error(response.data.error);
      await load(selected.key);
      setNotice("Sablonul standard este din nou activ pentru trimiterile viitoare.");
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <h3 className="text-base font-bold text-foreground">Emailuri automate</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Previzualizeaza fiecare mesaj cu date fictive si modifica subiectul sau textul.
          Salvarea schimba doar emailurile trimise de acum inainte; nu trimite niciun mesaj de test.
          Campaniile de marketing raman in taburile lor.
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se incarca emailurile...</p>}

      {!loading && (
        <div className="grid gap-5 lg:grid-cols-[minmax(240px,310px)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Cauta email</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cauta email sau eveniment"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </label>
            {groups.map((group) => {
              const items = all.filter((item) => item.group === group && matches(item));
              if (!items.length) return null;
              return (
                <div key={group} className="space-y-1.5">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group} ({items.length})</p>
                  {items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => choose(item)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedKey === item.key ? "border-foreground bg-secondary/60" : "border-border hover:bg-secondary/30"}`}
                    >
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.trigger}</span>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.owner !== "viasee" ? "bg-amber-100 text-amber-900" : item.override ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground"}`}>
                        {item.owner !== "viasee" ? "Gestionat extern" : item.override ? "Personalizat" : "Standard"}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </aside>

          {selected && (
            <section className="min-w-0 space-y-4">
              <div className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-bold text-foreground">{selected.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Cand se trimite: {selected.trigger}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Destinatar: {selected.recipient}</p>
                  </div>
                  {editable && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Editabil in VIASEE</span>}
                </div>
                {editable && selected.override && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Versiunea {selected.override.revision}; ultima modificare {selected.override.updated_at ? new Date(selected.override.updated_at).toLocaleString("ro-RO") : "necunoscuta"}
                    {selected.override.updated_by_email ? ` de ${selected.override.updated_by_email}` : ""}.
                  </p>
                )}
              </div>

              {!editable ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">Mesaj gestionat de {selected.owner === "stripe" ? "Stripe" : "Base44"}</p>
                  <p className="mt-2 text-sm text-amber-900">{selected.note}</p>
                  <p className="mt-2 text-xs text-amber-900">
                    Previzualizarea exacta depinde de setarile contului furnizorului; acest ecran nu poate modifica emailul extern.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border p-4">
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-foreground">
                        Subiect
                        <input
                          value={draft.subject}
                          onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                          maxLength={180}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-foreground">
                        Continut email (text simplu)
                        <textarea
                          value={draft.body}
                          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                          rows={13}
                          maxLength={6000}
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs font-normal"
                        />
                      </label>
                      <div className="text-xs text-muted-foreground">
                        <p className="font-semibold">Variabile disponibile</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(selected.variables || []).map((token) => (
                            <code key={token} className="rounded bg-secondary px-1.5 py-0.5">{`{{${token}}}`}</code>
                          ))}
                        </div>
                        {!!selected.required?.length && <p className="mt-2">Obligatorii in continut: {selected.required.map((token) => `{{${token}}}`).join(", ")}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={save} disabled={saving || !changed} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salveaza
                        </button>
                        <button type="button" onClick={reset} disabled={saving || !selected.override} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                          <RotateCcw className="h-4 w-4" /> Revino la standard
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
                    <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview cu date fictive</div>
                    <div className="m-3 rounded-lg border border-border bg-white p-5">
                      <p className="text-xs text-slate-500">De la: VIASEE</p>
                      <p className="mt-1 text-xs text-slate-500">Catre: destinatar@exemplu.ro</p>
                      <p className="mt-2 break-words border-b border-slate-200 pb-3 text-sm font-bold text-slate-900">{previewSubject || "Fara subiect"}</p>
                      <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{previewBody || "Fara continut"}</div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
