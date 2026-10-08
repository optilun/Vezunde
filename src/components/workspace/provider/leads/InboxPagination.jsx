import React from "react";
export default function InboxPagination({ page, count, busy, onPage }) {
  if (!page?.total) return null;
  return <div className="inbox-pagination"><span>{page.offset + 1}–{Math.min(page.offset + count, page.total)} din {page.total}</span><div className="flex gap-1"><button type="button" className="inbox-button" disabled={busy || page.offset === 0} onClick={() => onPage(Math.max(0, page.offset - page.limit))}>Înapoi</button><button type="button" className="inbox-button" disabled={busy || !page.has_more} onClick={() => onPage(page.offset + page.limit)}>Înainte</button></div></div>;
}
