import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import ProviderOverview from "@/components/provider/workspace/ProviderOverview";
import OrganizationProfilePanel from "@/components/provider/workspace/OrganizationProfilePanel";
import LocationsWorkspace from "@/components/provider/workspace/LocationsWorkspace";
import { PROVIDER_NAV_KEYS } from "@/lib/providerWorkspaceCatalog";

function ClaimOrEmptyState({ workspace }) {
  const latest = workspace?.latest_claim_status || workspace?.claim || null;
  const location = workspace?.location_summary || null;
  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Contul meu</h1>
      <p className="mt-2 text-sm text-muted-foreground">Workspace-ul furnizorului devine disponibil dupa aprobarea unei revendicari.</p>
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Status furnizor</h2>
        {latest ? (
          <div className="mt-3 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Status:</span> <span className="font-medium">{latest.status}</span></p>
            {latest.status_message && <p className="text-muted-foreground">{latest.status_message}</p>}
            {location?.name && <p className="text-muted-foreground">Locatie: {location.name}</p>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nu ai inca o revendicare activa.</p>
        )}
        <div className="mt-5">
          <Link to="/adauga-sau-revendica" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            Adauga sau revendica locatie
          </Link>
        </div>
      </section>
    </div>
  );
}

function AccessPlaceholder() {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Acces si utilizatori</h1>
      <p className="mt-2 text-sm text-muted-foreground">Aceasta zona va gestiona owneri, manageri de locatie si membri de echipa. Specialistii publici se gestioneaza separat in Locatii.</p>
      <p className="mt-4 text-sm text-muted-foreground">Pentru MVP, accesul este controlat prin ProviderMembership si review admin.</p>
    </section>
  );
}

function SettingsPlaceholder() {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Setari</h1>
      <p className="mt-2 text-sm text-muted-foreground">Setarile comerciale, notificari avansate, plati si integrari nu fac parte din acest MVP.</p>
    </section>
  );
}

export default function MyAccount() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [activeKey, setActiveKey] = useState(PROVIDER_NAV_KEYS.overview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { logout } = useAuth();

  const loadWorkspace = async () => {
    setError("");
    const res = await base44.functions.invoke("getMyProviderWorkspace", {});
    setWorkspace(res.data || res);
  };

  useEffect(() => {
    let mounted = true;
    base44.auth
      .me()
      .then(async (u) => {
        if (!mounted) return;
        setUser(u);
        try {
          await loadWorkspace();
        } catch (err) {
          setError(err?.response?.data?.error || err?.message || "Nu am putut incarca workspace-ul.");
        } finally {
          if (mounted) setLoading(false);
        }
      })
      .catch(() => base44.auth.redirectToLogin(window.location.href));
    return () => { mounted = false; };
  }, []);

  if (!user || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se incarca...</div>;
  }

  const locations = workspace?.locations || [];
  const publicProfileUrl = locations.length > 0 ? "/furnizor/" + locations[0].id : null;
  const mode = workspace?.mode || "none";

  return (
    <ProviderAppShell activeKey={activeKey} onNavigate={setActiveKey} user={user} onLogout={() => logout(true)} publicProfileUrl={publicProfileUrl}>
      {error && <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {mode !== "provider_workspace" ? (
        <ClaimOrEmptyState workspace={workspace} />
      ) : (
        <>
          {activeKey === PROVIDER_NAV_KEYS.overview && <ProviderOverview workspace={workspace} onNavigate={setActiveKey} />}
          {activeKey === PROVIDER_NAV_KEYS.organization && <OrganizationProfilePanel workspace={workspace} onSaved={loadWorkspace} />}
          {activeKey === PROVIDER_NAV_KEYS.locations && <LocationsWorkspace workspace={workspace} onSaved={loadWorkspace} />}
          {activeKey === PROVIDER_NAV_KEYS.access && <AccessPlaceholder />}
          {activeKey === PROVIDER_NAV_KEYS.settings && <SettingsPlaceholder />}
        </>
      )}
    </ProviderAppShell>
  );
}
