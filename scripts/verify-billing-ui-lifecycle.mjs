import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise real component event handlers with a small hook host and deferred API calls.
// No Stripe calls, browser session, real accounts, or application data are used.
const output = await build({
  entryPoints: ['src/components/workspace/provider/leads/ProviderBillingPanel.jsx'],
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  jsx: 'transform', tsconfigRaw: { compilerOptions: { jsx: 'react' } },
  plugins: [{ name: 'billing-ui-host', setup(builder) {
    builder.onResolve({ filter: /^(react|react-router-dom|lucide-react|@\/api\/base44Client)$/ }, args => ({ path: args.path, namespace: 'host' }));
    builder.onLoad({ filter: /.*/, namespace: 'host' }, ({ path }) => ({
      loader: 'js',
      contents: path === 'react' ? `
        export const useState = value => globalThis.__billingUI.state(value);
        export const useRef = value => ({current: value});
        export const useCallback = callback => callback;
        export const useEffect = (effect, deps) => { if (!deps.length) globalThis.__billingUI.cleanups.push(effect()); };
        export default {createElement: (type, props, ...children) => ({type, props: {...props, children}}), Fragment: 'fragment'};
      ` : path === 'react-router-dom' ? 'export const useSearchParams = () => [new URLSearchParams(), () => {}];'
      : path === 'lucide-react' ? 'export const CreditCard = "icon", FileText = "icon", Loader2 = "icon", ExternalLink = "icon", RefreshCw = "icon", ShieldCheck = "icon";'
      : 'export const base44 = {functions: {invoke: (...args) => globalThis.__billingUI.invoke(...args)}};'
    }));
  }}],
});
const { default: Panel } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function host({ subscribed = true, editing = false } = {}) {
  const customer = { name: 'Latest server name', email: 'billing@example.test', address: { line1: 'Address', city: 'City', country: 'RO' } };
  const data = { customer, methods: [], invoices: [], pricing: { amount: 4900, currency: 'ron', active: true }, subscription: subscribed ? {status: 'active'} : null };
  const calls = [], redirects = [], updates = [], cleanups = [], pending = [];
  let index = 0;
  const h = { calls, redirects, updates, cleanups, pending,
    state(value) {
      const id = index++;
      const initial = id === 0 ? data : id === 2 ? editing : id === 6 ? false : typeof value === 'function' ? value() : value;
      return [initial, next => updates.push({id, next})];
    },
    invoke(name, payload) { calls.push({name, payload}); const wait = deferred(); pending.push(wait); return wait.promise; },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
  globalThis.__billingUI = h;
  globalThis.window = {location: {origin: 'https://example.test', assign: url => redirects.push(url)}};
  const outer = Panel({locationId: 'loc_a'});
  h.tree = outer.type({locationId: 'loc_a'});
  return h;
}
function label(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.props?.children || []).flat(Infinity).map(label).join('');
}
function find(node, text) {
  if (!node || typeof node !== 'object') return null;
  if (['button', 'a'].includes(node.type) && label(node).includes(text)) return node;
  for (const child of (node.props?.children || []).flat(Infinity)) { const result = find(child, text); if (result) return result; }
  return null;
}
function click(h, text) {
  const node = find(h.tree, text);
  assert.ok(node, 'Expected action: ' + text);
  node.props.onClick({currentTarget: {form: {reportValidity: () => true}}});
}
{
  const h = host(); click(h, 'Gestionează abonamentul');
  h.unmount(); h.pending[0].resolve({data: {url: 'https://stripe.test/old-location'}}); await flush();
  assert.deepEqual(h.redirects, [], 'Late portal response must not redirect after leaving the location');
}
{
  const h = host({subscribed: false, editing: true}); click(h, 'Salvează și continuă');
  h.unmount(); h.pending[0].resolve({data: {ok: true}}); await flush();
  assert.equal(h.calls.length, 1, 'Leaving during save must not create a Checkout session');
}
{
  const h = host({subscribed: false, editing: true}); click(h, 'Salvează și continuă');
  h.pending[0].resolve({data: {ok: true}}); await flush();
  assert.equal(h.calls[1].name, 'createProviderCheckoutSession');
  h.unmount(); h.pending[1].resolve({data: {url: 'https://stripe.test/old-location'}}); await flush();
  assert.deepEqual(h.redirects, [], 'Late Checkout response must not redirect after leaving');
}
{
  const h = host(); click(h, 'Gestionează abonamentul');
  h.pending[0].resolve({data: {url: 'https://stripe.test/current-location'}}); await flush();
  assert.deepEqual(h.redirects, ['https://stripe.test/current-location'], 'Current location still opens its portal');
}
{
  const h = host(); click(h, 'Modifică datele');
  assert.equal(h.updates.find(u => u.id === 1).next.billing_name, 'Latest server name', 'New edits must start from the current server data');
}
{
  const h = host({subscribed: false, editing: true}); click(h, 'Activează Pro');
  assert.equal(h.updates.some(u => u.id === 1), false, 'An already open form must retain unsaved input');
}
console.log('Billing UI: late portal/Checkout responses, departure during save, normal redirect and billing edit freshness passed (isolated hook host).');
