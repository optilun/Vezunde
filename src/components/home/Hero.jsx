import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  const [text, setText] = useState("");
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate(`/cerere${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  };

  return (
    <section className="max-w-3xl mx-auto px-5 pt-20 sm:pt-28 text-center">
      <h1 className="font-heading text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
        Spune ce ai nevoie.
        <br />
        <span className="text-primary">Vezi unde poti merge.</span>
      </h1>
      <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
        Descrie in cuvintele tale ce te preocupa, iar noi iti aratam opticieni, optometristi si medici oftalmologi potriviti pentru tine.
      </p>
      <form onSubmit={submit} className="mt-10">
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl p-2 pl-5 shadow-[0_4px_24px_rgba(17,17,17,0.05)] focus-within:border-primary/50 transition-colors">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex: Mi s-a rupt bratul ochelarilor si am nevoie de reparatie..."
            className="flex-1 bg-transparent outline-none text-base py-3 placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            <span className="hidden sm:inline">Vezi unde</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">Vezunde nu ofera diagnostic medical. Te ghidam catre specialistii potriviti.</p>
    </section>
  );
}