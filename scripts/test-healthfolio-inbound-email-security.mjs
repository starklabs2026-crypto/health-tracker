import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { File } from 'node:buffer';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

if (!vm.SourceTextModule) {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(child.status ?? 1);
}

const root = fileURLToPath(new URL('../supabase/functions/', import.meta.url));
const fixtureKey = 'test-only';
const authId = '11111111-1111-4111-8111-111111111111';
const otherAuthId = '22222222-2222-4222-8222-222222222222';
const profile = { id: 'synthetic-profile', authUserId: authId, email: 'not-an-identity@example.test', inboundEmailAlias: 'synthetic', deletedAt: null };
const consent = { userId: profile.id, consentVersion: '2026-07-10', privacyPolicyVersion: '2026-07-10', eulaType: 'apple_standard', healthDataProcessingAccepted: true, acceptedAt: '2026-07-10T00:00:00Z' };
const email = { to: 'test.healthfolio+synthetic@gmail.com', from: 'sender@example.test', subject: 'Synthetic attachment', attachments: [{ filename: 'synthetic.pdf', contentType: 'application/pdf', contentBase64: 'JVBERi0xLjQK' }] };

async function harness(options = {}) {
  const reads = [], writes = [], storage = [], queued = [], authLookups = [], logs = [];
  const tables = { User: [profile], UserConsent: [consent], FamilyLink: [], Document: [], ...options.tables };
  const authUsers = options.authUsers ?? [{ id: authId }];
  let handler;
  const admin = {
    auth: { admin: { getUserById: async (id) => {
      authLookups.push(id);
      const user = authUsers.find((entry) => entry.id === id);
      return { data: { user: user ?? null }, error: options.authError ?? (user ? null : { status: 404, code: 'user_not_found' }) };
    } } },
    from(table) {
      const filters = [];
      let operation = 'select', values, single = false, limit = Infinity, columns = '*';
      const q = {
        select(value = '*') { columns = value; return q; },
        eq(key, value) { filters.push({ key, value, matches: (row) => row[key] === value }); return q; },
        neq(key, value) { filters.push({ key, value, matches: (row) => row[key] !== value }); return q; },
        is(key, value) { return q.eq(key, value); },
        in(key, value) { filters.push({ key, value, matches: (row) => value.includes(row[key]) }); return q; },
        order() { return q; },
        limit(value) { limit = value; return q; },
        maybeSingle() { single = true; return q; },
        insert(value) { operation = 'insert'; values = value; return q; },
        update(value) { operation = 'update'; values = value; return q; },
        then(resolve, reject) {
          const rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter.matches(row))).slice(0, limit);
          const event = { table, operation, filters: filters.map(({ key, value }) => ({ key, value })), values };
          if (operation === 'select') reads.push(event);
          else writes.push(event);
          const error = options.failTable === table ? { message: 'SENSITIVE_DATABASE_DETAIL', code: 'db_error' } : null;
          if (!error && operation === 'insert') (tables[table] ??= []).push({ ...values, deletedAt: null });
          if (!error && operation === 'update') for (const row of rows) Object.assign(row, values);
          const selected = rows.map((row) => columns === '*' ? row : Object.fromEntries(columns.split(',').map((key) => key.trim()).map((key) => [key, row[key]])));
          return Promise.resolve({ data: operation === 'select' ? single ? selected[0] ?? null : selected : null, error }).then(resolve, reject);
        },
      };
      return q;
    },
    storage: { from: (bucket) => ({
      upload: async (key, bytes) => { storage.push({ operation: 'upload', bucket, key, length: bytes.byteLength }); return { error: null }; },
      remove: async (keys) => { storage.push({ operation: 'remove', bucket, keys }); return { error: null }; },
    }) },
  };
  const context = vm.createContext({
    Request, Response, Headers, URL, File, FormData, Uint8Array, crypto: webcrypto, atob,
    console: { error: (...args) => logs.push(args) },
    Deno: { env: { get: (key) => ({
      SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: fixtureKey,
      EMAIL_INGEST_WEBHOOK_SECRET: 'synthetic-webhook-secret', INTERNAL_FUNCTION_SECRET: 'synthetic-internal-secret',
      ...options.env,
    })[key] }, serve: (value) => { handler = value; } },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      queued.push({ url, body });
      return options.queueResponse?.() ?? Response.json({ documents: body.documentIds.map((documentId) => ({ documentId, status: 'queued' })) });
    },
  });
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    if (file.startsWith('jsr:') || file.startsWith('https:')) {
      const module = new vm.SyntheticModule(file.startsWith('https:') ? ['createClient'] : [], function () {
        if (file.startsWith('https:')) this.setExport('createClient', () => admin);
      }, { context, identifier: file });
      modules.set(file, module);
      return module;
    }
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const module = new vm.SourceTextModule(compiled, { context, identifier: file });
    modules.set(file, module);
    await module.link((specifier) => load(specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : specifier));
    return module;
  }
  await (await load(path.join(root, 'inbound-email-ingest/index.ts'))).evaluate();
  return { reads, writes, storage, queued, authLookups, logs, async request(body = email, secret = 'synthetic-webhook-secret') {
    const multipart = body instanceof FormData;
    const response = await handler(new Request('https://synthetic.invalid/inbound-email-ingest', {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
      body: multipart ? body : JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  } };
}

function assertNoMedicalIo(h) {
  assert.equal(h.reads.some((read) => read.table === 'Document'), false);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.storage, []);
  assert.deepEqual(h.queued, []);
}

test('webhook authentication runs before any database or medical I/O', async () => {
  const h = await harness();
  assert.equal((await h.request(email, 'incorrect')).status, 401);
  assert.deepEqual(h.reads, []);
  assertNoMedicalIo(h);
});

for (const to of ['synthetic@untrusted.test', 'other+synthetic@gmail.com', 'test.healthfolio+synthetic+extra@gmail.com']) {
  test(`untrusted mailbox cannot route a profile alias: ${to}`, async () => {
    const h = await harness();
    assert.equal((await h.request({ ...email, to })).status, 400);
    assertNoMedicalIo(h);
  });
}

test('sender email is never an identity or alias fallback', async () => {
  const h = await harness();
  assert.equal((await h.request({ ...email, to: 'test.healthfolio+unknown@gmail.com', from: profile.email })).status, 404);
  assert.equal(h.reads.some((read) => read.filters.some((filter) => filter.key === 'email')), false);
  assertNoMedicalIo(h);
});

for (const accessOrigin of [undefined, 'unverified', 'accepted', 'managed']) {
  test(`managed/unbound alias cannot self-authorize through a family row: ${accessOrigin}`, async () => {
    const h = await harness({ tables: {
      User: [{ ...profile, authUserId: null, email: null }],
      FamilyLink: [{ id: 'forged', ownerUserId: 'attacker', memberUserId: profile.id, status: 'active', accessOrigin, permissions: { docTypes: ['other'] } }],
    } });
    assert.equal((await h.request()).status, 403);
    assertNoMedicalIo(h);
  });
}

test('deleted alias targets cannot receive or requeue health records', async () => {
  const h = await harness({ tables: { User: [{ ...profile, deletedAt: '2026-09-01' }] } });
  assert.equal((await h.request()).status, 404);
  assertNoMedicalIo(h);
});

test('an auth-bound profile needs a real matching Auth identity', async () => {
  const h = await harness({ authUsers: [] });
  assert.equal((await h.request()).status, 403);
  assertNoMedicalIo(h);
});

test('split legacy and bound profiles fail closed', async () => {
  const h = await harness({ tables: { User: [profile, { ...profile, id: authId, authUserId: null, inboundEmailAlias: 'different' }] } });
  assert.equal((await h.request()).status, 403);
  assertNoMedicalIo(h);
});

test('an id belonging to a different Auth identity cannot override a binding', async () => {
  const h = await harness({ authUsers: [{ id: authId }, { id: otherAuthId }], tables: { User: [{ ...profile, id: otherAuthId }] } });
  assert.equal((await h.request()).status, 403);
  assertNoMedicalIo(h);
});

test('multiple alias targets are rejected rather than choosing a profile', async () => {
  const h = await harness({ tables: { User: [profile, { ...profile, id: 'other-profile', inboundEmailAlias: 'other-alias' }] } });
  assert.equal((await h.request({ ...email, to: [email.to, 'test.healthfolio+other-alias@gmail.com'] })).status, 400);
  assertNoMedicalIo(h);
});

for (const UserConsent of [[], [{ ...consent, healthDataProcessingAccepted: false }], [{ ...consent, consentVersion: 'old' }]]) {
  test(`health processing consent is required before any document lookup: ${JSON.stringify(UserConsent)}`, async () => {
    const h = await harness({ tables: { UserConsent } });
    assert.equal((await h.request()).status, 403);
    assertNoMedicalIo(h);
  });
}

test('independent alias ingest preserves target, storage owner, and background OCR contract', async () => {
  const h = await harness();
  const result = await h.request();
  assert.equal(result.status, 202);
  assert.equal(result.body.status, 'processed');
  const inserted = h.writes.find((write) => write.operation === 'insert');
  assert.equal(inserted.values.ownerUserId, profile.id);
  assert.equal(inserted.values.uploadedByUserId, profile.id);
  assert.ok(h.storage[0].key.startsWith(`${authId}/email/`));
  assert.equal(h.queued[0].body.appUserId, profile.id);
  assert.equal(h.queued[0].body.wait, false);
  assert.equal(h.reads.some((read) => read.table === 'FamilyLink'), false);
});

test('legacy id-bound Auth account still requires its own consent and ingests to itself', async () => {
  const h = await harness({ tables: { User: [{ ...profile, id: authId, authUserId: null }], UserConsent: [{ ...consent, userId: authId }] } });
  assert.equal((await h.request()).status, 202);
  assert.equal(h.queued[0].body.appUserId, authId);
});

test('configured direct-alias domain works without trusting arbitrary domains', async () => {
  const h = await harness({ env: { EMAIL_INGEST_DOMAIN: 'inbound.example.test' } });
  assert.equal((await h.request({ ...email, to: 'synthetic@inbound.example.test' })).status, 202);
});

test('multipart recipients use the same authorization gate', async () => {
  const h = await harness();
  const body = new FormData();
  body.append('to', email.to);
  body.append('attachment', new File(['synthetic-only'], 'synthetic.pdf', { type: 'application/pdf' }));
  assert.equal((await h.request(body)).status, 202);
});

test('duplicate retry reuses only the selected profile document', async () => {
  const h = await harness({ tables: { Document: [{
    id: 'existing', ownerUserId: profile.id, emailIngestKey: 'message:synthetic-message', deletedAt: null,
    fileUrl: `${authId}/email/existing/attachment.pdf`, ocrStatus: 'failed', ocrQueuedAt: null, ocrStartedAt: null,
  }] } });
  const result = await h.request({ ...email, attachments: [{ ...email.attachments[0], idempotencyKey: 'synthetic-message' }] });
  assert.equal(result.status, 202);
  assert.equal(result.body.documents[0].documentId, 'existing');
  assert.equal(result.body.documents[0].created, false);
  assert.deepEqual(h.storage, []);
  assert.deepEqual(h.queued[0].body.documentIds, ['existing']);
});

test('provider errors do not expose upstream PHI or credentials', async () => {
  const h = await harness({ queueResponse: () => new Response('SENSITIVE_PROVIDER_DETAIL', { status: 500 }) });
  const result = await h.request();
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(result.body).includes('SENSITIVE_PROVIDER_DETAIL'), false);
  assert.equal(JSON.stringify(h.logs).includes('SENSITIVE_PROVIDER_DETAIL'), false);
});

test('database errors fail closed without leaking database detail', async () => {
  const h = await harness({ failTable: 'User' });
  const result = await h.request();
  assert.equal(result.status, 500);
  assert.equal(JSON.stringify(result.body).includes('SENSITIVE_DATABASE_DETAIL'), false);
  assert.equal(JSON.stringify(h.logs).includes('SENSITIVE_DATABASE_DETAIL'), false);
  assertNoMedicalIo(h);
});
