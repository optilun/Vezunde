import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Copy, Home, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { adminHref } from "@/lib/adminNavConfig";
import { ADMIN_ERROR_EVENT, claimAutoReload, errorEventProperties, errorReport, isChunkLoadError } from "@/lib/adminErrors";

// Plasă de siguranță pentru panoul de admin (2026-10-08). Fără ea, o singură eroare la afișare
// (o dată lipsă sau în alt format decât cel așteptat) golea toată pagina, inclusiv meniul.
//   variant="section": cardul apare în locul ecranului; meniul și antetul rămân folosibile;
//   variant="page":    pentru cazul în care chiar cadrul panoului nu se poate afișa;
//   variant="silent":  nu afișează nimic (ex. căutarea globală, care e doar o scurtătură).
// `resetKey` (ex. secțiunea curentă): când se schimbă, eroarea se șterge și ecranul nou se încarcă.
// O versiune nouă publicată cât fila era deschisă nu e o eroare de date: reîncărcăm pagina o singură
// dată, iar dacă tot nu merge, arătăm un buton.
export default class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: "", copied: false, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { error, copied: false };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack || "";
    console.error("[Admin] eroare la afișare", error, componentStack);
    this.props.onError?.(error);
    const silent = this.props.variant === "silent";
    const reloading = !silent && isChunkLoadError(error) && typeof window !== "undefined" && claimAutoReload(window.sessionStorage);
    // Se raportează în statistici (nu blochează niciodată): așa se văd erorile din producție fără să le copieze cineva.
    try {
      base44.analytics.track({
        eventName: ADMIN_ERROR_EVENT,
        properties: errorEventProperties({ error, componentStack, section: this.props.section, reloading }),
      });
    } catch {
      // Statisticile nu au voie să strice afișarea erorii.
    }
    if (reloading) {
      this.setState({ componentStack, reloading: true });
      window.location.reload();
      return;
    }
    this.setState({ componentStack });
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: "", copied: false, reloading: false });
    }
  }

  retry = () => this.setState({ error: null, componentStack: "", copied: false, reloading: false });

  reload = () => window.location.reload();

  copy = async (report) => {
    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    const { error, componentStack, copied, reloading } = this.state;
    if (!error) return this.props.children;
    const { variant = "section", section = "" } = this.props;
    if (variant === "silent") return null;

    const chunkError = isChunkLoadError(error);
    const report = errorReport({ error, componentStack, section, href: typeof window !== "undefined" ? window.location.href : "" });
    const buttonClass = "inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition-colors hover:bg-secondary";

    const card = (
      <div
        role="alert"
        data-admin-error-boundary={chunkError ? "update" : variant}
        className="w-full max-w-2xl rounded-2xl border border-danger-border bg-danger-soft p-5 text-sm"
      >
        <div className="flex items-start gap-3">
          {reloading
            ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-danger" aria-hidden="true" />
            : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            {chunkError ? (
              <>
                <h2 className="font-heading text-base font-bold text-danger">{reloading ? "Se reîncarcă pagina…" : "Aplicația s-a actualizat"}</h2>
                <p className="mt-1 text-foreground">
                  Între timp a fost publicată o versiune nouă, iar această filă încă o folosește pe cea veche. Reîncarcă pagina ca să continui.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={this.reload} className={buttonClass}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reîncarcă pagina
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-base font-bold text-danger">
                  {variant === "page" ? "Panoul de administrare nu s-a putut afișa" : "Această secțiune nu s-a putut afișa"}
                </h2>
                <p className="mt-1 text-foreground">
                  A apărut o eroare neașteptată.{" "}
                  {variant === "page"
                    ? "Reîncarcă pagina; dacă se repetă, copiază detaliile de mai jos și trimite-le."
                    : "Restul panoului funcționează: poți reîncerca sau alege altă secțiune din meniu."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {variant === "page" ? (
                    <button type="button" onClick={this.reload} className={buttonClass}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Reîncarcă pagina
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={this.retry} className={buttonClass}>
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Reîncearcă
                      </button>
                      <Link to={adminHref("dashboard")} className={buttonClass}>
                        <Home className="h-3.5 w-3.5" aria-hidden="true" />
                        Mergi la Panou
                      </Link>
                    </>
                  )}
                  <button type="button" onClick={() => this.copy(report)} className={buttonClass}>
                    {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                    {copied ? "Copiat" : "Copiază detaliile"}
                  </button>
                </div>
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold hover:text-foreground">Detalii tehnice</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-3 font-mono text-[11px] text-foreground">{report}</pre>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    );

    if (variant === "page") {
      return <div className="flex min-h-screen min-h-dvh items-center justify-center bg-background p-4">{card}</div>;
    }
    return card;
  }
}
