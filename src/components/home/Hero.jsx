import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

const PLACEHOLDERS = [
  "Vad neclar la distanta...",
  "Caut control pentru copil...",
  "Mi s-au rupt ochelarii...",
];

const EXAMPLES = [
  { label: "Vad neclar la distanta", to: "/cerere?categorie=control_vedere" },
  { label: "Caut control pentru copil", to: "/cerere?categorie=copii_miopie" },
  { label: "Mi s-au rupt ochelarii", to: "/cerere?categorie=reparatii" },
];

export default function Hero() {
  const [text, setText] = useState("");
  const [phIndex, setPhIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 3800);
    return () => clearInterval(t);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/cerere${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  };

  return (
    <section
      className="relative overflow-hidden min-h-[92vh] flex items-center justify-center"
      style={{ backgroundColor: "#F6F4F0" }}
    >
      {/* Abstract guidance visual — route lines, nodes, soft geometric shapes */}
      <motion.svg
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.4 }}
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* soft geometric focus shapes */}
        <circle cx="1180" cy="210" r="170" fill="#DED9FF" opacity="0.45" />
        <circle cx="240" cy="700" r="130" fill="#DED9FF" opacity="0.35" />
        <rect x="90" y="140" width="120" height="120" rx="36" fill="#DED9FF" opacity="0.3" transform="rotate(12 150 200)" />

        {/* route lines — quiet, curving toward destinations */}
        <path
          d="M-40 640 C 260 560, 420 720, 700 660 S 1150 520, 1500 600"
          stroke="#B9B0FF"
          strokeWidth="1.5"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <path
          d="M-40 250 C 300 320, 540 180, 820 240 S 1240 340, 1500 260"
          stroke="#B9B0FF"
          strokeWidth="1.5"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <path
          d="M180 900 C 320 700, 560 780, 760 640"
          stroke="#B9B0FF"
          strokeWidth="1.5"
          strokeDasharray="1 7"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* destination nodes */}
        <circle cx="700" cy="660" r="5" fill="#5546D8" />
        <circle cx="700" cy="660" r="12" stroke="#5546D8" strokeWidth="1" opacity="0.35" />
        <circle cx="820" cy="240" r="4" fill="#5546D8" opacity="0.8" />
        <circle cx="820" cy="240" r="10" stroke="#5546D8" strokeWidth="1" opacity="0.25" />
        <circle cx="240" cy="580" r="3.5" fill="#B9B0FF" />
        <circle cx="1180" cy="210" r="4" fill="#5546D8" opacity="0.6" />
        <circle cx="1260" cy="560" r="3" fill="#B9B0FF" />
        <circle cx="420" cy="290" r="3" fill="#B9B0FF" />
      </motion.svg>

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-24 sm:py-28 w-full flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-sm font-semibold tracking-wide uppercase"
          style={{ color: "#5546D8" }}
        >
          Pentru tot ce tine de vederea ta
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
          className="mt-5 font-heading font-extrabold tracking-[-0.035em] leading-[1.04] text-[2.6rem] sm:text-[4.25rem]"
          style={{ color: "#141414" }}
        >
          Spune ce ai nevoie.
          <br />
          Vezi unde poti merge.
        </motion.h1>

        {/* White floating input card */}
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
          className="mt-10 w-full max-w-xl"
        >
          <div
            className="bg-white rounded-[1.5rem] p-4 shadow-[0_16px_50px_rgba(20,20,20,0.08)] focus-within:shadow-[0_20px_60px_rgba(85,70,216,0.16)] transition-shadow duration-500 text-left"
            style={{ border: "1px solid #DDD9D2" }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
              placeholder={PLACEHOLDERS[phIndex]}
              rows={2}
              className="w-full bg-transparent outline-none text-base px-2 pt-1 resize-none placeholder:text-[#8A857D]"
              style={{ color: "#141414" }}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs hidden sm:block" style={{ color: "#8A857D" }}>
                Scrie in cuvintele tale, ca intr-o conversatie
              </span>
              <button
                type="submit"
                aria-label="Trimite"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ml-auto"
                style={{ backgroundColor: "#5546D8", color: "#FFFFFF" }}
              >
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2"
        >
          {EXAMPLES.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="text-sm underline underline-offset-4 transition-colors"
              style={{ color: "#8A857D", textDecorationColor: "#DDD9D2" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#5546D8";
                e.currentTarget.style.textDecorationColor = "#5546D8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8A857D";
                e.currentTarget.style.textDecorationColor = "#DDD9D2";
              }}
            >
              {s.label}
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}