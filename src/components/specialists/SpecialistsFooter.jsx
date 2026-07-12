import React from "react";
import { Link } from "react-router-dom";

// Minimal footer — kept separate from the public site footer since this
// page uses its own header/shell rather than the shared Layout.
export default function SpecialistsFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} VIASEE</span>
        <div className="flex items-center gap-5">
          <Link to="/confidentialitate" className="hover:text-foreground transition-colors">Confidentialitate</Link>
          <Link to="/termeni" className="hover:text-foreground transition-colors">Termeni si conditii</Link>
        </div>
      </div>
    </footer>
  );
}
