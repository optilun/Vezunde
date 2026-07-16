import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

const Spinner = () => (
  <div
    className="fixed inset-0 flex items-center justify-center bg-background"
    role="status"
  >
    <div
      className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground"
      aria-hidden="true"
    />
    <span className="sr-only">Se verifică accesul...</span>
  </div>
);

export default function RequireAuth() {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const shouldRedirect = authChecked && !isLoadingAuth && !isAuthenticated;

  useEffect(() => {
    if (shouldRedirect) base44.auth.redirectToLogin(window.location.href);
  }, [shouldRedirect]);

  if (isLoadingAuth || !authChecked || shouldRedirect) return <Spinner />;
  return <Outlet />;
}
