// Module 3D — central access helpers (frontend routing/UI only).
// Backend authorization remains the source of truth in each backend function.
import { base44 } from "@/api/base44Client";

export const isAdmin = (user) => !!user && user.role === "admin";

export const requireAuthenticatedUser = (user) => {
  if (!user) throw new Error("Autentificare necesara");
  return user;
};

export const getActiveProviderMemberships = (userId) =>
  base44.entities.ProviderMembership.filter({ user_id: userId, status: "active" }, null, 100);

export const hasActiveProviderMembership = async (userId) =>
  (await getActiveProviderMemberships(userId)).length > 0;

export const canManageProviderLocation = async (user, locationId) => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const m = await base44.entities.ProviderMembership.filter(
    { user_id: user.id, location_id: locationId, status: "active" },
    null,
    1
  );
  return m.length > 0;
};

export const isProviderPending = async (userId) =>
  (await base44.entities.ProviderClaimRequest.filter({ user_id: userId, status: "in_asteptare" }, null, 1)).length > 0;

export const getPostLoginDestination = (user) => {
  if (!user) return "/";
  return isAdmin(user) ? "/admin/operatiuni" : "/contul-meu";
};