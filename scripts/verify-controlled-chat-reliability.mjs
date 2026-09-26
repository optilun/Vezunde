import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { loadChatMessagePage } from '../base44/functions/controlledChatOps/messageHistory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
const check = (name) => { checks++; console.log('PASS ' + name); };

// A scoped fake entity implements filter operators and deliberately reverses equal-date
// rows. The page must remain complete even when DB tie ordering changes.
let rows = Array.from({ length: 210 }, (_, index) => ({
  id: String(index + 1).padStart(5, '0'),
  conversation_id: 'A', status: 'active',
  created_date: new Date(Date.UTC(2026, 8, 26, 0, 0, index)).toISOString(),
  body: 'Synthetic ' + index,
}));
function matches(row, query) {
  return Object.entries(query).every(([key, value]) => value && typeof value === 'object'
    ? Object.entries(value).every(([operator, bound]) => operator === '$lt' && row[key] < bound)
    : row[key] === value);
}
const svc = { entities: { PatientRequestMessage: {
  get: async (id) => rows.find((row) => row.id === id),
  filter: async (query, sort, limit) => rows.filter((row) => matches(row, query))
    .sort((a, b) => String(b[sort.slice(1)]).localeCompare(String(a[sort.slice(1)])) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit),
} } };
let page = await loadChatMessagePage(svc, 'A');
assert.equal(page.messages.length, 50);
assert.equal(page.messages.at(-1).id, '00210');
const history = [...page.messages];
rows.push({ ...rows.at(-1), id: '00211', created_date: '2026-09-26T01:00:00.000Z' });
while (page.next_before_message_id) {
  page = await loadChatMessagePage(svc, 'A', page.next_before_message_id);
  history.unshift(...page.messages);
}
assert.equal(history.length, 210);
assert.equal(new Set(history.map((row) => row.id)).size, 210);
assert.equal(history[0].id, '00001');
assert.equal((await loadChatMessagePage(svc, 'A')).messages.at(-1).id, '00211');
check('210 messages plus concurrent insert: latest visible, complete history, no duplicates');

rows = Array.from({ length: 125 }, (_, index) => ({
  id: String(index + 1).padStart(5, '0'), conversation_id: 'ties', status: 'active',
  created_date: '2026-09-26T02:00:00.000Z',
}));
page = await loadChatMessagePage(svc, 'ties');
const tied = [...page.messages];
while (page.next_before_message_id) {
  page = await loadChatMessagePage(svc, 'ties', page.next_before_message_id);
  tied.unshift(...page.messages);
}
assert.deepEqual(tied.map((row) => row.id), rows.map((row) => row.id));
await assert.rejects(loadChatMessagePage(svc, 'other-conversation', '00001'), (error) => error.status === 400);
await assert.rejects(loadChatMessagePage(svc, 'ties', 'missing'), (error) => error.status === 400);
rows[0].status = 'deleted';
await assert.rejects(loadChatMessagePage(svc, 'ties', '00001'), (error) => error.status === 400);
assert.deepEqual(await loadChatMessagePage(svc, null), { messages: [], next_before_message_id: null });
check('equal timestamps, foreign/deleted/missing cursors, empty conversation');

