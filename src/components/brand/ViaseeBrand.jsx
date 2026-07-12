import React from "react";

const SYMBOL_SRC = "/brand/viasee-symbol.svg";
const WORDMARK_SRC = "/brand/viasee-wordmark.svg";

export default function ViaseeBrand({
  compact = false,
  className = "",
  symbolClassName = "h-7 w-7",
  wordmarkClassName = "h-[15px] w-auto",
  label = "VIASEE",
}) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`.trim()}
      aria-label={label}
    >
      <img
        src={SYMBOL_SRC}
        alt=""
        aria-hidden="true"
        className={`shrink-0 object-contain ${symbolClassName}`.trim()}
        draggable="false"
        decoding="async"
      />
      {!compact && (
        <img
          src={WORDMARK_SRC}
          alt=""
          aria-hidden="true"
          className={`min-w-0 object-contain object-left ${wordmarkClassName}`.trim()}
          draggable="false"
          decoding="async"
        />
      )}
    </span>
  );
}
