import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Headphones,
  LifeBuoy,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  TicketCheck,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import ViaseeBrand from "@/components/brand/ViaseeBrand";
import FeedbackDialog from "@/components/account/FeedbackDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TICKET_STATUS = {
  open: { label: "Deschis", tone: "bg-blue-100 text-blue-900" },
  in_progress: { label: "In lucru", tone: "bg-amber-100 text-amber-900" },
  waiting_user: { label: "Asteapta raspunsul tau", tone: "bg-violet-100 text-violet-900" },
  resolved: { label: "Rezolvat", tone: "bg-green-100 text-green-900" },
  closed: { label: "Inchis", tone: "bg-secondary text-muted-foreground" },
};

const CATEGORY_LABELS = {
  account: "Cont si autentificare",
  organization: "Organizatie sau locatie",
  professional: "Profil profesional",
  patient_request: "Solicitari pacienti",
  technical: "Problema tehnica",
  other: "Alta situatie",
};

const OPEN_STATUSES = new Set(["open", "in_progress", "waiting_user"]);

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusBadge({ status }) {
  const presentation = TICKET_STATUS[status] || TICKET_STATUS.open;
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${presentation.tone}`}>{presentation.label}</span>;
}

export default function HelpSupport() {
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("open");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ category: "technical", subject: "", description: "" });
  const [ticketStatus, setTicketStatus] = useState("idle");
  const [ticketError, setTicketError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const rows = await base44.entities.SupportTicket.filter(
        { requester_user_id: currentUser.id },
        "-updated_date",
        50,
      );
      setTickets(rows || []);
    } catch {
      setLoadError("Tichetele nu au putut fi incarcate momentan. Foloseste butonul Actualizeaza pentru a incerca din nou.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    if (activeTab === "all") return true;
    if (activeTab === "closed") return !OPEN_STATUSES.has(ticket.status);
    return OPEN_STATUSES.has(ticket.status);
  }), [activeTab, tickets]);

  const openCount = tickets.filter((ticket) => OPEN_STATUSES.has(ticket.status)).length;
  const closedCount = tickets.length - openCount;

  const openNewTicket = () => {
    setTicketForm({ category: "technical", subject: "", description: "" });
    setTicketStatus("idle");
    setTicketError("");
    setNewTicketOpen(true);
  };

  const submitTicket = async (event) => {
    event.preventDefault();
    if (!user || ticketStatus === "sending") return;
    setTicketStatus("sending");
    setTicketError("");
    try {
      const created = await base44.entities.SupportTicket.create({
        requester_user_id: user.id,
        requester_email: user.email || "",
        requester_name: user.full_name || user.name || "Utilizator VIASEE",
        category: ticketForm.category,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        status: "open",
        priority: "normal",
        source: "help_center",
        page_path: `${window.location.pathname}${window.location.search}`,
      });
      setTickets((current) => [created, ...current]);
      setTicketStatus("sent");
      setTimeout(() => {
        setNewTicketOpen(false);
        setSelectedTicket(created);
      }, 650);
    } catch {
      setTicketStatus("error");
      setTicketError("Solicitarea nu a putut fi trimisa momentan. Incearca din nou in cateva clipe.");
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-[#f7f5f1] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-[#f7f5f1]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <ViaseeBrand />
          <Link to="/contul-meu" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold transition hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" /> Inapoi la cont
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background"><LifeBuoy className="h-5 w-5" /></span>
          <h1 className="mt-5 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Ajutor si suport VIASEE</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Gaseste raspunsuri rapide, trimite feedback sau urmareste o solicitare de suport din acelasi loc, indiferent de spatiul in care lucrezi.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <a href="#ghid-rapid" className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-900"><BookOpen className="h-5 w-5" /></span>
            <h2 className="mt-5 text-base font-bold">Ghid rapid</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Raspunsuri despre contul personal, organizatii, locatii si profilul profesional.</p>
          </a>
          <button type="button" onClick={() => setFeedbackOpen(true)} className="group rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900"><MessageSquareText className="h-5 w-5" /></span>
            <h2 className="mt-5 text-base font-bold">Trimite feedback</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Spune-ne ce functioneaza, ce lipseste sau ce ar trebui imbunatatit in VIASEE.</p>
          </button>
          <button type="button" onClick={openNewTicket} className="group rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Headphones className="h-5 w-5" /></span>
            <h2 className="mt-5 text-base font-bold">Solicita ajutor</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Deschide un tichet pentru o problema de cont, organizatie, profil sau functionare.</p>
          </button>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-extrabold">Solicitarile mele</h2>
              <p className="mt-1 text-xs text-muted-foreground">Vezi statusul tichetelor trimise echipei VIASEE.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={loadTickets} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary">
                <RefreshCw className="h-3.5 w-3.5" /> Actualizeaza
              </button>
              <button type="button" onClick={openNewTicket} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background">
                <Plus className="h-3.5 w-3.5" /> Tichet nou
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-secondary/45 p-1">
            {[
              { key: "open", label: `Deschise (${openCount})` },
              { key: "closed", label: `Inchise (${closedCount})` },
              { key: "all", label: `Toate (${tickets.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition ${activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {loading && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca...</div>}
            {!loading && loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">{loadError}</div>}
            {!loading && !loadError && filteredTickets.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 px-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"><TicketCheck className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-bold">Nu exista tichete in aceasta categorie</h3>
                <p className="mt-1 text-xs text-muted-foreground">Daca ai nevoie de ajutor, poti deschide o solicitare noua.</p>
                <button type="button" onClick={openNewTicket} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background"><Plus className="h-3.5 w-3.5" /> Creeaza tichet</button>
              </div>
            )}
            {!loading && filteredTickets.length > 0 && (
              <div className="divide-y divide-border">
                {filteredTickets.map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => setSelectedTicket(ticket)} className="flex w-full flex-col gap-3 py-4 text-left transition first:pt-0 last:pb-0 hover:opacity-75 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{ticket.subject}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{CATEGORY_LABELS[ticket.category] || "Suport"} · {formatDate(ticket.updated_date || ticket.created_date)}</span>
                    </span>
                    <StatusBadge status={ticket.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="ghid-rapid" className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="font-heading text-xl font-extrabold">Ghid rapid</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Unde schimb spatiul activ?", "Din selectorul de sus al sidebarului poti trece intre contul personal, profilul profesional si fiecare organizatie la care ai acces."],
              ["Unde sunt setarile contului?", "Setarile globale sunt in meniul utilizatorului din partea de jos. Setarile organizatiei si ale locatiei raman in workspace-ul lor."],
              ["Cum apare o organizatie in cont?", "Organizatia apare automat dupa ce ai un membership activ sau dupa aprobarea solicitarii de revendicare, adaugare ori acces."],
              ["Profilul profesional este acelasi cu organizatia?", "Nu. Profilul profesional apartine specialistului si poate fi asociat cu una sau mai multe locatii, fara sa devina proprietatea organizatiei."],
            ].map(([question, answer]) => (
              <article key={question} className="rounded-2xl border border-border bg-background p-4">
                <h3 className="text-sm font-bold">{question}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl rounded-3xl border-border bg-card p-0 shadow-2xl">
          <form onSubmit={submitTicket}>
            <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
              <DialogTitle className="font-heading text-xl font-extrabold">Spune-ne cu ce te putem ajuta</DialogTitle>
              <DialogDescription>Descrie situatia suficient de clar pentru ca echipa VIASEE sa o poata reproduce sau verifica.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-6">
              <div>
                <label htmlFor="ticket-category" className="text-xs font-semibold text-muted-foreground">Categorie</label>
                <select id="ticket-category" value={ticketForm.category} onChange={(event) => setTicketForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40">
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ticket-subject" className="text-xs font-semibold text-muted-foreground">Subiect</label>
                <input id="ticket-subject" required minLength={5} maxLength={140} value={ticketForm.subject} onChange={(event) => setTicketForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Pe scurt, ce nu functioneaza?" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40" />
              </div>
              <div>
                <label htmlFor="ticket-description" className="text-xs font-semibold text-muted-foreground">Descriere</label>
                <textarea id="ticket-description" required minLength={20} maxLength={3000} rows={7} value={ticketForm.description} onChange={(event) => setTicketForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ce incercai sa faci, ce s-a intamplat si care sunt pasii pentru reproducere?" className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground/40" />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">{ticketForm.description.length}/3000</div>
              </div>
              {ticketError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{ticketError}</p>}
              {ticketStatus === "sent" && <p className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800"><CheckCircle2 className="h-4 w-4" /> Tichetul a fost trimis.</p>}
              <button type="submit" disabled={ticketStatus === "sending" || ticketStatus === "sent"} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">
                {ticketStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Trimite solicitarea
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl rounded-3xl border-border bg-card p-0 shadow-2xl">
          {selectedTicket && (
            <>
              <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
                <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={selectedTicket.status} /><span className="text-[10px] font-semibold text-muted-foreground">{CATEGORY_LABELS[selectedTicket.category] || "Suport"}</span></div>
                <DialogTitle className="font-heading text-xl font-extrabold leading-snug">{selectedTicket.subject}</DialogTitle>
                <DialogDescription>Trimis {formatDate(selectedTicket.created_date)}</DialogDescription>
              </DialogHeader>
              <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-6">
                <article className="rounded-2xl border border-border bg-background p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mesajul tau</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{selectedTicket.description}</p>
                </article>
                {selectedTicket.support_response ? (
                  <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Raspuns VIASEE</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{selectedTicket.support_response}</p>
                    {selectedTicket.responded_at && <p className="mt-3 text-[10px] opacity-65">{formatDate(selectedTicket.responded_at)}</p>}
                  </article>
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl bg-secondary/45 p-4 text-muted-foreground">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs leading-relaxed">Solicitarea este inregistrata. Raspunsul echipei VIASEE va aparea aici dupa analiza.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} user={user} workspace={{ kind: "personal" }} />
    </div>
  );
}
