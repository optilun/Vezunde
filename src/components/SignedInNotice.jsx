import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/access";

// 2026-10-02. Pagina de login nu verifica daca exista deja o sesiune. In acelasi browser, Alex era
// conectat cu contul de test si, cand incerca sa intre cu contul de admin, ramanea pe contul de
// test fara sa fie evident - parea ca adminul si-a pierdut rolul. Acum /login si /register spun
// cu ce cont esti conectat si ofera iesirea, inainte de formular.
export default function SignedInNotice({ continueTo = "/dupa-login" }) {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  if (isLoadingAuth || !isAuthenticated || !user) return null;

  const switchAccount = async () => {
    setLeaving(true);
    // Iesirea reincarca aceeasi pagina fara sesiune, deci formularul de login ramane deschis.
    await logout(true);
  };

  return (
    <div role="status" className="mb-6 rounded-2xl border border-border bg-secondary/40 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Ești deja conectat</p>
          <p className="mt-0.5 break-all text-xs text-muted-foreground">
            {user.email || user.full_name || "Cont VIASEE"}
            {isAdmin(user) ? " · administrator" : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          to={continueTo}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-xs font-semibold text-background"
        >
          Continuă cu acest cont
        </Link>
        <button
          type="button"
          onClick={switchAccount}
          disabled={leaving}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
          Ieși și intră cu alt cont
        </button>
      </div>
    </div>
  );
}
