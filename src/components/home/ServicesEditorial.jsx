import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SERVICES } from "@/lib/vezunde";

const GROUPS = [
  { title: "Vederea ta", keys: ["control_vedere_adulti", "control_vedere_copii", "managementul_miopiei", "lentile_contact"] },
  { title: "Ochelarii tăi", keys: ["lentile_progresive", "montaj_lentile", "reparatii_ochelari", "reglaj_rame"] },
  { title: "Sănătatea ochilor", keys: ["consult_oftalmologic", "glaucom", "cataracta", "retina", "chirurgie_refractiva", "oct", "camp_vizual", "tonometrie"] },
];

const SERVICE_LABELS = {
  control_vedere_adulti: "Control de vedere pentru adulți",
  control_vedere_copii: "Control de vedere pentru copii",
  managementul_miopiei: "Managementul miopiei",
  lentile_contact: "Lentile de contact",
  lentile_progresive: "Lentile progresive",
  montaj_lentile: "Montaj lentile",
  reparatii_ochelari: "Reparații ochelari",
  reglaj_rame: "Reglaj rame",
  consult_oftalmologic: "Consult oftalmologic",
  glaucom: "Glaucom",
  cataracta: "Cataractă",
  retina: "Retină",
  chirurgie_refractiva: "Chirurgie refractivă",
  oct: "OCT",
  camp_vizual: "Câmp vizual",
  tonometrie: "Tonometrie",
};

export default function ServicesEditorial() {
  return (
    <section className="max-w-6xl mx-auto px-5 mt-32 sm:mt-44">
      <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-sm font-semibold tracking-wide text-primary uppercase">
        Ce poți găsi
      </motion.p>
      <div className="mt-8">
        {GROUPS.map((group, gi) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: gi * 0.08 }}
            className="py-10 border-t border-border grid sm:grid-cols-[220px_1fr] gap-4 sm:gap-12"
          >
            <h3 className="font-heading text-sm font-bold uppercase tracking-widest text-muted-foreground pt-2">{group.title}</h3>
            <p className="font-heading text-2xl sm:text-[2rem] font-bold tracking-tight leading-[1.35]">
              {group.keys.map((key, i) => (
                <React.Fragment key={key}>
                  <Link to={`/cauta?serviciu=${key}`} className="hover:text-primary transition-colors">
                    {SERVICE_LABELS[key] || SERVICES[key]}
                  </Link>
                  {i < group.keys.length - 1 && <span className="text-border mx-3 select-none">/</span>}
                </React.Fragment>
              ))}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}