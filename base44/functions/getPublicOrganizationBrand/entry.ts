import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MAX_INLINE_LOGO_BYTES = 750000;

function publicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function inlinePublicImage(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/*' },
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_INLINE_LOGO_BYTES) return null;
    return `data:${contentType};base64,${bytesToBase64(bytes)}`;
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = String(payload.location_id || '').trim();
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (
      !location
      || location.status !== 'publicata'
      || location.active_status === 'inactiva'
      || location.profile_control_status === 'suspended'
      || !location.organization_id
    ) return Response.json({ error: 'Profilul nu a fost gasit' }, { status: 404 });

    const organization = await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null);
    if (!organization || organization.status === 'inactiva') {
      return Response.json({ error: 'Organizatia nu a fost gasita' }, { status: 404 });
    }

    const logoUrl = publicUrl(organization.logo_url);
    const logoDataUrl = await inlinePublicImage(logoUrl);

    return Response.json({
      brand: {
        organization_id: organization.id,
        organization_name: organization.public_display_name || organization.name || null,
        logo_url: logoUrl,
        logo_data_url: logoDataUrl,
        logo_configured: Boolean(logoUrl),
        logo_version: organization.profile_updated_at || organization.updated_date || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
