// Mediu de test pentru handler-ele de outreach: baza de date in memorie, SDK-ul Base44 simulat
// (bundle esbuild cu `npm:@base44/sdk` inlocuit), Resend si DNS-over-HTTPS simulate, webhook-uri
// semnate Svix. Folosit de scripts/verify-outreach-*.mjs.
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Credentialul de serviciu cu care cronul Base44 cheama functiile (Authorization identic cu
// Base44-Service-Authorization). Un apel anonim cu `__automation_trigger` trebuie refuzat.
export const SERVICE_TOKEN = 'Bearer service-token-for-tests-0123456789';
export const SERVICE_HEADERS = { authorization: SERVICE_TOKEN, 'Base44-Service-Authorization': SERVICE_TOKEN };

export function installOutreachEnvironment({ dns = {}, dnsUnreachable = [] } = {}) {
  const webhookSecretBytes = randomBytes(32);
  const env = {
    RESEND_API_KEY: 're_test',
    OUTREACH_UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret-0123456789abcdef',
    RESEND_WEBHOOK_SECRET: `whsec_${webhookSecretBytes.toString('base64')}`,
    // Fara asteptari reale in teste (confirmarea lock-ului, pauza dintre trimiterile individuale).
    OUTREACH_LOCK_CONFIRM_MS: '0',
    OUTREACH_SINGLE_SEND_SPACING_MS: '0',
  };
  globalThis.Deno = { env: { get: (key) => env[key] } };

  // Resend simulat: pastreaza raspunsul fiecarei chei de idempotenta (ca Resend, 24 de ore), poate
  // refuza anumite adrese (422 pe tot lotul, ca in realitate) si poate esua la cerere.
  const state = {
    resendBatches: [], resendSingles: [], messageSeq: 0,
    idempotencyKeys: [], idempotentReplays: 0,
    rejectAddresses: new Set(), failNextBatches: [],
    onBatch: null,
  };
  const idempotencyCache = new Map();
  const unreachable = new Set(dnsUnreachable);
  const headerOf = (options, name) => {
    const headers = options.headers || {};
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : '';
  };
  const replayOr = (key, produce) => {
    if (key && idempotencyCache.has(key)) {
      state.idempotentReplays += 1;
      const cached = idempotencyCache.get(key);
      return new Response(cached.body, { status: cached.status });
    }
    const produced = produce();
    if (key && produced.status < 500) idempotencyCache.set(key, produced);
    return new Response(produced.body, { status: produced.status });
  };

  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    if (target.hostname === 'cloudflare-dns.com' || target.hostname === 'dns.google') {
      const name = target.searchParams.get('name');
      if (unreachable.has(name)) return new Response('unavailable', { status: 503 });
      const answer = dns[name] || { Status: 0, Answer: [{ type: 15, data: `10 mx.${name}.` }] };
      return new Response(JSON.stringify(answer), { status: 200 });
    }
    if (target.hostname === 'api.resend.com' && target.pathname === '/emails/batch') {
      const key = headerOf(options, 'Idempotency-Key');
      state.idempotencyKeys.push(key);
      if (state.onBatch) await state.onBatch(JSON.parse(options.body));
      if (state.failNextBatches.length) {
        const failure = state.failNextBatches.shift();
        return new Response(JSON.stringify({ message: failure.message || 'fail' }), { status: failure.status });
      }
      return replayOr(key, () => {
        const payloads = JSON.parse(options.body);
        if (payloads.some((payload) => state.rejectAddresses.has(payload.to[0]))) {
          return { status: 422, body: JSON.stringify({ name: 'validation_error', message: 'Invalid `to` field.' }) };
        }
        state.resendBatches.push(payloads);
        return { status: 200, body: JSON.stringify({ data: payloads.map(() => ({ id: `msg-${++state.messageSeq}` })) }) };
      });
    }
    if (target.hostname === 'api.resend.com' && target.pathname === '/emails') {
      const key = headerOf(options, 'Idempotency-Key');
      return replayOr(key, () => {
        const payload = JSON.parse(options.body);
        if (state.rejectAddresses.has(payload.to[0])) {
          return { status: 422, body: JSON.stringify({ name: 'validation_error', message: `Invalid \`to\` field: ${payload.to[0]}` }) };
        }
        state.resendSingles.push(payload);
        return { status: 200, body: JSON.stringify({ id: `msg-${++state.messageSeq}` }) };
      });
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
  const hooks = { beforeUpdate: null };
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
        if (hooks.beforeUpdate) await hooks.beforeUpdate(name, id, patch);
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
  return { rows: (name) => [...table(name).values()], row: (name, id) => table(name).get(id), svc: { entities }, hooks };
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

// `rejectServiceRole`: simuleaza un credential de serviciu falsificat — orice citire facuta cu el
// esueaza, ca pe platforma reala.
export function useStore(store, user = null, { rejectServiceRole = false } = {}) {
  const failing = { entities: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { throw new Error('401 invalid service token'); } }) }) };
  globalThis.__outreachTestClient = () => ({ asServiceRole: rejectServiceRole ? failing : store.svc, auth: { me: async () => user } });
}