await mkdir(path.join(root, 'node_modules/.cache'), { recursive: true });
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/chat-reliability-'));
try {
  const outfile = path.join(scratch, 'components.mjs');
  const bundle = await build({
    stdin: {
      contents: `export { default as Provider } from './src/components/workspace/provider/ProviderLeadChat.jsx';
export { default as Patient } from './src/components/intake2/PatientRequestChat.jsx';
export { default as Thread } from './src/components/chat/ChatThread.jsx';`,
      resolveDir: root, loader: 'jsx',
    },
    bundle: true, platform: 'node', format: 'esm', write: false,
    external: ['react', 'react-dom'],
    alias: { '@': path.join(root, 'src') },
    plugins: [{
      name: 'mock-transport-only',
      setup(builder) {
        builder.onResolve({ filter: /base44Client$/ }, () => ({ path: 'client', namespace: 'chat-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'chat-test' }, () => ({
          contents: 'export const base44 = { functions: { invoke: (...args) => globalThis.__chatTestInvoke(...args) } };',
        }));
      },
    }],
  });
  await writeFile(outfile, bundle.outputFiles[0].text);
  const { Provider, Patient, Thread } = await import(pathToFileURL(outfile).href);
  const h = React.createElement;
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const message = (id, sender = 'patient') => ({ id, sender_type: sender, body: 'Mesaj ' + id, sent_at: '2026-09-26T10:00:00.000Z' });
  const payload = (id, extra = {}) => ({
    chat: { id: 'conversation-' + id, status: 'open', can_send: true, unread_count: 0 },
    messages: [message(id)], next_before_message_id: null, ...extra,
  });
  const settle = async (fn) => { await act(async () => { fn?.(); await Promise.resolve(); }); };
  const text = (renderer) => JSON.stringify(renderer.toJSON());
  const mockNode = () => ({ scrollTop: 0, scrollHeight: 500, clientHeight: 200 });
  for (const [label, Component] of [['provider', Provider], ['patient', Patient]]) {
    const props = (id) => label === 'provider'
      ? { leadId: id, locationId: 'location-' + id, enabled: true, responseType: 'can_help' }
      : { requestId: id, locationId: 'location-' + id, accessToken: 'synthetic-token', responseType: 'can_help' };
    const idOf = (input) => input.lead_id || input.request_id;
    const calls = [];
    const waitA = deferred();
    globalThis.__chatTestInvoke = async (_name, input) => {
      calls.push(input);
      const id = idOf(input);
      return { data: id === 'A' ? await waitA.promise : payload(id) };
    };
    let renderer;
    await settle(() => { renderer = TestRenderer.create(h(Component, props('A')), { createNodeMock: mockNode }); });
    await settle(() => renderer.update(h(Component, props('B'))));
    await settle(() => waitA.resolve(payload('A', { chat: { status: 'open', unread_count: 1, can_send: true } })));
    assert.ok(text(renderer).includes('Mesaj B'));
    assert.ok(!text(renderer).includes('Mesaj A'));
    assert.equal(calls.filter((call) => call.action === 'mark_read' && idOf(call) === 'A').length, 0);
    check(label + ': delayed A status cannot overwrite B or mark abandoned A as read');

    await settle(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Draft pentru B' } }));
    await settle(() => renderer.update(h(Component, props('C'))));
    assert.equal(renderer.root.findByType('textarea').props.value, '');
    assert.ok(!text(renderer).includes('Mesaj B'));
    check(label + ': switching recipient clears draft and previous messages');

    const persisted = new Set();
    const sendIds = [];
    let loseResponse = true;
    globalThis.__chatTestInvoke = async (_name, input) => {
      if (input.action === 'send') {
        sendIds.push(input.client_message_id);
        persisted.add(input.client_message_id);
        if (loseResponse) { loseResponse = false; throw new Error('Synthetic lost response after commit'); }
      }
      return { data: payload(idOf(input)) };
    };
    await settle(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Un mesaj de test' } }));
    await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(renderer.root.findByType('textarea').props.value, 'Un mesaj de test');
    await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(sendIds.length, 2);
    assert.equal(sendIds[0], sendIds[1]);
    assert.equal(persisted.size, 1);
    assert.equal(renderer.root.findByType('textarea').props.value, '');
    await settle(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Un mesaj de test' } }));
    await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.notEqual(sendIds[2], sendIds[1]);
    check(label + ': committed-but-unacknowledged retry reuses ID; next message gets new ID');

    const sending = deferred();
    let sends = 0;
    globalThis.__chatTestInvoke = async (_name, input) => {
      if (input.action === 'send') { sends++; return { data: await sending.promise }; }
      return { data: payload(idOf(input)) };
    };
    await settle(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Mesaj in asteptare' } }));
    let sendPromise;
    await settle(() => {
      const submit = renderer.root.findByType('form').props.onSubmit;
      sendPromise = submit({ preventDefault() {} });
      void submit({ preventDefault() {} });
    });
    assert.equal(sends, 1);
    assert.equal(renderer.root.findByType('textarea').props.disabled, true);
    await settle(() => renderer.update(h(Component, props('D'))));
    await act(async () => { sending.resolve(payload('C')); await sendPromise; });
    assert.ok(text(renderer).includes('Mesaj D'));
    assert.ok(!text(renderer).includes('Mesaj C'));
    check(label + ': double-submit blocked; late send result cannot update next recipient');

    globalThis.__chatTestInvoke = async (_name, input) => ({ data: payload(idOf(input),
      input.before_message_id
        ? { messages: [message('older')], next_before_message_id: null }
        : { messages: [message('latest')], next_before_message_id: 'latest' }) });
    await settle(() => renderer.update(h(Component, props('E'))));
    const olderButton = renderer.root.findAllByType('button').find((button) => button.props.children === 'Încarcă mesaje mai vechi');
    assert.ok(olderButton);
    await act(async () => { await olderButton.props.onClick(); });
    assert.ok(text(renderer).includes('Mesaj older'));
    assert.ok(text(renderer).includes('Mesaj latest'));
    assert.equal(renderer.root.findAllByType('button').filter((button) => button.props.children === 'Încarcă mesaje mai vechi').length, 0);
    assert.equal(renderer.root.findByProps({ role: 'log' }).props['aria-live'], 'polite');
    const textarea = renderer.root.findByType('textarea');
    assert.equal(renderer.root.findByType('label').props.htmlFor, textarea.props.id);
    check(label + ': older page appended without losing current messages; accessible log and input');
    await settle(() => renderer.unmount());
  }

  // Exercise scrolling using a measured container: no focus/viewport jump for someone
  // reading older messages, and preserve the anchor when an earlier page is prepended.
  const node = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  let thread;
  const threadProps = { title: 'Test', mineSenderType: 'patient', messages: [message('b')] };
  await settle(() => { thread = TestRenderer.create(h(Thread, threadProps), { createNodeMock: () => node }); });
  node.scrollTop = 200;
  await settle(() => thread.root.findByProps({ role: 'log' }).props.onScroll());
  node.scrollHeight = 1100;
  await settle(() => thread.update(h(Thread, { ...threadProps, messages: [message('b'), message('c')] })));
  assert.equal(node.scrollTop, 200);
  assert.ok(text(thread).includes('Mesaje noi'));
  node.scrollHeight = 1200;
  await settle(() => thread.update(h(Thread, { ...threadProps, messages: [message('a'), message('b'), message('c')] })));
  assert.equal(node.scrollTop, 300);
  await settle(() => thread.unmount());
  check('new messages preserve reading position; prepending history preserves scroll anchor');
} finally {
  delete globalThis.__chatTestInvoke;
  await rm(scratch, { recursive: true, force: true });
}
console.log(`Controlled chat reliability: ${checks} behavioral scenarios passed.`);
