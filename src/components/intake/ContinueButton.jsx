import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export default function ContinueButton({ onClick, disabled, loading, children = "Continua", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-8 sticky bottom-4 sm:static z-10 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-white font-semibold text-sm shadow-lg sm:shadow-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: "#171717" }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#2B2B2B"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#171717"; }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
      {!loading && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}