import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export default function ContinueButton({ onClick, disabled = false, loading = false, children = "Continua", type = "button" }) {
  const buttonType = /** @type {"button" | "submit" | "reset"} */ (type);
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border/70 bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
      <button
        type={buttonType}
        onClick={onClick}
        disabled={disabled || loading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-lg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:rounded-full sm:shadow-none"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
