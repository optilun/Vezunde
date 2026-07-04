import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isAdmin } from "@/lib/access";

// Single account entry point in the public header.
export default function HeaderAccountLink() {
  const [state, setState] = useState(null); // null | "guest" | "user" | "admin"

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) { if (active) setState("guest"); return; }
      const user = await base44.auth.me().catch(() => null);
      if (active) setState(user ? (isAdmin(user) ? "admin" : "user") : "guest");
    }).catch(() => { if (active) setState("guest"); });
    return () => { active = false; };
  }, []);

  if (state === null) return null;

  const cls = "px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors";

  if (state === "guest") {
    return (
      <button type="button" className={cls} onClick={() => base44.auth.redirectToLogin("/dupa-login")}>
        Autentificare
      </button>
    );
  }

  const { to, label } = state === "admin"
    ? { to: "/admin/operatiuni", label: "Administrare" }
    : { to: "/contul-meu", label: "Contul meu" };

  return <Link to={to} className={cls}>{label}</Link>;
}