export const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@viasee.test' };

export async function callHandler(handler, store, payload, { user = ADMIN, url = 'https://viasee.test/api', headers = {}, rawBody, method = 'POST', raw = false, rejectServiceRole = false } = {}) {
  useStore(store, user, { rejectServiceRole });
  const response = await handler.handle(new Request(url, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: rawBody !== undefined ? rawBody : JSON.stringify(payload) }),
  }));
  if (raw) return response;
  const data = await response.json();
  return Object.defineProperty(data, '__status', { value: response.status, enumerable: false });
}

// Trimiterea pornita de cron: credentialul de serviciu, fara utilizator.
export function runSender(sendOps, store, { headers = SERVICE_HEADERS, user = null, rejectServiceRole = false } = {}) {
  return callHandler(sendOps, store, { action: 'advance_campaign_sends', __automation_trigger: true }, { user, headers, rejectServiceRole });
}

export function signedWebhookHeaders(webhookSecretBytes, body) {
  const id = `evt_${randomBytes(6).toString('hex')}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', webhookSecretBytes).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
}

// Evenimentul Resend pentru ultimul email trimis catre `email` (cu etichetele puse la trimitere,
// fie ca obiect, fie ca lista — Resend le trimite in ambele forme).
export function resendEvent(state, type, email, { tagsAsList = false, extra = {}, createdAt, messageId } = {}) {
  const sent = [...state.resendBatches.flat(), ...state.resendSingles].filter((payload) => payload.to[0] === email).pop();
  const tagList = sent?.tags || [];
  const tags = tagsAsList ? tagList : Object.fromEntries(tagList.map((tag) => [tag.name, tag.value]));
  return {
    type,
    created_at: createdAt || new Date().toISOString(),
    data: { to: [email], tags, ...(messageId ? { email_id: messageId } : {}), ...extra },
  };
}

export async function sendWebhook(webhookOps, store, webhookSecretBytes, event) {
  const body = JSON.stringify(event);
  return callHandler(webhookOps, store, null, { user: null, rawBody: body, headers: signedWebhookHeaders(webhookSecretBytes, body) });
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

export async function seedCampaign(store, contactIds, extra = {}) {
  return store.svc.entities.OutreachCampaign.create({
    name: 'Test',
    subject: 'Profilul dumneavoastra',
    body_html: 'Buna ziua, [FIRMA].',
    from_email: 'contact@mail.viasee.ro',
    status: 'ready',
    recipient_contact_ids: contactIds,
    recipient_count: contactIds.length,
    current_cursor: 0,
    sent_count: 0,
    approved_at: '2026-09-22T08:00:00.000Z',
    ...extra,
  });
}
