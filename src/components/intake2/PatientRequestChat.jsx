// Conversatia vazuta de pacient. Apelurile catre controlledChatOps si regula "doar
// pacientul deschide conversatia" rămân neschimbate; prezentarea foloseste ChatThread.
import React, { useCallback } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import {
  patientControlledChat,
} from "@/lib/patientRequestPersistenceClient";
import ChatThread from "@/components/chat/ChatThread";
import useChatLivePolling from "@/components/chat/useChatLivePolling";
import useControlledChatSession from "@/components/chat/useControlledChatSession";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

export default function PatientRequestChat(props) {
  const { requestId, locationId, responseType } = props;
  return <PatientChatSession key={JSON.stringify([requestId, locationId, responseType])} {...props} />;
}

function PatientChatSession({ requestId, accessToken, locationId, locationName, responseType }) {
  const invoke = useCallback((nextAction, values = {}) => patientControlledChat({
    requestId,
    locationId,
    action: nextAction,
    explicitAccessToken: accessToken || "",
    ...values,
    beforeMessageId: values.before_message_id || "",
  }), [accessToken, locationId, requestId]);

  const { data, loading, loadingOlder, action, error, load, mutate, loadOlder } = useControlledChatSession({
    invoke,
    enabled: Boolean(requestId && locationId) && ELIGIBLE_RESPONSES.has(responseType),
    readOnly: false,
  });

  const conversationOpen = data?.chat?.status === "open";
  useChatLivePolling({
    active: conversationOpen,
    busy: loading || loadingOlder || Boolean(action),
    onPoll: () => load({ silent: true }),
  });

  const send = (message, clientMessageId) => mutate("send", { message, clientMessageId });
  const close = () => mutate("close");
  const open = () => mutate("open");

  if (!ELIGIBLE_RESPONSES.has(responseType)) return null;
  if (loading && !data) return <div className="mt-4 flex min-h-16 items-center justify-center rounded-xl border border-border bg-secondary/25 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm disponibilitatea chatului...</div>;
  if (!data?.chat?.can_open && data?.chat?.status === "not_opened" && !error) return null;

  const opened = data?.chat?.status === "open";
  const closed = data?.chat?.status === "closed";
  const partner = locationName || data?.location?.name || "locația";

  if (data?.chat?.can_open && !opened) {
    return (
      <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground"><MessageCircle className="h-4 w-4 text-primary" /> Chat VIASEE cu {partner}</p>
        <p className="mt-1 text-xs font-semibold text-foreground">Tu controlezi deschiderea conversației.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Locația nu îți poate scrie până când nu deschizi explicit chatul. Nu introduce telefon, email sau linkuri; aceste date se gestionează separat.</p>
        {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
        <button type="button" onClick={() => void open()} disabled={Boolean(action)} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background disabled:opacity-60">
          {action === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} Deschide conversația
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ChatThread
        title={`Chat VIASEE cu ${partner}`}
        hint="Conversația rămâne în VIASEE. Nu introduce telefon, email sau linkuri; aceste date sunt gestionate separat."
        messages={data?.messages || []}
        mineSenderType="patient"
        meLabel="Tu"
        otherLabel={locationName || "Locația"}
        loading={loading}
        sending={Boolean(action)}
        loadingOlder={loadingOlder}
        hasOlder={Boolean(data?.next_before_message_id)}
        onLoadOlder={loadOlder}
        error={error}
        emptyNote="Conversația este deschisă. Poți trimite primul mesaj."
        canSend={opened && Boolean(data?.chat?.can_send)}
        lastOwnMessageSeen={Boolean(data?.chat?.last_own_message_seen)}
        footerNote={closed ? "Conversația este închisă. O poți redeschide cât timp locația rămâne eligibilă." : ""}
        onSend={send}
        onClose={close}
        onRefresh={() => void load()}
      />
    </div>
  );
}