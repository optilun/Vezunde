// Mediu de test pentru handler-ele de outreach: baza de date in memorie, SDK-ul Base44 simulat
// (bundle esbuild cu `npm:@base44/sdk` inlocuit), Resend si DNS-over-HTTPS simulate, webhook-uri
// semnate Svix. Folosit de scripts/verify-outreach-*.mjs.
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function installOutreachEnvironment({ dns = {}, dnsUnreachable = [] } = {}) {
  const webhookSecretBytes = randomBytes(32);
  const env = {
    RESEND_API_KEY: 're_test',
    OUTREACH_UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret-0123456789abcdef',
    RESEND_WEBHOOK_SECRET: `whsec_${webhookSecretBytes.toString('base64')}`,
  };
  globalThis.Deno = { env: { get: (key) => env[key] } };

  const state = { resendBatches: [], resendSingles: [], messageSeq: 0 };
  const unreachable = new Set(dnsUnreachable);

  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    if (target.hostname === 'cloudflare-dns.com' || target.hostname === 'dns.google') {
      const name = target.searchParams.get('name');
      if (unreachable.has(name)) return new Response('unavailable', { status: 503 });
      const answer = dns[name] || { Status: 0, Answer: [{ type: 15, data: `10 mx.${name}.` }] };
      return new Response(JSON.stringify(answer), { status: 200 });
    }
    if (target.hostname === 'api.resend.com' && target.pathname === '/emails/batch') {
      const payloads = JSON.parse(options.body);
      state.resendBatches.push(payloads);
      return new Response(JSON.stringify({ data: payloads.map(() => ({ id: `msg-${++state.messageSeq}` })) }), { status: 200 });
    }
    if (target.hostname === 'api.resend.com' && target.pathname === '/emails') {
      const payload = JSON.parse(options.body);
      state.resendSingles.push(payload);
      return new Response(JSON.stringify({ id: `msg-${++state.messageSeq}` }), { status: 200 });
    }
    throw new Error(`fetch neasteptat in test: ${url}`);
  };

  return { env, state, webhookSecretBytes };
}

export function createStore() {
  const tables = new Map();
  let seq = 0;
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const clone = (value) => (value === undefined ? value : structuredClone(value));
  const entities = new Proxy({}, {
    get: (_target, name) => ({
      async get(id) {
        const row = table(name).get(id);
        if (!row) throw new Error(`${name} ${id} nu exista`);
        return clone(row);
      },
      async filter(query = {}) {
        return [...table(name).values()].filter((row) => Object.entries(query).every(([key, value]) => row[key] === value)).map(clone);
      },
      async list() {
        return [...table(name).values()].map(clone);
      },
      async create(data) {
        seq += 1;
        const row = { id: data?.id || `${name}-${seq}`, created_date: new Date().toISOString(), ...clone(data) };
        table(name).set(row.id, row);
        return clone(row);
      },
      async update(id, patch) {
        const row = table(name).get(id);
        if (!row) throw new Error(`${name} ${id} nu exista`);
        Object.assign(row, clone(patch));
        return clone(row);
      },
      async delete(id) {
        table(name).delete(id);
      },
    }),
  });
  return { rows: (name) => [...table(name).values()], row: (name, id) => table(name).get(id), svc: { entities } };
}

export async function loadHandler(relativePath) {
  const result = await build({
    entryPoints: [path.join(root, relativePath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [{
      name: 'stub-base44-sdk',
      setup(builder) {
        builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export function createClientFromRequest(req) { return globalThis.__outreachTestClient(req); }',
          loader: 'js',
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

export function useStore(store, user = null) {
  globalThis.__outreachTestClient = () => ({ asServiceRole: store.svc, auth: { me: async () => user } });
}

export const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@viasee.test' };

export async function callHandler(handler, store, payload, { user = ADMIN, url = 'https://viasee.test/api', headers = {}, rawBody } = {}) {
  useStore(store, user);
  const response = await handler.handle(new Request(url, {
    method: 'POST',
    headers,
    body: rawBody !== undefined ? rawBody : JSON.stringify(payload),
  }));
  return response.json();
}

export function signedWebhookHeaders(webhookSecretBytes, body) {
  const id = `evt_${randomBytes(6).toString('hex')}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', webhookSecretBytes).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
}

export async function seedContact(store, email, extra = {}) {
  return store.svc.entities.OutreachContact.create({
    email,
    normalized_email: email,
    company_name: `Firma ${email}`,
    city: 'Cluj-Napoca',
    county: 'Cluj',
    provider_type: 'optica_medicala',
    status: 'new',
    email_status: 'active',
    lawful_basis: 'legitimate_interest',
    source_url: 'https://registru.test',
    collection_date: '2026-09-01T00:00:00.000Z',
    source_type: 'public_directory',
    ...extra,
  });
}
