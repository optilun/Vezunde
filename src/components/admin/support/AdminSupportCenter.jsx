import React, { useCallback, useEffect, useState } from "react";
import {
  Headphones,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminSupportTickets from "@/components/admin/support/AdminSupportTickets";
import AdminUserFeedback from "@/components/admin/support/AdminUserFeedback";

const ACTIVE_TICKET_STATUSES = new Set(["open", "in_progress", "waiting_user"]);

export default function AdminSupportCenter({ adminUser }) {
  const [view, setView] = useState("tickets");
  const [counts, setCounts] = useState({ tickets: 0, feedback: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [countsError, setCountsError] = useState("");

  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    setCountsError("");
    try {
      const [tickets, feedback] = await Promise.all([
        base44.entities.SupportTicket.list("-updated_date", 500),
        base44.entities.UserFeedback.list("-created_date", 500),
      ]);
      setCounts({
        tickets: (tickets || []).filter((ticket) => (
          ACTIVE_TICKET_STATUSES.has(ticket.status || "open")
        )).length,
        feedback: (feedback || []).filter((item) => (item.status || "new") === "new").length,
      });
    } catch (requestError) {
      setCountsError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Numărătoarea pentru suport nu a putut fi actualizată.",
      );
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <div className="space-y-4">
      <AdminCard className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:flex-1">
            <button
              type="button"
              onClick={() => setView("tickets")}
              aria-pressed={view === "tickets"}
              className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition ${
                view === "tickets"
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-background hover:bg-secondary/45"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                view === "tickets" ? "bg-background/15" : "bg-secondary text-muted-foreground"
              }`}>
                <Headphones className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Tichete de suport</span>
                <span className={`mt-1 block text-xs ${
                  view === "tickets" ? "text-background/70" : "text-muted-foreground"
                }`}>
                  Probleme care necesită răspuns și urmărire.
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                view === "tickets"
                  ? "bg-background text-foreground"
                  : "bg-secondary text-foreground"
              }`}>
                {loadingCounts ? "…" : counts.tickets}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setView("feedback")}
              aria-pressed={view === "feedback"}
              className={`flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition ${
                view === "feedback"
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border bg-background hover:bg-secondary/45"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                view === "feedback" ? "bg-background/15" : "bg-secondary text-muted-foreground"
              }`}>
                <MessageSquareText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Feedback utilizatori</span>
                <span className={`mt-1 block text-xs ${
                  view === "feedback" ? "text-background/70" : "text-muted-foreground"
                }`}>
                  Evaluări și sugestii trimise din conturi.
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                view === "feedback"
                  ? "bg-background text-foreground"
                  : "bg-secondary text-foreground"
              }`}>
                {loadingCounts ? "…" : counts.feedback}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadCounts}
            disabled={loadingCounts}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50 lg:w-auto"
          >
            {loadingCounts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizează numerele
          </button>
        </div>

        {countsError && (
          <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {countsError}
          </p>
        )}
      </AdminCard>

      {view === "tickets" ? (
        <AdminSupportTickets adminUser={adminUser} />
      ) : (
        <AdminUserFeedback />
      )}
    </div>
  );
}
