import React from "react";
import { motion } from "framer-motion";

// Premium abstract editorial background — sparse organic line work inspired by
// location & local discovery. Tone-on-tone, no map grid, no frame.
const LINE = "#E2DAC8"; // soft warm beige, low contrast on cream
const INK = "#171717";

export default function SpecialistsHeroIllustration({ className = "" }) {
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <svg viewBox="0 0 640 560" fill="none" className="w-full h-auto">
        {/* Sparse, curated organic line work — large breathable empty areas */}
        <g stroke={LINE} strokeWidth="1.5" strokeLinecap="round">
          <path d="M-20 430 C 120 400, 210 460, 330 415 S 560 350, 660 390" />
          <path d="M60 120 C 160 90, 250 150, 390 110 S 560 60, 650 95" opacity="0.7" />
          <path d="M200 545 C 290 490, 300 420, 405 385" opacity="0.8" />
          <path d="M520 480 C 470 400, 500 330, 452 268" opacity="0.6" />
          <path d="M120 300 C 170 275, 230 290, 268 258" opacity="0.55" />
        </g>
        {/* A few quiet waypoints along the lines */}
        <circle cx="120" cy="300" r="3" fill={LINE} />
        <circle cx="330" cy="415" r="3.5" fill={LINE} />
        <circle cx="390" cy="110" r="3" fill={LINE} />
        <circle cx="520" cy="480" r="3" fill={LINE} />

        {/* Supporting symbols — small, intentional, well spaced */}
        {/* Glasses — lower left, resting on a line */}
        <g stroke={INK} strokeWidth="1.6" opacity="0.42" strokeLinecap="round">
          <circle cx="146" cy="438" r="12" />
          <circle cx="178" cy="438" r="12" />
          <path d="M158 438 Q 162 433 166 438" />
        </g>
        {/* Eye — upper left, floating in empty space */}
        <g stroke={INK} strokeWidth="1.6" opacity="0.38" strokeLinecap="round">
          <path d="M212 156 Q 234 138 256 156 Q 234 174 212 156 Z" />
          <circle cx="234" cy="156" r="5" />
        </g>
        {/* Profile card — right side, quiet */}
        <g stroke={INK} strokeWidth="1.6" opacity="0.38" strokeLinecap="round">
          <rect x="540" y="230" width="52" height="38" rx="7" />
          <circle cx="556" cy="245" r="5.5" />
          <path d="M568 241 H 582 M568 251 H 578" />
          <path d="M550 260 H 582" opacity="0.7" />
        </g>

        {/* Shadow — soft pulse under the pin */}
        <motion.ellipse
          cx="392" cy="326" rx="26" ry="7" fill={INK}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.16, 0.1], scaleX: [1, 0.88, 1] }}
          transition={{ delay: 0.55, duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "392px 326px" }}
        />

        {/* Focal pin — gentle drop, then soft idle float */}
        <motion.g
          initial={{ y: -34, opacity: 0 }}
          animate={{ y: [0, -6, 0], opacity: 1 }}
          transition={{
            opacity: { duration: 0.5, ease: "easeOut" },
            y: { delay: 0.5, duration: 4.5, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <motion.g
            initial={{ y: -30 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1.1, 0.36, 1] }}
          >
            {/* Refined pin: clean teardrop, generous inner circle */}
            <path
              d="M392 216 C 361 216 340 238 340 265 C 340 292 366 306 385 330 C 388.5 334.4 395.5 334.4 399 330 C 418 306 444 292 444 265 C 444 238 423 216 392 216 Z"
              fill={INK}
            />
            <circle cx="392" cy="264" r="17" fill="#F5F1E8" />
            <circle cx="392" cy="264" r="6" fill={INK} />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}