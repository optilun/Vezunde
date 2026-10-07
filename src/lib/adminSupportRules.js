// Reguli pentru Tichete suport (2026-10-07). Fără React, ca să poată fi verificate din scripts/.
// Ce înseamnă „cere o acțiune de la mine”, în ce ordine se rezolvă tichetele și când e valid un răspuns.

import { ACTIVE_TICKET_STATUSES } from "./adminCounts.js";
import { deadlineInfo, waitingInfo } from "./adminFormat.js";

// Cererile de ștergere a contului vin din Setările contului (getMyAccountDeletionEligibility, action
// "request") cu această sursă. Termenul de răspuns e de 30 de zile, aceeași valoare ca
// ACCOUNT_DELETION_RESPONSE_DAYS din backend.
export const ACCOUNT_DELETION_SOURCE = "account_deletion_request";
export const ACCOUNT_DELETION_RESPONSE_DAYS = 30;

const ACTIVE = new Set(ACTIVE_TICKET_STATUSES);
const NEEDS_ADMIN = new Set(["open", "in_progress"]);
// Stările în care utilizatorul trebuie să vadă un răspuns scris: nu poate afla altfel ce s-a întâmplat.
const REQUIRES_RESPONSE = new Set(["waiting_user", "resolved", "closed"]);

export const ticketStatusOf = (ticket) => ticket?.status || "open";
export const isActiveTicket = (ticket) => ACTIVE.has(ticketStatusOf(ticket));
export const isClosedTicket = (ticket) => ["resolved", "closed"].includes(ticketStatusOf(ticket));
// Mingea e la tine: „Deschis” sau „În lucru”. „Așteaptă utilizatorul” nu cere nimic de la tine acum.
export const needsAdmin = (ticket) => NEEDS_ADMIN.has(ticketStatusOf(ticket));

export const isAccountDeletionRequest = (ticket) => ticket?.source === ACCOUNT_DELETION_SOURCE;

// Termenul de 30 de zile al unei cereri de ștergere încă deschise (altfel null).
export function accountDeletionDeadline(ticket, now = Date.now()) {
  if (!isAccountDeletionRequest(ticket) || !isActiveTicket(ticket)) return null;
  return deadlineInfo(ticket.created_date, ACCOUNT_DELETION_RESPONSE_DAYS, now);
}

// De când așteaptă tichetul după tine: „Deschis” de la creare, „În lucru” de la ultima modificare.
// Pentru „Așteaptă utilizatorul” e de când i-ai răspuns; tichetele încheiate nu așteaptă nimic.
export function ticketWaitingSince(ticket) {
  const status = ticketStatusOf(ticket);
  if (status === "open") return ticket.created_date || null;
  if (status === "in_progress" || status === "waiting_user") return ticket.updated_date || ticket.created_date || null;
  return null;
}

// Indiciu vizual pentru rând: { label, tone }. Doar tichetele care așteaptă după tine capătă avertisment
// (de la 3 zile) sau alertă (de la 7 zile); cele care așteaptă utilizatorul rămân neutre.
export function ticketWaiting(ticket, now = Date.now()) {
  const since = ticketWaitingSince(ticket);
  const info = since ? waitingInfo(since, now) : null;
  if (!info) return null;
  return { ...info, tone: needsAdmin(ticket) ? info.tone : "neutral" };
}

const PRIORITY_RANK = { urgent: 0, high: 1 };

function timeOf(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Ordinea de lucru: 1) cereri de ștergere cu termen, cel mai apropiat primul, 2) tichete care cer acțiune,
// după prioritate și apoi cele mai vechi primele, 3) tichete care așteaptă utilizatorul, cele mai vechi primele,
// 4) tichete încheiate, cele mai recente primele.
export function sortSupportTickets(tickets, now = Date.now()) {
  const groupOf = (ticket) => {
    if (accountDeletionDeadline(ticket, now)) return 0;
    if (needsAdmin(ticket)) return 1;
    if (ticketStatusOf(ticket) === "waiting_user") return 2;
    return 3;
  };
  // Datele lipsă merg la final, în ambele sensuri.
  const byTime = (a, b, direction) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return direction * (a - b);
  };
  const oldest = (a, b, pick) => byTime(timeOf(pick(a)), timeOf(pick(b)), 1);
  return [...tickets].sort((a, b) => {
    const groupA = groupOf(a);
    const groupB = groupOf(b);
    if (groupA !== groupB) return groupA - groupB;
    if (groupA === 0) {
      return accountDeletionDeadline(a, now).daysLeft - accountDeletionDeadline(b, now).daysLeft
        || oldest(a, b, (ticket) => ticket.created_date);
    }
    if (groupA === 1) {
      return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || oldest(a, b, ticketWaitingSince);
    }
    if (groupA === 2) return oldest(a, b, ticketWaitingSince);
    const latest = (ticket) => timeOf(ticket.updated_date || ticket.created_date);
    return byTime(latest(a), latest(b), -1);
  });
}

// După ce termini un tichet: următorul care cere acțiune, în ordinea de lucru (nu neapărat cel de sub el).
export function nextTicketToHandle(orderedTickets, currentId) {
  return orderedTickets.find((ticket) => ticket.id !== currentId && needsAdmin(ticket))?.id || "";
}

// Mesajul de eroare (sau "") pentru o salvare: anumite stări cer un răspuns scris.
export function ticketUpdateProblem({ status, response }) {
  if (!REQUIRES_RESPONSE.has(status) || String(response || "").trim()) return "";
  return status === "waiting_user"
    ? "Scrie ce îi ceri utilizatorului înainte de a trimite."
    : "Scrie răspunsul pentru utilizator înainte de a încheia tichetul.";
}

// Ce se salvează pe tichet. `responded_at` / `responded_by_user_id` se schimbă doar când textul răspunsului e nou.
export function buildTicketPayload({ ticket, status, priority, response, adminId = "", now = Date.now() }) {
  const text = String(response || "").trim();
  const changed = text !== String(ticket?.support_response || "").trim();
  return {
    status,
    priority,
    support_response: text,
    ...(changed && text ? { responded_at: new Date(now).toISOString(), responded_by_user_id: adminId || "" } : {}),
  };
}
