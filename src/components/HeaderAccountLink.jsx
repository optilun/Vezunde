import React from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/access";

// The public header reuses the authentication state already loaded by
// AuthProvider. This avoids duplicate session and user requests from the
// desktop and mobile header instances.
export default function HeaderAccountLink() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null;

  const className =
    "inline-flex min-h-11 items-center rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => base44.auth.redirectToLogin("/dupa-login")}
      >
        Autentificare
      </button>
    );
  }

  const destination = isAdmin(user)
    ? { to: "/admin/operatiuni", label: "Administrare" }
    : { to: "/contul-meu", label: "Contul meu" };

  return (
    <Link to={destination.to} className={className}>
      {destination.label}
    </Link>
  );
}
