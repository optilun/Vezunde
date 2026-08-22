// Conversatia vazuta de pacient. Apelurile catre controlledChatOps si regula "doar
// pacientul deschide conversatia" rămân neschimbate; prezentarea foloseste ChatThread.
import React, { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import {
  createControlledChatMessageId,
  patientControlledChat,
} from "@/lib/patientRequestPersistenceClient";
import ChatThread from "@/components/chat/ChatThread";
import useChatLivePolling from "@/components/chat/useChatLivePolling";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

export default function PatientRequestChat({ requestId, accessToken, locationId, locationName, responseType }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback((nextAction, values = {}) => patientControlledChat({
    requestId,
    locationId,
    action: nextAction,
    explicitAccessToken: accessToken || "",
    ...values,
  }), [accessToken, locationId, requestId]);

  // silent = reimprospatare de fundal (polling): nu aprinde spinnerul si nu afiseaza erori
  // tranzitorii, ca sa nu palpaie conversatia la fiecare ciclu.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!requestId || !locationId || !ELIGIBLE_RESPONSES.has(responseType)) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      let next = await invoke("status");
      if (Number(next.chat?.unread_count) > 0) next = await invoke("mark_read");
      setData(next);
    } catch (loadError) {
      if (!silent) setError(loadError?.message || "Conversația nu a putut fi încărcată.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [invoke, locationId, requestId, responseType]);

  useEffect(() => { void load(); }, [load]);

  useChatLivePolling({
    active: data?.chat?.status === "open",
    busy: loading || Boolean(action),
    onPoll: () => load({ silent: true }),
  });

  const open = async () => {
    setAction("open");
    setError("");
    try {
      setData(await invoke("open"));
    } catch (openError) {
      setError(openError?.message || "Conversația nu a putut fi deschisă.");
    } finally {
      setAction("");
    }
  };

  const send = async (message) => {
    setAction("send");
    setError("");
    try {
      setData(await invoke("send", { message, clientMessageId: createControlledChatMessageId() }));
      return true;
    } catch (sendError) {
      setError(sendError?.message || "Mesajul nu a putut fi trimis.");
      return false;
    } finally {
      setAction("");
    }
  };

  const close = async () => {
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