// Conversatia vazuta de locatie. Logica de acces si apelurile catre controlledChatOps
// rămân neschimbate; prezentarea s-a mutat in ChatThread, comun cu partea pacientului.
import React, { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import ChatThread from "@/components/chat/ChatThread";
import useChatLivePolling from "@/components/chat/useChatLivePolling";
import useControlledChatSession from "@/components/chat/useControlledChatSession";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderLeadChat(props) {
  const { leadId, locationId, enabled, responseType, terminal } = props;
  return <ProviderChatSession key={JSON.stringify([leadId, locationId, enabled, responseType, terminal])} {...props} />;
}

function ProviderChatSession({ leadId, locationId, enabled, responseType, terminal = false }) {
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

  const { data, loading, loadingOlder, action, error, load, mutate, loadOlder } = useControlledChatSession({
    invoke,
    enabled: Boolean(enabled) && ELIGIBLE_RESPONSES.has(responseType),
    readOnly: terminal,
  });

  const conversationOpen = data?.chat?.status === "open";
  useChatLivePolling({
    active: !terminal && conversationOpen,
    busy: loading || loadingOlder || Boolean(action),
    onPoll: () => load({ silent: true }),
  });

  const send = (message, clientMessageId) => mutate("send", { message, client_message_id: clientMessageId });
  const close = () => mutate("close");

  if (!enabled || !ELIGIBLE_RESPONSES.has(responseType)) return null;

  const opened = conversationOpen;
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
        loadingOlder={loadingOlder}
        hasOlder={Boolean(data?.next_before_message_id)}
        onLoadOlder={loadOlder}
        error={error}
        lockedNote={notOpened
          ? (terminal
            ? "Cererea este încheiată și nu a existat o conversație VIASEE pentru acest lead."
            : "Clientul nu a deschis încă această conversație. Locația nu poate iniția chatul unilateral.")
          : ""}
        canSend={!terminal && opened && Boolean(data?.chat?.can_send)}
        lastOwnMessageSeen={Boolean(data?.chat?.last_own_message_seen)}
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