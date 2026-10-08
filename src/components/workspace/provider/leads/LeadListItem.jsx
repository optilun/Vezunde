import React from "react";
import { Archive } from "lucide-react";
function when(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(date);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Ieri" : new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short" }).format(date);
}
export default function LeadListItem({ lead, response = null, selected = false, onSelect, locationName = "", planLabel = "" }) {
  const terminal = lead.is_historical === true;
  const chat = lead.chat_summary;
  const unread = Number(chat?.unread_count) || 0;
  const title = lead.intent_label || "Cerere client";
  const preview = chat?.last_message_preview ? `${chat.last_message_sender_type === "provider" ? "Locația: " : ""}${chat.last_message_preview}` : lead.preview_summary || "Rezumat indisponibil";
  const status = terminal ? "Încheiată" : (response || lead.provider_response)?.response_label || ({ new: "Cerere nouă", viewed: "Văzută", interested: "Putem ajuta", needs_details: "Detalii necesare", declined: "Nu putem ajuta" }[lead.status] || "Activă");
  return <button type="button" className="inbox-row" aria-current={selected ? "true" : undefined} onClick={onSelect}>
    <span className="inbox-avatar" aria-hidden="true">{terminal ? <Archive /> : title.slice(0, 1).toUpperCase()}</span>
    <span className="inbox-row-body"><span className="inbox-row-top"><span className="inbox-row-title">{title}</span><time dateTime={chat?.last_message_at || lead.created_date}>{when(chat?.last_message_at || lead.created_date)}</time></span>
      <span className="inbox-row-preview"><span>{preview}</span>{unread > 0 && <span className="inbox-unread" aria-label={`${unread} mesaje necitite`}>{unread > 99 ? "99+" : unread}</span>}</span>
      <span className="inbox-row-state"><span className={!terminal && lead.status === "new" ? "inbox-new" : ""}>{status}</span>{chat && <span>· {chat.status === "open" ? "Chat deschis" : "Chat închis"}</span>}</span>
      {locationName && <span className="inbox-location">{locationName}{planLabel ? ` · ${planLabel}` : ""}</span>}
    </span>
  </button>;
}
