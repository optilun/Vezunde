import React from "react";
import { Link } from "react-router-dom";
import ViaseeBrand from "@/components/brand/ViaseeBrand";

// Minimal footer — kept separate from the public site footer since this
// page uses its own header/shell rather than the shared Layout.
export default function SpecialistsFooter() {
  return (
    <footer>
      <div className="border-y border-[#513e61] bg-[#513e61]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-4 py-10 sm:flex-row sm:items-center sm:px-8 sm:py-12">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e2d5e9]">Următorul pas</p><p className="mt-3 font-heading text-2xl font-semibold tracking-tight text-[#fffdf9] sm:text-3xl">Profilul tău începe aici.</p></div>
          <a href="#incepe" className="inline-flex min-h-12 items-center justify-between gap-8 rounded-full bg-[#fffdf9] px-6 text-sm font-semibold text-[#513e61] hover:bg-[#ede5f1]">Alege profilul <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-[#665f69] sm:px-8">
        <div className="flex items-center gap-3"><ViaseeBrand symbolClassName="h-5 w-5" wordmarkClassName="h-3 w-auto" /><span>© {new Date().getFullYear()}</span></div>
        <nav aria-label="Informații legale" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/ajutor-si-suport" className="inline-flex min-h-11 items-center hover:text-[#684d78]">Ajutor</Link>
          <Link to="/confidentialitate" className="inline-flex min-h-11 items-center hover:text-[#684d78]">Confidențialitate</Link>
          <Link to="/termeni" className="inline-flex min-h-11 items-center hover:text-[#684d78]">Termeni și condiții</Link>
        </nav>
      </div>
    </footer>
  );
}
