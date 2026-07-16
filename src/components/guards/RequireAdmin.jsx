import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/access";

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

export default function RequireAdmin() {
  const {
    user,
    isAuthenticated,
    isLoadingAuth,
    authChecked,
    navigateToLogin,
  } = useAuth();
  const shouldRedirect = authChecked && !isLoadingAuth && !isAuthenticated;

  useEffect(() => {
    if (shouldRedirect) void navigateToLogin(window.location.href);
  }, [navigateToLogin, shouldRedirect]);

  if (isLoadingAuth || !authChecked || shouldRedirect) return <Spinner />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}
