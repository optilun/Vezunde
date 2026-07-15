import React, { useEffect, useState } from "react";
import { Frown, Heart, Loader2, Meh, Send, Smile, ThumbsDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RATINGS = [
  { value: 1, label: "Slaba", icon: ThumbsDown },
  { value: 2, label: "Sub asteptari", icon: Frown },
  { value: 3, label: "Acceptabila", icon: Meh },
  { value: 4, label: "Buna", icon: Smile },
  { value: 5, label: "Excelenta", icon: Heart },
];

export default function FeedbackDialog({ open, onOpenChange, user, workspace }) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setRating(0);
      setMessage("");
      setStatus("idle");
      setError("");
    }
  }, [open]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!rating || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const currentUser = user || await base44.auth.me();
      const payload = {
        rating,
        message: message.trim(),
        user_id: currentUser?.id || "",
        user_email: currentUser?.email || "",
        account_mode: workspace?.kind === "organization" ? "provider" : workspace?.kind || "personal",
        source: "account_sidebar",
        page_path: `${window.location.pathname}${window.location.search}`,
        status: "new",
      };
      if (workspace?.organizationId) payload.organization_id = workspace.organizationId;
      if (workspace?.professionalProfileId) payload.professional_profile_id = workspace.professionalProfileId;
      await base44.entities.UserFeedback.create(payload);
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Feedback-ul nu a putut fi trimis momentan. Incearca din nou in cateva clipe.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl rounded-3xl border-border bg-card p-0 shadow-2xl">
        {status === "sent" ? (
          <div className="px-6 py-10 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-800">
              <Heart className="h-6 w-6" />
            </div>
            <DialogTitle className="mt-5 font-heading text-xl font-extrabold">Multumim pentru feedback</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              Mesajul tau a ajuns la echipa VIASEE si ne ajuta sa prioritizam imbunatatirile produsului.
            </DialogDescription>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
            >
              Inchide
            </button>
          </div>
        ) : (
          <form onSubmit={submitFeedback}>
            <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left sm:px-8">
              <DialogTitle className="font-heading text-xl font-extrabold">Cum este experienta ta in VIASEE?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">Feedback-ul tau ne ajuta sa construim mai bine urmatoarele etape.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 px-6 py-6 sm:px-8">
              <fieldset>
                <legend className="sr-only">Evalueaza experienta</legend>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                  {RATINGS.map((item) => {
                    const Icon = item.icon;
                    const selected = rating === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setRating(item.value)}
                        aria-pressed={selected}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition ${selected ? "bg-foreground text-background shadow-sm" : "bg-secondary/55 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="hidden text-[10px] font-semibold leading-tight sm:block">{item.label}</span>
                        <span className="text-[10px] font-semibold sm:hidden">{item.value}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="feedback-message" className="text-xs font-semibold text-muted-foreground">Ce putem imbunatati?</label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1200}
                  rows={5}
                  placeholder="Spune-ne ce functioneaza bine, ce te incurca sau ce lipseste..."
                  className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/40"
                />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">{message.length}/1200</div>
              </div>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}

              <button
                type="submit"
                disabled={!rating || status === "sending"}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Trimite feedback
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
