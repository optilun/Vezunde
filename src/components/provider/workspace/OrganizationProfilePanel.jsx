import React, { useEffect, useMemo, useState } from "react";
import { Building2, Eye, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function Panel({ children, className = "" }) {
  return <section className={"rounded-lg border border-border bg-card p-5 shadow-sm " + className}>{children}</section>;
}

function initialForm(org) {
  return {
    public_name: org?.public_display_name || org?.name || "",
    logo_url: org?.logo_url || "",
    description: org?.public_description || "",
    general_phone: org?.public_phone || "",
    general_email: org?.public_email || "",
    website_url: org?.website_url || "",
    facebook_url: org?.facebook_url || "",
    instagram_url: org?.instagram_url || "",
    linkedin_url: org?.linkedin_url || "",
  };
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export default function OrganizationProfilePanel({ workspace, onSaved }) {
  const organizations = workspace?.organizations || [];
  const locations = workspace?.locations || [];
  const organization = organizations[0] || null;
  const accessLocation = useMemo(() => {
    if (!organization) return locations[0] || null;
    return locations.find((loc) => loc.organization_id === organization.id) || locations[0] || null;
  }, [organization, locations]);
  const [form, setForm] = useState(initialForm(organization));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialForm(organization));
  }, [organization?.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError("");
    setMessage("");
    if (!organization || !accessLocation) {
      setError("Ai nevoie de cel putin o locatie aprobata pentru a trimite profilul organizatiei la review.");
      return;
    }
    if (form.description.length > 500) {
      setError("Descrierea organizatiei trebuie sa aiba cel mult 500 de caractere.");
      return;
    }
    setSaving(true);
    try {
      const create = await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "create_draft",
        location_id: accessLocation.id,
        section: "organization_profile",
        payload: form,
      });
      const submission = create.data?.submission;
      if (!submission?.id) throw new Error("Draftul nu a fost creat.");
      await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "submit",
        location_id: accessLocation.id,
        section: "organization_profile",
        submission_id: submission.id,
      });
      setMessage("Profilul organizatiei a fost trimis spre review.");
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut trimite modificarile.");
    } finally {
      setSaving(false);
    }
  };

  if (!organization) {
    return (
      <Panel>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public</h1>
        <p className="mt-2 text-sm text-muted-foreground">Profilul organizatiei apare dupa aprobarea unei revendicari.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Profil public organizatie</h1>
        <p className="mt-2 text-sm text-muted-foreground">Brand-level: logo, descriere, contacte generale si linkuri sociale. Locatiile se gestioneaza separat.</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
        <Panel>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-5 h-5" />
            <h2 className="font-semibold">Informatii publice generale</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nume public organizatie">
              <Input value={form.public_name} onChange={(e) => update("public_name", e.target.value)} placeholder="Ex: Vezunde Optic" />
            </Field>
            <Field label="Logo URL">
              <Input value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Telefon general">
              <Input value={form.general_phone} onChange={(e) => update("general_phone", e.target.value)} placeholder="+40..." />
            </Field>
            <Field label="Email general">
              <Input value={form.general_email} onChange={(e) => update("general_email", e.target.value)} placeholder="contact@..." />
            </Field>
            <Field label="Website">
              <Input value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Facebook">
              <Input value={form.facebook_url} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
            </Field>
            <Field label="Instagram">
              <Input value={form.instagram_url} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
            </Field>
            <Field label="LinkedIn">
              <Input value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/..." />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Descriere organizatie" hint={(500 - form.description.length) + " caractere ramase"}>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value.slice(0, 520))} rows={5} placeholder="Descrie pe scurt organizatia, fara HTML sau promisiuni medicale." />
            </Field>
          </div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
          <div className="mt-5 flex justify-end">
            <Button onClick={submit} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? "Se trimite..." : "Trimite spre review"}
            </Button>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <h2 className="font-semibold">Preview public</h2>
          </div>
          <div className="mt-5 rounded-lg border border-border p-4">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo organizatie" className="w-14 h-14 rounded-lg object-cover border border-border" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center font-bold">{(form.public_name || organization.name || "V").charAt(0)}</div>
            )}
            <h3 className="mt-4 font-semibold">{form.public_name || organization.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{form.description || "Descrierea organizatiei va aparea aici dupa aprobare."}</p>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {form.general_phone && <p>{form.general_phone}</p>}
              {form.general_email && <p>{form.general_email}</p>}
              {form.website_url && <p>{form.website_url}</p>}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Modificarile devin publice doar dupa aprobarea administratorului.</p>
        </Panel>
      </div>
    </div>
  );
}
