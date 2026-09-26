// Keyset pages use server-owned created_date and id; never trust a client's timestamp.
// Resolve boundary ties separately because the SDK documents single-field sorting.
export const CHAT_HISTORY_PAGE_SIZE = 50;

function newestFirst(a, b) {
  return String(b.created_date).localeCompare(String(a.created_date))
    || String(b.id).localeCompare(String(a.id));
}

async function earlierRows(entity, scope, beforeDate) {
  const query = beforeDate ? { ...scope, created_date: { $lt: beforeDate } } : scope;
  const rows = await entity.filter(query, '-created_date', CHAT_HISTORY_PAGE_SIZE + 1);
  if (!rows.length) return [];
  const boundaryDate = rows[rows.length - 1].created_date;
  const boundary = await entity.filter(
    { ...scope, created_date: boundaryDate }, '-id', CHAT_HISTORY_PAGE_SIZE + 1,
  );
  return [...rows.filter((row) => row.created_date !== boundaryDate), ...boundary];
}

export async function loadChatMessagePage(svc, conversationId, beforeMessageId = '') {
  if (!conversationId) return { messages: [], next_before_message_id: null };
  const entity = svc.entities.PatientRequestMessage;
  const scope = { conversation_id: conversationId, status: 'active' };
  let rows;
  if (beforeMessageId) {
    const anchor = await entity.get(beforeMessageId).catch(() => null);
    if (!anchor || anchor.conversation_id !== conversationId || anchor.status !== 'active') {
      const error = new Error('Pagina de mesaje nu mai este disponibilă. Actualizează conversația.');
      error.status = 400;
      throw error;
    }
    const tied = await entity.filter({
      ...scope, created_date: anchor.created_date, id: { $lt: anchor.id },
    }, '-id', CHAT_HISTORY_PAGE_SIZE + 1);
    rows = tied.length > CHAT_HISTORY_PAGE_SIZE
      ? tied
      : [...tied, ...await earlierRows(entity, scope, anchor.created_date)];
  } else {
    rows = await earlierRows(entity, scope);
  }
  const ordered = [...new Map(rows.map((row) => [row.id, row])).values()].sort(newestFirst);
  const page = ordered.slice(0, CHAT_HISTORY_PAGE_SIZE);
  return {
    messages: page.reverse(),
    next_before_message_id: ordered.length > CHAT_HISTORY_PAGE_SIZE ? page[0].id : null,
  };
}
