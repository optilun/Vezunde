// Conversatia vazuta de locatie. Logica de acces si apelurile catre controlledChatOps
// rămân neschimbate; prezentarea s-a mutat in ChatThread, comun cu partea pacientului.
import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ChatThread from "@/components/chat/ChatThread";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function createMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `chat:${globalThis.crypto.randomUUID()}`;
  return `chat:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function ProviderLeadChat({ leadId, locationId, enabled, responseType, terminal = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback(async (nextAction, values = {}) => {
    const response = await base44.functions.invoke("controlledChatOps", {
      actor: "provider",
      action: nextAction,
      location_id: locationId,
      lead_id: leadId,
      ...values,
    });
    return responseData(response);
  }, [leadId, locationId]);

  const load = useCallback(async () => {
    if (!enabled || !ELIGIBLE_RESPONSES.has(responseType)) return;
    setLoading(true);
    setError("");
    try {
      let next = await invoke("status");
      if (!terminal && Number(next.chat?.unread_count) > 0) next = await invoke("mark_read");
      setData(next);
    } catch (loadError) {
      setError(loadError?.message || "Conversația nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
  }, [enabled, invoke, responseType, terminal]);

  useEffect(() => { void load(); }, [load]);

  const send = async (message) => {
    if (terminal) return false;
    setAction("send");
    setError("");
    try {
      setData(await invoke("send", { message, client_message_id: createMessageId() }));
      return true;
    } catch (sendError) {
      setError(sendError?.message || "Mesajul nu a putut fi trimis.");
      return false;
    } finally {
      setAction("");
    }
  };

  const close = async () => {
    if (terminal) return;
    setAction("close");
    setError("");
    try {
      setData(await invoke("close"));
    } catch (closeError) {
      setError(closeError?.message || "Conversația nu a putut fi închisă.");
    } finally {
      setAction("");
    }
  };

  if (!enabled || !ELIGIBLE_RESPONSES.has(responseType)) return null;

  const opened = data?.chat?.status === "open";
  const closed = data?.chat?.status === "closed";
  const notOpened = !opened && !closed;

  return (
    <div className="mt-5">
      <ChatThread
        title={terminal ? "Istoric chat VIASEE · Pro" : "Chat VIASEE · Pro"}
        hint={terminal
          ? "Conversația este disponibilă numai pentru consultare. Datele de contact rămân blocate."
          : "Clientul deschide conversația. Telefonul, emailurile și linkurile sunt blocate în mesaje."}
        messages={data?.messages || []}
        mineSenderType="provider"
        meLabel="Locația"
        otherLabel="Client"
        loading={loading}
        sending={Boolean(action)}
        error={error}
        lockedNote={notOpened
          ? (terminal
            ? "Cererea este încheiată și nu a existat o conversație VIASEE pentru acest lead."
            : "Clientul nu a deschis încă această conversație. Locația nu poate iniția chatul unilateral.")
          : ""}
        canSend={!terminal && opened && Boolean(data?.chat?.can_send)}
        footerNote={terminal
          ? "Cererea este încheiată. Istoricul rămâne numai pentru consultare."
          : closed
            ? "Conversația este închisă. Clientul o poate redeschide dacă leadul rămâne eligibil."
            : ""}
        onSend={send}
        onClose={close}
        onRefresh={() => void load()}
      />
    </div>
  );
}