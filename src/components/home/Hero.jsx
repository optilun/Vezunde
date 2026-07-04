import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";

export default function Hero() {
  const [text, setText] = useState("");
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate(`/cerere${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  };

  return (
    <section className="max-w-3xl mx-auto px-5 pt-24 sm:pt-36 text-center">
      <h1 className="font-heading text-[2.75rem] leading-[1.02] sm:text-7xl font-extrabold tracking-[-0.03em]">
        Spune ce ai nevoie.
        <br />
        Vezi unde poti merge.
      </h1>
      <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
        Gaseste opticieni, optometristi si medici oftalmologi potriviti pentru tine, descriind pur si simplu ce te preocupa.
      </p>
      <form onSubmit={submit} className="mt-12 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-[1.75rem] p-4 text-left shadow-[0_8px_40px_rgba(17,17,17,0.06)] focus-within:border-foreground/25 transition-colors">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
            placeholder="Ex: Mi s-a rupt bratul ochelarilor si caut o reparatie rapida..."
            rows={2}
            className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-xs text-muted-foreground/70">Descrie nevoia ta in cuvintele tale</span>
            <button
              type="submit"
              aria-label="Trimite"
              className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-primary transition-colors"
            >
              <ArrowUp className="w-4.5 h-4.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>
      <p className="mt-5 text-xs text-muted-foreground/80">Vezunde nu ofera diagnostic medical. Te ghidam catre specialistii potriviti.</p>
    </section>
  );
}