// Reper de categorie, in forma simbolului VIASEE (2026-08-18), la cererea lui Alex.
// Path-ul e exact cel din /public/brand/viasee-symbol.svg (logo-ul de pe homepage),
// dar cu fill solid, parametrizabil pe culoare - simbolul original foloseste un
// gradient negru fix, nepotrivit pentru un reper mic, colorat pe categorie.
import React from "react";

export default function CategorySymbol({ color, className = "h-2.5 w-2.5" }) {
  return (
    <svg viewBox="0 0 496 427" className={className} aria-hidden="true">
      <path
        d="M 491 4 L 470 3 L 443 9 L 411 21 L 380 38 L 350 60 L 322 86 L 305 106 L 281 140 L 268 165 L 263 181 L 262 196 L 264 204 L 269 214 L 269 218 L 265 226 L 299 243 L 305 247 L 318 260 L 324 273 L 325 279 L 324 290 L 319 304 L 307 322 L 287 342 L 242 376 L 228 390 L 222 404 L 222 412 L 227 418 L 243 424 L 252 424 L 270 414 L 294 396 L 320 370 L 336 348 L 369 289 L 433 157 L 486 34 L 493 13 L 493 7 Z M 4 4 L 2 8 L 4 20 L 29 82 L 31 84 L 36 98 L 41 107 L 43 114 L 45 116 L 47 123 L 49 125 L 62 156 L 95 224 L 95 226 L 133 301 L 161 351 L 194 333 L 198 332 L 225 318 L 252 301 L 262 291 L 265 286 L 267 279 L 267 273 L 264 265 L 255 256 L 246 250 L 206 229 L 197 220 L 196 217 L 197 208 L 202 203 L 220 196 L 226 190 L 229 180 L 229 173 L 226 160 L 218 144 L 201 118 L 188 101 L 146 59 L 126 44 L 103 30 L 76 17 L 46 7 L 42 7 L 32 4 L 14 3 L 13 2 Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}
