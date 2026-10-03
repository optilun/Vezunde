import React from "react";

const DEFAULT_TITLE = ["Tot ce ai nevoie", "pentru vedere.", "Într-un singur loc."];

export default function AuthArtworkPanel({
  titleLines = DEFAULT_TITLE,
  subtitle = <>Medici, clinici, controale, investigații,<br />ochelari și reparații.</>,
}) {
  return (
    <aside aria-label="Despre VIASEE" className="relative hidden min-h-[640px] overflow-hidden rounded-[24px] bg-[#f7f4ec] lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-3rem)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/auth/viasee-auth-artwork-v1.webp')" }}
      />
      <div className="absolute inset-x-[7%] top-1/2 -translate-y-1/2 text-center">
        <h2 className="font-heading text-[clamp(1.75rem,2.5vw,3rem)] font-semibold leading-[1.12] tracking-[-0.045em] text-[#191919]">
          {titleLines.map((line) => <span key={line} className="block">{line}</span>)}
        </h2>
        <p className="mx-auto mt-5 max-w-[340px] text-sm leading-6 text-[#625e55]">{subtitle}</p>
      </div>
    </aside>
  );
}
