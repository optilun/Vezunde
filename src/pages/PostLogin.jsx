import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getPostLoginDestination } from "@/lib/access";

// Landing point after any successful login (email/parola sau Google).
export default function PostLogin() {
  const { user } = useAuth();
  return <Navigate to={getPostLoginDestination(user)} replace />;
}