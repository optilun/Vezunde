import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Clock, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES, PROFESSIONAL_AFFILIATION_STATUS, PROFESSIONAL_TYPES, SERVICES } from "@/lib/vezunde";
import TrustBadge from "@/components/results/TrustBadge";
import ServiceChip from "@/components/results/ServiceChip";

// Module 3E: public profile renders ONLY the whitelisted payload returned by
// getPublicProviderProfile — never raw ProviderLocation / LocationService reads.
export default function ProviderProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions
      .invoke("getPublicProviderProfile", { location_id: id })
      .then((res) => setProfile(res.data?.profile || null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Se incarca...</div>;
  if (!profile) return <div className="max-w-4xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Furnizorul nu a fost gasit.</div>;

  const status = profile.profile_control_status;

  return (
    <div className="max-w-4xl mx-auto px-5 pt-12 pb-8">
      <div className="text-xs font-medium text-primary">{PROVIDER_TYPES[profile.provider_type]}</div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">{profile.name}</h1>
        <TrustBadge status={status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {profile.address && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{profile.address}, {profile.city}</span>
        )}
        {!profile.address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{profile.city}</span>}
        {profile.opening_hours && <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{profile.opening_hours}</span>}
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-4">
          {profile.description && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-heading font-bold">Despre</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{profile.description}</p>
            </div>
          )}
          {profile.services.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-heading font-bold">Servicii</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.services.map((s) => <ServiceChip key={s} label={SERVICES[s] || s} />)}
              </div>
            </div>
          )}
          {status === "directory" && (
            <div className="bg-secondary/40 border border-dashed border-border/80 rounded-2xl p-6">
              <p className="text-sm text-muted-foreground">
                Informatiile acestui profil provin din surse publice si pot fi actualizate de furnizor prin revendicarea profilului.
              </p>
              <Link
                to="/adauga-sau-revendica"
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
              >
                Aceasta este locatia ta? Revendica profilul
              </Link>
            </div>
          )}
          {profile.team.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-heading font-bold">Echipa</h2>
              <p className="mt-1 text-xs text-muted-foreground">Specialistii sunt afisati ca membri ai acestei locatii.</p>
              <div className="mt-4 space-y-4">
                {profile.team.map((pro, i) => {
                  const affiliation = pro.affiliation_status || "location_added";
                  const showBadge = affiliation !== "location_added";
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center font-heading font-bold shrink-0">
                        {pro.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-sm">{pro.full_name}</div>
                          {showBadge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              {PROFESSIONAL_AFFILIATION_STATUS[affiliation] || affiliation}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-primary">{PROFESSIONAL_TYPES[pro.professional_type]}</div>
                        {pro.bio && <p className="mt-1 text-xs text-muted-foreground">{pro.bio}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-sm">Contact direct</h2>
            {profile.phone_public ? (
              <a href={`tel:${profile.phone_public.replace(/\s/g, "")}`} className="mt-3 flex items-center gap-2 text-primary font-medium">
                <Phone className="w-4 h-4" /> {profile.phone_public}
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Telefon indisponibil.</p>
            )}
            {profile.availability_label && (
              <p className="mt-3 text-xs text-muted-foreground">{profile.availability_label} · publicat de furnizor</p>
            )}
          </div>
          <Link
            to={`/cerere?furnizor=${profile.id}`}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl px-6 py-4 font-medium hover:opacity-90 transition-opacity"
          >
            Trimite o cerere <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted-foreground px-1">Datele tale de contact nu sunt transmise automat furnizorului. Poti oricand suna direct.</p>
        </div>
      </div>
    </div>
  );
}