import React from "react";
import ConversationalCard from "@/components/intake2/ConversationalCard";
import { INTENTS, LEGACY_CATEGORY_TO_INTENT } from "@/lib/intentRegistry";

export default function RequestFlow() {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("q") || "";
  const cat = urlParams.get("categorie") || "";
  const intent = INTENTS[cat] ? cat : LEGACY_CATEGORY_TO_INTENT[cat] || null;

  return (
    <div
      className="min-h-[85vh] flex items-start justify-center px-5 py-14 sm:py-20"
      style={{ background: "linear-gradient(180deg, #E9ECF4 0%, #F5F3EE 50%, #F7F2E8 100%)" }}
    >
      <ConversationalCard initialMessage={q} initialIntent={intent} />
    </div>
  );
}