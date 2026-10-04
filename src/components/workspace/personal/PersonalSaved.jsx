import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, Building2, Loader2, MapPin, UserRound, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";
import { readableErrorMessage } from "@/lib/transientRetry";

// 2026-10-04 (structura conturilor, pasul 5). „Salvate”: locațiile și specialiștii salvați cu
// butonul „Salvează” de pe paginile lor publice.

async function savedItemsOps(action, payload = {}) {
  try {
    const response = await base44.functions.invoke("mySavedItemsOps", { action, ...payload });
    const data = response?.data || {};
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(readableErrorMessage(error?.response?.data?.error || error?.message, "Salvatele nu au putut fi încărcate."));
  }
}

function subtitle(item) {
  if (item.item_type === "professional") return item.type_label || "Specialist";
  return PROVIDER_PROFILE_TYPES[item.provider_profile_type] || PROVIDER_TYPES[item.provider_type] || "Locație";
}

function SavedRow({ item, busy, onRemove }) {
  const Icon = item.item_type === "professional" ? UserRound : Building2;
  return (
    <article className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/60">
          {item.available && item.photo_url
            ? <img src={item.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            : <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          {item.available ? (
            <>
              <h2 className="truncate text-sm font-bold">{item.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{subtitle(item)}</span>
                {item.locality && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.locality}</span>}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold">{item.item_type === "professional" ? "Specialist" : "Locație"} indisponibilă</h2>
              <p className="mt-1 text-xs text-muted-foreground">Profilul nu mai este public. Îl poți scoate din listă.</p>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {item.available && (
          <Link to={item.url} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:flex-none">
            Vezi profilul <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <button type="button" onClick={() => onRemove(item)} disabled={busy} aria-label={`Scoate ${item.name || "profilul"} din Salvate`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Scoate
        </button>
      </div>
    </article>
  );
}

export default function PersonalSaved() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await savedItemsOps("list");
      setState({ loading: false, error: "", items: data.items || [] });
    } catch (error) {
      setState({ loading: false, error: error.message, items: [] });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (item) => {
    if (busy) return;
    setBusy(item.id);
    setActionError("");
    try {
      await savedItemsOps("remove", { item_type: item.item_type, item_id: item.item_id });
      setState((current) => ({ ...current, items: current.items.filter((row) => row.id !== item.id) }));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy("");
    }
  };

  const locations = state.items.filter((item) => item.item_type === "location");
  const professionals = state.items.filter((item) => item.item_type === "professional");

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Bookmark className="h-4 w-4" /></div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Salvate</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Locațiile și specialiștii pe care i-ai salvat cu butonul „Salvează” de pe pagina lor.</p>
          </div>
        </div>
      </section>

      {actionError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}
      {state.loading && <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Se încarcă salvatele...</div>}
      {!state.loading && state.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">{state.error}</div>}
      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nu ai salvat încă nimic. Deschide o locație sau un specialist și apasă „Salvează”.</p>
          <Link to="/cauta" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
            Caută o locație <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      {!state.loading && [["Locații", locations], ["Specialiști", professionals]].map(([title, items]) => items.length > 0 && (
        <section key={title} className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title} · {items.length}</h2>
          {items.map((item) => <SavedRow key={item.id} item={item} busy={busy === item.id} onRemove={(row) => void remove(row)} />)}
        </section>
      ))}
    </div>
  );
}
