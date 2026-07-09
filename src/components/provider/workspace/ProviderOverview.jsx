import React from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Clock3, MapPin, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_NAV_KEYS } from "@/lib/providerWorkspaceCatalog";

function Panel({ children, className = "" }) {
  return <section className={"rounded-lg border border-border bg-card p-5 shadow-sm " + className}>{children}</section>;
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-foreground">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </Panel>
  );
}

function completenessLabel(score) {
  if (score >= 85) return "Profil aproape complet";
  if (score >= 50) return "Profil in lucru";
  return "Profil incomplet";
}

export default function ProviderOverview({ workspace, onNavigate }) {
  const organizations = workspace?.organizations || [];
  const locations = workspace?.locations || [];
  const firstOrg = organizations[0] || null;
  const orgScore = firstOrg?.profile_completeness?.percentage || 0;
  const pending = workspace?.pending_review_count || 0;
  const serviceCount = locations.reduce((sum, loc) => sum + (loc.content_summary?.approved_service_count || 0), 0);
  const teamCount = locations.reduce((sum, loc) => sum + (loc.content_summary?.approved_public_team_count || 0), 0);
  const missingOrg = firstOrg?.profile_completeness?.missing || [];
  const locationNeeds = locations.filter((loc) => (loc.profile_completeness?.percentage || 0) < 80);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Prezentare generala</h1>
          <p className="mt-2 text-sm text-muted-foreground">Controleaza informatiile publice ale organizatiei si locatiilor tale.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/adauga-sau-revendica">Adauga sau revendica locatie</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Organizatii" value={organizations.length} hint={firstOrg ? firstOrg.public_display_name : "Dupa aprobarea revendicarii apare aici."} />
        <StatCard icon={MapPin} label="Locatii" value={locations.length} hint="Locatiile sunt entitatea publica principala." />
        <StatCard icon={Stethoscope} label="Servicii aprobate" value={serviceCount} hint="Serviciile sunt gestionate per locatie." />
        <StatCard icon={Clock3} label="In review" value={pending} hint="Modificari care asteapta aprobare admin." />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Urmatorii pasi recomandati</h2>
              <p className="mt-1 text-sm text-muted-foreground">Actiuni reale, fara statistici sau oportunitati inventate.</p>
            </div>
            <Badge variant="secondary">MVP</Badge>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <button onClick={() => onNavigate(PROVIDER_NAV_KEYS.organization)} className="text-left rounded-lg border border-border p-4 hover:bg-secondary transition-colors">
              <CheckCircle2 className="w-4 h-4 mb-2" />
              <p className="text-sm font-semibold">Completeaza profilul organizatiei</p>
              <p className="mt-1 text-xs text-muted-foreground">Brand, descriere, logo si contacte generale.</p>
            </button>
            <button onClick={() => onNavigate(PROVIDER_NAV_KEYS.locations)} className="text-left rounded-lg border border-border p-4 hover:bg-secondary transition-colors">
              <MapPin className="w-4 h-4 mb-2" />
              <p className="text-sm font-semibold">Verifica detaliile locatiilor</p>
              <p className="mt-1 text-xs text-muted-foreground">Adresa, contact public, servicii si program.</p>
            </button>
            <button onClick={() => onNavigate(PROVIDER_NAV_KEYS.locations)} className="text-left rounded-lg border border-border p-4 hover:bg-secondary transition-colors">
              <Clock3 className="w-4 h-4 mb-2" />
              <p className="text-sm font-semibold">Seteaza programul</p>
              <p className="mt-1 text-xs text-muted-foreground">Programul se poate publica imediat, fara review.</p>
            </button>
            <button onClick={() => onNavigate(PROVIDER_NAV_KEYS.locations)} className="text-left rounded-lg border border-border p-4 hover:bg-secondary transition-colors">
              <Users className="w-4 h-4 mb-2" />
              <p className="text-sm font-semibold">Invita specialisti publici</p>
              <p className="mt-1 text-xs text-muted-foreground">Specialistii publici sunt separati de utilizatorii cu acces intern.</p>
            </button>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-semibold">Completitudine</h2>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span>{completenessLabel(orgScore)}</span>
              <span className="font-semibold">{orgScore}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-foreground" style={{ width: orgScore + "%" }} />
            </div>
          </div>
          {missingOrg.length > 0 && (
            <div className="mt-4 space-y-2">
              {missingOrg.slice(0, 4).map((item) => (
                <p key={item.key} className="text-xs text-muted-foreground">? {item.label}</p>
              ))}
            </div>
          )}
          {locationNeeds.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{locationNeeds.length} locatii mai au informatii de completat.</p>}
        </Panel>
      </div>
    </div>
  );
}
