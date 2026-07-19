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

    base44.functions.invoke("acceptProviderMemberInvitation", { action: "list_mine" })
      .then((response) => {
        if (!active) return;
        const invitations = response.data?.invitations || [];
        setDestination(invitations.length > 0 ? "/accept-provider-invitation" : getPostLoginDestination(user));
      })
      .catch(() => {
        if (active) setDestination(getPostLoginDestination(user));
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