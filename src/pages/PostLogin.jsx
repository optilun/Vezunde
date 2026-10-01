import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getPostLoginDestination, isAdmin } from "@/lib/access";

// Landing point after any successful login (email/parola, Google sau invitatie Base44).
export default function PostLogin() {
  const { user } = useAuth();
  const [destination, setDestination] = useState("");

  useEffect(() => {
    let active = true;
    if (!user) {
      setDestination("/");
      return () => { active = false; };
    }
    if (isAdmin(user)) {
      setDestination(getPostLoginDestination(user));
      return () => { active = false; };
    }

    // 2026-10-01: se verifica si invitatiile de specialist, nu doar cele de membru. Cine a primit o
    // invitatie si s-a autentificat fara sa deschida linkul din email ajunge direct la ea. Daca are
    // ambele tipuri, accesul in organizatie vine primul; cea de specialist apare apoi ca link pe
    // ecranul de confirmare (AcceptProviderInvitation).
    const countInvitations = (functionName) => base44.functions.invoke(functionName, { action: "list_mine" })
      .then((response) => (response.data?.invitations || []).length)
      .catch(() => 0);
    Promise.all([
      countInvitations("acceptProviderMemberInvitation"),
      countInvitations("professionalInvitationOps"),
    ]).then(([memberCount, professionalCount]) => {
      if (!active) return;
      if (memberCount > 0) setDestination("/accept-provider-invitation");
      else if (professionalCount > 0) setDestination("/accept-professional-invitation");
      else setDestination(getPostLoginDestination(user));
    });

    return () => { active = false; };
  }, [user]);

  if (!destination) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-sm text-muted-foreground" role="status">
        Se verifica accesul contului...
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}