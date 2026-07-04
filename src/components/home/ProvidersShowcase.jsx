import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function ProvidersShowcase() {
  const [locations, setLocations] = useState(null);

  useEffect(() => {
    base44.entities.Location.list("-response_quality_score", 5).then(setLocations);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-5 mt-32 sm:mt-44">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05]">
          Locuri unde poti merge
          <br />
          <span className="font-display italic font-medium text-primary">chiar azi.</span>
        </h2>
        <Link to="/cauta" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
          Exploreaza toti furnizorii <ArrowUpRight className="w-4 h-4" />
        </Link>
      </motion.div>

      <div className="mt-12">
        {locations === null && <p className="text-sm text-muted-foreground py-8">Se incarca...</p>}
        {locations?.map((loc, i) => (
          <motion.div
            key={loc.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.06 }}
          >
            <Link
              to={`/furnizor/${loc.id}`}
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 sm:gap-10 py-7 border-t border-border last:border-b hover:bg-card/70 transition-colors -mx-3 px-3 sm:-mx-5 sm:px-5 rounded-lg"
            >
              <span className="font-heading text-sm font-bold text-muted-foreground/50 tabular-nums">0{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight group-hover:text-primary transition-colors">{loc.name}</h3>
                  {loc.is_verified && <BadgeCheck className="w-4.5 h-4.5 text-primary shrink-0" />}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PROVIDER_TYPES[loc.provider_type]} · {loc.city}
                  {loc.availability_note ? ` · ${loc.availability_note}` : ""}
                </p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground/70">Exemple fictive, pentru demonstratie. Ordinea reflecta relevanta si calitatea profilului, nu marimea afacerii.</p>
    </section>
  );
}