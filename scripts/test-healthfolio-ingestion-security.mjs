import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

if (!vm.SourceTextModule) {
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const root = fileURLToPath(new URL('../supabase/functions/', import.meta.url));
const authUser = { id: 'auth-self', email: 'collision@example.test' };
const self = { id: 'self', authUserId: authUser.id, name: 'Self' };

async function load(endpoint, tables = {}, permission = false) {
  const writes = [];
  const reads = [];
  let handler;
  const makeClient = scope => ({
    auth: { getUser: async () => ({ data: { user: authUser }, error: null }) },
    rpc: async () => ({ data: permission, error: null }),
    storage: { from: () => ({
      upload: async () => { writes.push({ kind: 'storageUpload' }); return { error: null }; },
      createSignedUrl: async () => ({ data: { signedUrl: 'https://test.invalid/export' }, error: null }),
    }) },
    from(table) {
      reads.push({ scope, table });
      const filters = [];
      let single = false;
      const q = {
        select() { return q; },
        eq(key, value) { filters.push(row => row[key] === value); return q; },
        is(key, value) { filters.push(row => row[key] === value); return q; },
        in(key, values) { filters.push(row => values.includes(row[key])); return q; },
        order() { return q; },
        maybeSingle() { single = true; return q; },
        update(values) { writes.push({ table, values }); return q; },
        then(resolve, reject) {
          const rows = (tables[table] ?? []).filter(row => filters.every(f => f(row)));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  });
  const client = makeClient('admin');
  const scoped = makeClient('caller');
  const context = vm.createContext({
    Request, Response, Headers, URL, console,
    Deno: { env: { get: () => 'test-only' }, serve(value) { handler = value; } },
  });
  const modules = new Map();
  async function moduleAt(file) {
    if (modules.has(file)) return modules.get(file);
    if (/^(https:|jsr:)/.test(file)) {
      const exports = file.includes('pdf-lib') ? ['PDFDocument', 'rgb', 'StandardFonts'] : file.startsWith('https:') ? ['createClient'] : [];
      const module = new vm.SyntheticModule(exports, function () {
        for (const key of exports) {
          if (key === 'createClient') this.setExport(key, (_url, _key, options) => options.global?.headers?.Authorization === 'Bearer test' ? scoped : client);
          else if (key === 'PDFDocument') this.setExport(key, { create: async () => ({
            embedFont: async () => ({ widthOfTextAtSize: () => 10 }),
            addPage: () => ({ drawText() {}, drawLine() {} }),
            save: async () => new Uint8Array([1]),
          }) });
          else if (key === 'rgb') this.setExport(key, () => ({}));
          else this.setExport(key, {});
        }
      }, { context, identifier: file });
      modules.set(file, module);
      return module;
    }
    let source = readFileSync(file, 'utf8');
    if (file === path.join(root, endpoint, 'index.ts')) {
      const names = endpoint === 'process-document-ocr'
        ? 'getAuthenticatedAppUser, loadAuthorizedDocuments, resolveDocumentOwnerFromPatientName'
        : 'getAuthenticatedAppUser, assertProfileAccess';
      source += `\nexport { ${names} };\n`;
    }
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const module = new vm.SourceTextModule(compiled, { context, identifier: file });
    modules.set(file, module);
    await module.link(specifier => moduleAt(specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : specifier));
    return module;
  }
  const entry = await moduleAt(path.join(root, endpoint, 'index.ts'));
  await entry.evaluate();
  return { api: entry.namespace, client, writes, reads, request: body => handler(new Request('https://test.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })) };
}

for (const endpoint of ['process-document-ocr', 'export-health-summary']) {
  for (const authUserId of [null, '', 'other-auth']) {
    test(`${endpoint}: handler rejects split bound and legacy identities (${JSON.stringify(authUserId)})`, async () => {
      const h = await load(endpoint, { User: [self, { id: authUser.id, authUserId }] });
      const result = await h.request({ documentId: 'doc' });
      assert.equal(result.status, 403);
      assert.equal(h.reads.every(read => read.table === 'User'), true, 'identity rejection must precede health-data access');
      assert.deepEqual(h.writes, []);
    });
  }
  test(`${endpoint}: handler rejects an empty non-null legacy binding`, async () => {
    const h = await load(endpoint, { User: [{ id: authUser.id, authUserId: '' }] });
    assert.equal((await h.request({ documentId: 'doc' })).status, 403);
    assert.equal(h.reads.every(read => read.table === 'User'), true);
    assert.deepEqual(h.writes, []);
  });
  for (const authUserId of [null, authUser.id]) {
    test(`${endpoint}: legacy or same-row identity remains valid (${JSON.stringify(authUserId)})`, async () => {
      const h = await load(endpoint, { User: [{ ...self, id: authUser.id, authUserId }] });
      const result = await h.api.getAuthenticatedAppUser(h.client, new Request('https://test.invalid', { headers: { Authorization: 'Bearer test' } }));
      assert.equal((result.appUser ?? result).id, authUser.id);
      assert.deepEqual(h.writes, []);
    });
  }
  test(`${endpoint}: deleted profiles cannot use still-valid auth sessions`, async () => {
    const h = await load(endpoint, { User: [{ ...self, deletedAt: '2026-09-01T00:00:00Z' }] });
    await assert.rejects(h.api.getAuthenticatedAppUser(h.client, new Request('https://test.invalid', { headers: { Authorization: 'Bearer test' } })), error => error.status === 403);
    assert.deepEqual(h.writes, []);
  });
  test(`${endpoint}: email collisions cannot authenticate as another profile`, async () => {
    const h = await load(endpoint, { User: [{ id: 'victim', email: authUser.email, authUserId: 'other-auth' }] });
    await assert.rejects(h.api.getAuthenticatedAppUser(h.client, new Request('https://test.invalid', { headers: { Authorization: 'Bearer test' } })), error => error.status === 404);
    assert.deepEqual(h.writes, []);
  });
  test(`${endpoint}: legacy ID cannot override a conflicting auth binding`, async () => {
    const h = await load(endpoint, { User: [{ id: authUser.id, authUserId: 'other-auth' }] });
    await assert.rejects(h.api.getAuthenticatedAppUser(h.client, new Request('https://test.invalid', { headers: { Authorization: 'Bearer test' } })), error => error.status === 403);
  });
  test(`${endpoint}: valid auth binding resolves without database writes`, async () => {
    const h = await load(endpoint, { User: [self] });
    const result = await h.api.getAuthenticatedAppUser(h.client, new Request('https://test.invalid', { headers: { Authorization: 'Bearer test' } }));
    assert.equal((result.appUser ?? result).id, 'self');
    assert.deepEqual(h.writes, []);
  });
}

test('OCR cannot process a former upload after profile access is revoked', async () => {
  const h = await load('process-document-ocr', { Document: [{ id: 'doc', ownerUserId: 'victim', uploadedByUserId: 'self', fileUrl: 'storage://medical-documents/test', deletedAt: null }] });
  await assert.rejects(h.api.loadAuthorizedDocuments(h.client, self, ['doc']), error => error.status === 403);
});

test('OCR names never move an explicitly targeted upload to another profile', async () => {
  const selected = { id: 'selected', name: 'Selected', authUserId: null };
  const other = { id: 'other', name: 'Other Person', authUserId: null };
  const h = await load('process-document-ocr', {
    User: [self, selected, other],
    FamilyLink: [{ ownerUserId: self.id, memberUserId: 'selected', status: 'active' }, { ownerUserId: self.id, memberUserId: 'other', status: 'active' }],
  });
  const result = await h.api.resolveDocumentOwnerFromPatientName(h.client, self, { id: 'doc', ownerUserId: 'selected' }, 'Other Person');
  assert.equal(result.document.ownerUserId, 'selected');
  assert.deepEqual(h.writes, []);
});

test('summary export ignores forged family rows when caller RLS denies access', async () => {
  const h = await load('export-health-summary', { FamilyLink: [{ id: 'forged', ownerUserId: 'victim', memberUserId: 'self', status: 'active' }] });
  await assert.rejects(h.api.assertProfileAccess(h.client, 'self', 'victim'), error => error.status === 403);
});

test('summary export reads health data under the caller JWT, never service-role RLS bypass', async () => {
  const h = await load('export-health-summary', { User: [{ ...self, name: 'Synthetic', dob: null, sex: null, bloodGroup: null }] });
  const result = await h.request({});
  assert.equal(result.status, 200, await result.text());
  assert.deepEqual(h.reads.filter(read => read.table === 'ParameterReading'), [{ scope: 'caller', table: 'ParameterReading' }]);
  assert.deepEqual(h.reads.filter(read => read.table === 'User').slice(-1), [{ scope: 'caller', table: 'User' }]);
});

test('OCR excludes soft-deleted documents before queueing', async () => {
  const h = await load('process-document-ocr', { Document: [{ id: 'doc', ownerUserId: self.id, fileUrl: 'storage://medical-documents/test', deletedAt: '2026-09-01' }] });
  await assert.rejects(h.api.loadAuthorizedDocuments(h.client, self, ['doc']), error => error.status === 404);
});
