import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, ClipboardList, MapPin, Search } from "lucide-react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const ROLE_LABELS = {
  organization_owner: "Owner organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru locatie",
};

function organizationContexts(workspace) {
  if (workspace?.organization_contexts?.length) return workspace.organization_contexts;
  return (workspace?.organizations || []).map((organization) => {
    const locations = (workspace?.locations || []).filter((location) => location.organization_id === organization.id);
    const memberships = (workspace?.memberships || []).filter((membership) => membership.organization_id === organization.id);
    return {
      organization,
      locations,
      memberships,
      current_user_role: memberships[0]?.role || workspace?.current_user_role || "",
    };
  });
}

function organizationRows(workspace, onboardingWorkspace) {
  const contexts = organizationContexts(workspace);
  const rows = contexts.map((context) => ({
    key: `organization-${context.organization.id}`,
    mode: "provider",
    organizationId: context.organization.id,
    locationId: context.locations?.[0]?.id || context.memberships?.[0]?.location_id || "",
    name: context.organization.public_display_name || context.organization.name || "Organizatie",
    logoUrl: context.organization.logo_url || "",
    role: context.current_user_role || context.memberships?.[0]?.role || "",
    locationCount: context.locations?.length || 0,
    locality: context.locations?.[0]?.locality_name || context.locations?.[0]?.city || "",
    profileCompleteness: context.organization.profile_completeness ?? null,
    status: "active",
    statusLabel: "Acces activ",
  }));

  if (onboardingWorkspace?.mode !== "applicant_preparation") return rows;
  const claim = onboardingWorkspace.claim || {};
  const location = onboardingWorkspace.location_summary || {};
  const organizationId = location.organization_id || "";
  if (organizationId && contexts.some((context) => context.organization?.id === organizationId)) return rows;

  rows.push({
    key: `claim-${claim.id || location.id || "pending"}`,
    mode: "applicant",
    organizationId,
    locationId: location.id || claim.location_id || "",
    name: claim.business_name || location.name || "Organizatie in pregatire",
    logoUrl: "",
    role: claim.requested_membership_role || "organization_owner",
    locationCount: location.id || claim.location_id ? 1 : 0,
    locality: location.locality_name || location.city || "",
    profileCompleteness: onboardingWorkspace.status_center?.preparation_progress?.percentage ?? null,
    status: "pending",
    statusLabel: CLAIM_STATUS_LABELS[claim.status] || "In verificare",
  });
  return rows;
}

export default function PersonalOverview({ user, workspace, onboardingWorkspace, onOpenOrganization, onNavigate }) {
  const preparationWorkspace = onboardingWorkspace?.mode === "applicant_preparation"
    ? onboardingWorkspace
    : workspace?.mode === "applicant_preparation"
      ? workspace
      : onboardingWorkspace;
  const latest = workspace?.latest_claim_status || preparationWorkspace?.latest_claim_status || preparationWorkspace?.claim;
  const organizations = organizationRows(workspace, preparationWorkspace);
  const hasPendingOrganization = organizations.some((organization) => organization.status === "pending");

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cont personal</div>
        <h1 className="mt-1.5 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Salut, {user.full_name || "acolo"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Gaseste locatii, urmareste solicitarile tale si schimba usor intre spatiile disponibile ale contului.</p>
      </section>

      {organizations.length > 0 && (
        <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Building2 className="h-4 w-4" /></div>
            <div>
              <h2 className="text-base font-bold">Organizatiile mele</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Organizatiile create, revendicate sau la care ai acces apar automat aici.</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-border">
            {organizations.map((organization) => (
              <div key={organization.key} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/60">
                    {organization.logoUrl
                      ? <img src={organization.logoUrl} alt="" className="h-full w-full object-cover" />
                      : <Building2 className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{organization.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold">{ROLE_LABELS[organization.role] || "Acces organizatie"}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${organization.status === "pending" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>
                        {organization.statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{organization.locationCount} {organization.locationCount === 1 ? "locatie" : "locatii"}</span>
                      {organization.locality && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{organization.locality}</span>}
                      {organization.profileCompleteness !== null && <span>Profil {organization.profileCompleteness}%</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenOrganization?.({
                    mode: organization.mode,
                    organizationId: organization.organizationId,
                    locationId: organization.locationId,
                  })}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto"
                >
                  {organization.status === "pending" ? "Continua pregatirea" : "Deschide organizatia"} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {latest && !hasPendingOrganization && (
        <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold">Ultima solicitare de furnizor</div>
                <div className="mt-1 text-xs text-muted-foreground">{CLAIM_STATUS_LABELS[latest.status] || latest.status}</div>
              </div>
            </div>
            <button onClick={() => onNavigate("requests")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
              Vezi solicitarile <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary"><Search className="h-4 w-4" /></div>
          <h2 className="mt-4 text-base font-bold">Cauta o locatie</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Gaseste optici, clinici si cabinete potrivite nevoii tale.</p>
          <Link to="/cauta" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
            Incepe cautarea <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-[22px] border border-border bg-accent/40 p-4 shadow-sm sm:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
          <h2 className="mt-4 text-base font-bold">Reprezinti o locatie?</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Adauga sau revendica profilul unei optici, clinici ori al unui cabinet.</p>
          <Link to="/adauga-sau-revendica" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 sm:w-auto">
            Adauga sau revendica <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
