import React from "react";
import { Link } from "react-router-dom";
import { Eye, Stethoscope, Baby, Glasses, Wrench, Droplets } from "lucide-react";
import { CATEGORIES } from "@/lib/vezunde";

const ICONS = {
  control_vedere: Eye,
  consult_oftalmologic: Stethoscope,
  copii_miopie: Baby,
  lentile_ochelari: Glasses,
  reparatii: Wrench,
  ochi_uscat: Droplets,
};

export default function QuickCategories() {
  return (
    <section className="max-w-4xl mx-auto px-5 mt-12">
      <div className="flex flex-wrap justify-center gap-2.5">
        {CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.key];
          return (
            <Link
              key={cat.key}
              to={`/cerere?categorie=${cat.key}`}
              className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2.5 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Icon className="w-4 h-4 text-primary" />
              {cat.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}