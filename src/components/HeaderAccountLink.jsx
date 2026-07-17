import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/access";

// The public header reuses the authentication state already loaded by
// AuthProvider. The Base44 SDK is imported only when a session exists or the
// visitor explicitly starts authentication.
export default function HeaderAccountLink() {
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

  if (isLoadingAuth) return null;

  const className =
    "inline-flex min-h-11 items-center rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 lg:min-h-12 lg:px-4 lg:py-2.5 lg:text-[0.95rem] lg:font-medium";

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => void navigateToLogin("/dupa-login")}
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
