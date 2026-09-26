import { useCallback, useEffect, useRef, useState } from "react";

// Polling may overlap a user action. Only the current operation may update the UI.
// Each panel mounts a separate keyed session for its recipient.
function mergeLatest(current, next) {
  if (!current?.messages?.length || current.chat?.id !== next.chat?.id) return next;
  const ids = new Set(current.messages.map((message) => message.id));
  if (!next.messages?.some((message) => ids.has(message.id))) return next;
  const messages = [...new Map([...current.messages, ...next.messages].map((message) => [message.id, message])).values()]
    .sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)) || String(a.id).localeCompare(String(b.id)));
  return { ...next, messages, next_before_message_id: current.next_before_message_id };
}

export default function useControlledChatSession({ invoke, enabled = true, readOnly = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(false);
  const sequence = useRef(0);
  const mutation = useRef(false);
  const readingOlder = useRef(false);

  const fail = useCallback((cause, fallback) => {
    setError(cause?.response?.data?.error || cause?.message || fallback);
    if ([401, 402, 403, 404].includes(cause?.response?.status || cause?.status)) setData(null);
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!enabled || !alive.current || mutation.current || readingOlder.current) return;
    const ticket = ++sequence.current;
    const current = () => alive.current && sequence.current === ticket;
    if (!silent) { setLoading(true); setError(""); }
    try {
      let next = await invoke("status");
      if (!current()) return;
      if (!readOnly && Number(next.chat?.unread_count) > 0) {
        next = await invoke("mark_read");
        if (!current()) return;
      }
      setData((previous) => mergeLatest(previous, next));
      setError("");
    } catch (cause) {
      if (current()) fail(cause, "Conversația nu a putut fi încărcată. Reîncearcă actualizarea.");
    } finally {
      if (current()) setLoading(false);
    }
  }, [enabled, fail, invoke, readOnly]);

  useEffect(() => {
    alive.current = true;
    setData(null);
    setError("");
    setLoading(enabled);
    void load();
    return () => { alive.current = false; sequence.current += 1; };
  }, [enabled, load]);

  const mutate = async (nextAction, values = {}) => {
    if (!enabled || readOnly || !alive.current || mutation.current) return false;
    mutation.current = true;
    readingOlder.current = false;
    const ticket = ++sequence.current;
    const current = () => alive.current && sequence.current === ticket;
    setLoading(false);
    setLoadingOlder(false);
    setAction(nextAction);
    setError("");
    try {
      const next = await invoke(nextAction, values);
      if (!current()) return false;
      setData((previous) => mergeLatest(previous, next));
      return true;
    } catch (cause) {
      if (current()) fail(cause, "Acțiunea nu a putut fi confirmată. Poți reîncerca.");
      return false;
    } finally {
      if (current()) { mutation.current = false; setAction(""); }
    }
  };

  const loadOlder = async () => {
    const cursor = data?.next_before_message_id;
    if (!cursor || !alive.current || mutation.current || readingOlder.current || loading) return;
    readingOlder.current = true;
    const ticket = ++sequence.current;
    const current = () => alive.current && sequence.current === ticket;
    setLoadingOlder(true);
    setError("");
    try {
      const page = await invoke("status", { before_message_id: cursor });
      if (!current()) return;
      setData((previous) => ({
        ...previous,
        messages: [...new Map([...page.messages, ...previous.messages].map((message) => [message.id, message])).values()],
        next_before_message_id: page.next_before_message_id,
      }));
    } catch (cause) {
      if (current()) fail(cause, "Mesajele mai vechi nu au putut fi încărcate.");
    } finally {
      if (current()) { readingOlder.current = false; setLoadingOlder(false); }
    }
  };

  return { data, loading, loadingOlder, action, error, load, mutate, loadOlder };
}
