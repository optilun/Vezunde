import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Eye, Loader2, Pencil, RotateCcw, Save, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

const sourceFilters = [
  { key: "all", label: "Toate" },
  { key: "viasee", label: "Trimise de VIASEE" },
  { key: "custom", label: "Personalizate" },
  { key: "external", label: "Gestionate extern" },
];

function render(value, variables) {
  return String(value || "").replace(/{{\s*([a-z_]+)\s*}}/g, (_match, key) => String(variables?.[key] ?? ""));
}

function readError(error) {
  return error?.response?.data?.error || error?.message || "Operatia nu a reusit.";
}

function validateDraft(item, draft) {
  if (!item || item.owner !== "viasee") return [];
  const errors = [];
  if (!draft.subject.trim()) errors.push("Adauga un subiect.");
  if (draft.subject.length > 180 || /[\r\n]/.test(draft.subject)) errors.push("Subiectul trebuie sa aiba maximum 180 de caractere si o singura linie.");
  if (!draft.body.trim()) errors.push("Adauga textul emailului.");
  if (draft.body.length > 6000) errors.push("Textul poate avea maximum 6000 de caractere.");
  const combined = draft.subject + "\n" + draft.body;
  const tokens = [...combined.matchAll(/{{\s*([a-z_]+)\s*}}/g)].map((match) => match[1]);
  const unknown = tokens.find((token) => !item.variables.includes(token));
  if (unknown) errors.push("Variabila necunoscuta: {{" + unknown + "}}.");
  if (/{{|}}/.test(combined.replace(/{{\s*[a-z_]+\s*}}/g, ""))) errors.push("Verifica variabilele scrise intre acolade.");
  for (const token of item.required || []) {
    if (!draft.body.match(new RegExp("{{\\s*" + token + "\\s*}}"))) {
      errors.push("Pastreaza variabila obligatorie {{" + token + "}} in continut.");
    }
  }
  return errors;
}

function status(item, dirty) {
  if (item.owner !== "viasee") return { label: "Extern", className: "bg-amber-100 text-amber-900" };
  if (dirty) return { label: "Modificari nesalvate", className: "bg-sky-100 text-sky-900" };
  if (item.override) return { label: "Personalizat", className: "bg-emerald-100 text-emerald-900" };
  return { label: "Standard", className: "bg-secondary text-muted-foreground" };
}

