import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Clock, BadgeCheck, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES, PROFESSIONAL_TYPES, SERVICES } from "@/lib/vezunde";

export default function ProviderProfile() {
  const { id } = useParams();
  const [location, setLocation] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Location.get(id),
      base44.entities.Professional.filter({ location_id: id }),
    ]).then(([loc, pros]) => {
      setLocation(loc);
      setProfessionals(pros);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-4xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Se incarca...</div>;
  if (!location) return <div className="max-w-4xl mx-auto px-5 pt-20 text-sm text-muted-foreground">Furnizorul nu a fost gasit.</div>;

  return (
    <div className="max-w-4xl mx-auto px-5 pt-12 pb-8">
      <div className="text-xs font-medium text-primary">{PROVIDER_TYPES[location.provider_type]}</div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">{location.name}</h1>
        {location.is_verified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-accent rounded-full px-2.5 py-1">
            <BadgeCheck className="w-3.5 h-3.5" /> Profil verificat
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{location.address}, {location.city}</span>
        {location.opening_hours && <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{location.opening_hours}</span>}
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-heading font-bold">Despre</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{location.description}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-heading font-bold">Servicii</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(location.services || []).map((s) => (
                <span key={s} className="text-sm bg-secondary rounded-full px-3 py-1.5">{SERVICES[s]}</span>
              ))}
            </div>
          </div>
          {professionals.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-heading font-bold">Echipa</h2>
              <div className="mt-4 space-y-4">
                {professionals.map((pro) => (
                  <div key={pro.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center font-heading font-bold shrink-0">
                      {pro.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{pro.full_name}</div>
                      <div className="text-xs text-primary">{PROFESSIONAL_TYPES[pro.professional_type]}</div>
                      {pro.bio && <p className="mt-1 text-xs text-muted-foreground">{pro.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-sm">Contact direct</h2>
            {location.phone ? (
              <a href={`tel:${location.phone.replace(/\s/g, "")}`} className="mt-3 flex items-center gap-2 text-primary font-medium">
                <Phone className="w-4 h-4" /> {location.phone}
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Telefon indisponibil.</p>
            )}
            {location.availability_note && (
              <p className="mt-3 text-xs text-muted-foreground">{location.availability_note}</p>
            )}
          </div>
          <Link
            to={`/cerere?furnizor=${location.id}`}
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