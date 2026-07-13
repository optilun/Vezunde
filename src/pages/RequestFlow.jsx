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
      className="flex min-h-[calc(100svh-4rem)] items-start justify-center overflow-x-clip px-3 py-5 sm:px-5 sm:py-14 md:py-20"
      style={{ background: "linear-gradient(180deg, #E9ECF4 0%, #F5F3EE 50%, #F7F2E8 100%)" }}
    >
      <div className="w-full max-w-3xl safe-area-bottom">
        <ConversationalCard initialMessage={q} initialIntent={intent} />
      </div>
    </div>
  );
}