export default function AutomaticEmailWorkspace() {
  const [templates, setTemplates] = useState([]);
  const [external, setExternal] = useState([]);
  const [variables, setVariables] = useState({});
  const [selectedKey, setSelectedKey] = useState("");
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [source, setSource] = useState("all");
  const [mode, setMode] = useState("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const bodyRef = useRef(null);
  const detailRef = useRef(null);

  const load = async (preferredKey = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", { action: "list" });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      const nextTemplates = data.templates || [];
      setTemplates(nextTemplates);
      setExternal(data.external || []);
      setVariables(data.sample_variables || {});
      setDrafts((current) => ({
        ...Object.fromEntries(nextTemplates.map((item) => [
          item.key, { subject: item.effective_subject || "", body: item.effective_body || "" },
        ])),
        ...Object.fromEntries(Object.entries(current).filter(([key]) => key !== preferredKey)),
      }));
      setSelectedKey(preferredKey || selectedKey || nextTemplates[0]?.key || "");
      return true;
    } catch (cause) {
      setError(readError(cause));
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const all = useMemo(() => [...templates, ...external], [templates, external]);
  const selected = all.find((item) => item.key === selectedKey) || null;
  const draft = drafts[selectedKey] || {
    subject: selected?.effective_subject || "",
    body: selected?.effective_body || "",
  };
  const dirty = selected?.owner === "viasee" && (
    draft.subject !== selected.effective_subject || draft.body !== selected.effective_body
  );
  const errors = validateDraft(selected, draft);
  const customCount = templates.filter((item) => item.override).length;
  const groups = [...new Set(all.map((item) => item.group))];
  const listed = useMemo(() => all.filter((item) => {
    if (group !== "all" && item.group !== group) return false;
    if (source === "viasee" && item.owner !== "viasee") return false;
    if (source === "custom" && !item.override) return false;
    if (source === "external" && item.owner === "viasee") return false;
    const needle = search.trim().toLocaleLowerCase("ro-RO");
    return !needle || [item.title, item.trigger, item.recipient, item.group].join(" ").toLocaleLowerCase("ro-RO").includes(needle);
  }), [all, group, search, source]);

  useEffect(() => {
    if (!loading && !listed.some((item) => item.key === selectedKey)) {
      setSelectedKey(listed[0]?.key || "");
      setMode("preview");
    }
  }, [listed, loading, selectedKey]);

  const choose = (item) => {
    setSelectedKey(item.key);
    setMode("preview");
    setError("");
    setNotice("");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const updateDraft = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [selectedKey]: { ...current[selectedKey], [field]: value },
    }));
    setError("");
    setNotice("");
  };

  const insertVariable = (token) => {
    const input = bodyRef.current;
    const start = input?.selectionStart ?? draft.body.length;
    const end = input?.selectionEnd ?? draft.body.length;
    const value = "{{" + token + "}}";
    updateDraft("body", draft.body.slice(0, start) + value + draft.body.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const save = async () => {
    if (!selected || selected.owner !== "viasee" || saving || !dirty) return;
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", {
        action: "save",
        key: selected.key,
        subject_template: draft.subject,
        body_template: draft.body,
      });
      if (response.data?.error) throw new Error(response.data.error);
      if (await load(selected.key)) {
        setMode("preview");
        setNotice("Salvat si activat. Urmatoarele emailuri folosesc acest text.");
      }
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!selected?.override || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await base44.functions.invoke("automaticEmailOps", { action: "reset", key: selected.key });
      if (response.data?.error) throw new Error(response.data.error);
      if (await load(selected.key)) {
        setMode("preview");
        setNotice("Varianta standard este din nou activa.");
      }
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!selected) return;
    setDrafts((current) => ({
      ...current,
      [selected.key]: {
        subject: selected.effective_subject || "",
        body: selected.effective_body || "",
      },
    }));
    setError("");
    setNotice("");
  };

  const badge = selected ? status(selected, dirty) : null;
  const previewSubject = selected?.owner === "viasee" ? render(draft.subject, variables) : "";
  const previewBody = selected?.owner === "viasee" ? render(draft.body, variables) : "";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">
          Alege un email pentru a vedea cand se trimite si cum arata pentru destinatar. Modificarile devin active numai dupa salvare.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Emailuri VIASEE", value: templates.length, filter: "viasee", description: "Previzualizare si editare" },
            { label: "Personalizate", value: customCount, filter: "custom", description: "Sabloane modificate" },
            { label: "Gestionate extern", value: external.length, filter: "external", description: "Base44 si Stripe" },
          ].map((item) => (
            <button
              key={item.filter}
              type="button"
              onClick={() => { setSource(item.filter); setGroup("all"); }}
              className={"rounded-xl border p-3 text-left transition-colors hover:bg-secondary/40 " + (source === item.filter ? "border-foreground bg-secondary/40" : "border-border")}
              aria-pressed={source === item.filter}
            >
              <span className="block text-2xl font-bold text-foreground">{item.value}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se incarca emailurile...</p>}

      {!loading && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cauta mesaj</span>
              <Search className="absolute bottom-3 left-3 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ex: verificare, plata, revendicare"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <label className="min-w-[190px]">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Categorie</span>
              <select value={group} onChange={(event) => setGroup(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                <option value="all">Toate categoriile</option>
                {groups.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filtre dupa sursa">
            {sourceFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSource(item.key)}
                aria-pressed={source === item.key}
                className={"rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " + (source === item.key ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary")}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(230px,300px)_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">{listed.length} mesaje gasite</div>
              <div className="max-h-[min(70vh,720px)] overflow-y-auto p-2">
                {!listed.length && <p className="p-4 text-sm text-muted-foreground">Nu exista mesaje pentru filtrele alese.</p>}
                {listed.map((item) => {
                  const itemDraft = drafts[item.key];
                  const itemDirty = item.owner === "viasee" && itemDraft && (
                    itemDraft.subject !== item.effective_subject || itemDraft.body !== item.effective_body
                  );
                  const itemBadge = status(item, itemDirty);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => choose(item)}
                      aria-current={selectedKey === item.key ? "true" : undefined}
                      className={"mb-1 w-full rounded-xl border p-3 text-left transition-colors " + (selectedKey === item.key ? "border-foreground bg-secondary/50" : "border-transparent hover:border-border hover:bg-secondary/30")}
                    >
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.group}</span>
                      <span className={"mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold " + itemBadge.className}>{itemBadge.label}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section ref={detailRef} className="min-w-0 space-y-4 scroll-mt-20">
              {!selected && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Alege un alt filtru pentru a vedea mesaje.</div>}
              {selected && (
                <>
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selected.group}</p>
                        <h2 className="mt-1 text-xl font-bold text-foreground">{selected.title}</h2>
                      </div>
                      <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + badge.className}>{badge.label}</span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-semibold text-muted-foreground">Cand se trimite</dt><dd className="mt-1 text-foreground">{selected.trigger}</dd></div>
                      <div><dt className="text-xs font-semibold text-muted-foreground">Catre cine</dt><dd className="mt-1 text-foreground">{selected.recipient}</dd></div>
                    </dl>
                    {selected.override && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Versiunea {selected.override.revision}
                        {selected.override.updated_at ? " · " + new Date(selected.override.updated_at).toLocaleString("ro-RO") : ""}
                        {selected.override.updated_by_email ? " · " + selected.override.updated_by_email : ""}
                      </p>
                    )}
                  </div>

                  {selected.owner === "viasee" ? (
                    <>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setMode("preview")} aria-pressed={mode === "preview"} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold " + (mode === "preview" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary")}>
                          <Eye className="h-4 w-4" /> Previzualizare
                        </button>
                        <button type="button" onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold " + (mode === "edit" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary")}>
                          <Pencil className="h-4 w-4" /> Editeaza
                        </button>
                      </div>

                      <div className={mode === "edit" ? "grid items-start gap-4 2xl:grid-cols-2" : ""}>
                        {mode === "edit" && (
                          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                            <div>
                              <h3 className="text-sm font-bold text-foreground">Editeaza mesajul</h3>
                              <p className="mt-1 text-xs text-muted-foreground">Variabilele se completeaza automat la trimitere.</p>
                            </div>
                            <label className="block text-sm font-semibold text-foreground">
                              Subiect
                              <input value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} maxLength={180} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal" />
                            </label>
                            <label className="block text-sm font-semibold text-foreground">
                              Continut email
                              <textarea ref={bodyRef} value={draft.body} onChange={(event) => updateDraft("body", event.target.value)} rows={14} maxLength={6000} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-normal" />
                            </label>
                            {!!selected.variables?.length && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground">Insereaza o variabila in text</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {selected.variables.map((token) => (
                                    <button key={token} type="button" onClick={() => insertVariable(token)} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-secondary">
                                      {"{{" + token + "}}"}
                                    </button>
                                  ))}
                                </div>
                                {!!selected.required?.length && <p className="mt-2 text-xs text-muted-foreground">Obligatorii: {selected.required.map((token) => "{{" + token + "}}").join(", ")}</p>}
                              </div>
                            )}
                            <div role="status" className={"rounded-lg p-2.5 text-xs " + (errors.length ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800")}>
                              {errors.length ? errors[0] : "Textul este valid si poate fi salvat."}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={save} disabled={saving || !dirty || !!errors.length} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salveaza si activeaza
                              </button>
                              <button type="button" onClick={discard} disabled={!dirty || saving} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Anuleaza editarea</button>
                              <button type="button" onClick={reset} disabled={!selected.override || saving} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                                <RotateCcw className="h-4 w-4" /> Revino la standard
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="overflow-hidden rounded-2xl border border-border bg-secondary/30">
                          <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Email vazut de destinatar</h3>
                            <span className="text-xs text-muted-foreground">Date fictive</span>
                          </div>
                          <div className="m-3 rounded-xl border border-border bg-white p-4 sm:p-5">
                            <p className="text-xs text-slate-500">De la: VIASEE</p>
                            <p className="mt-1 text-xs text-slate-500">Catre: destinatar@exemplu.ro</p>
                            <p className="mt-3 break-words border-b border-slate-200 pb-3 text-base font-bold text-slate-900">{previewSubject || "Fara subiect"}</p>
                            <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{previewBody || "Fara continut"}</div>
                          </div>
                          {dirty && <p className="px-4 pb-4 text-xs font-semibold text-sky-900">Acesta este un preview al modificarilor nesalvate.</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <h3 className="text-base font-bold text-amber-950">Gestionat de {selected.owner === "stripe" ? "Stripe" : "Base44"}</h3>
                      <p className="mt-2 text-sm text-amber-900">{selected.note}</p>
                      <p className="mt-3 text-sm text-amber-900">Continutul exact si activarea se verifica in contul furnizorului. Acest mesaj nu poate fi modificat aici.</p>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
          <p className="text-xs text-muted-foreground">
            VIASEE nu trimite in prezent remindere de programare. Notificarile de plata depind de configuratia Stripe.
          </p>
        </>
      )}
    </div>
  );
}
