import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, MailCheck, RefreshCw, Send } from "lucide-react";
import { patientRequestEmailVerification } from "@/lib/patientRequestPersistenceClient";

function errorMessage(error) {
  return String(error?.message || "Verificarea emailului nu a putut fi procesată.");
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PatientRequestEmailVerification({ requestId, accessToken, onVerified }) {
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback(async (nextAction, submittedCode = "") => {
    return patientRequestEmailVerification({
      requestId,
      action: nextAction,
      code: submittedCode,
      explicitAccessToken: accessToken || "",
    });
  }, [accessToken, requestId]);

  const loadStatus = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError("");
    try {
      const data = await invoke("status");
      setVerification(data.verification || null);
      if (data.verification?.verified) onVerified?.(true);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [invoke, onVerified, requestId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const sendCode = async () => {
    setAction("send");
    setError("");
    try {
      const data = await invoke("send_code");
      setVerification(data.verification || null);
    } catch (sendError) {
      if (sendError?.verification) setVerification(sendError.verification);
      setError(errorMessage(sendError));
    } finally {
      setAction("");
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Introdu codul de 6 cifre primit pe email.");
      return;
    }
    setAction("verify");
    setError("");
    try {
      const data = await invoke("verify_code", code);
      setVerification(data.verification || null);
      if (data.verification?.verified) {
        setCode("");
        onVerified?.(true);
      }
    } catch (verifyError) {
      if (verifyError?.verification) setVerification(verifyError.verification);
      setError(errorMessage(verifyError));
    } finally {
      setAction("");
    }
  };

  if (loading) {
    return (
      <div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-border bg-background text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm starea emailului...
      </div>
    );
  }

  if (verification?.verified) {
    return (
      <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">Email confirmat</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Adresa {verification.email_masked || "asociată cererii"} este verificată și poate fi afișată locațiilor Pro din Top 3 care primesc cererea. Telefonul rămâne separat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const codeSent = verification?.delivery_status === "sent";
  const canResend = verification?.can_resend !== false;

  return (
    <div className="mt-5 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Confirmă adresa de email</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Trimitem un cod la {verification?.email_masked || "adresa introdusă"}. Până la confirmare, locațiile Pro din Top 3 pot vedea numele și mesajul detaliat, dar emailul rămâne ascuns.
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {codeSent && (
            <form onSubmit={verifyCode} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Cod de verificare"
                placeholder="Cod de 6 cifre"
                className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-center text-base font-bold tracking-[0.28em] text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={action === "verify" || code.length !== 6}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-bold text-background disabled:opacity-60"
              >
                {action === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmă codul
              </button>
            </form>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={action === "send" || !canResend}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {action === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {codeSent ? "Trimite un cod nou" : "Trimite codul"}
            </button>
            {!canResend && verification?.can_resend_at && (
              <span className="text-[11px] text-muted-foreground">
                Poți retrimite după {formatTime(verification.can_resend_at)}.
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={Boolean(action)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary disabled:opacity-60"
            >
              <RefreshCw className="h-3 w-3" /> Actualizează starea
            </button>
          </div>

          {verification?.attempts_remaining < 5 && codeSent && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Încercări rămase: {verification.attempts_remaining}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
