import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

if (!vm.SourceTextModule) {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(child.status ?? 1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const self = { id: 'self', authUserId: 'auth-self', email: 'self@example.test', phone: null };
const member = { id: 'member', authUserId: null, email: null, phone: null };
const other = { id: 'other', authUserId: 'auth-other', email: 'other@example.test', phone: null };
const acceptedAt = '2026-09-14T00:00:00Z';
const fullDocTypes = ['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'vaccination_record', 'other'];
const grant = (overrides = {}) => ({
  id: 'grant', ownerUserId: 'self', memberUserId: 'member', status: 'active',
  accessOrigin: 'managed', acceptedAt, revokedAt: null, inviteToken: null,
  role: 'guardian', permissions: { docTypes: [...fullDocTypes] }, ...overrides,
});
const document = (owner = 'member', uploader = 'self') => ({
  id: 'document', ownerUserId: owner, uploadedByUserId: uploader,
  fileUrl: `${uploader === 'self' ? 'auth-self' : uploader}/documents/document/report.pdf`,
});

// Run the actual Edge Function and local helpers. Only Supabase/Auth/Storage I/O is replaced.
async function harness(options = {}) {
  const tables = structuredClone({
    User: [self, member, other], FamilyLink: [grant()],
    Document: [document()],
    ParameterReading: [{ id: 'reading', userId: 'member', documentId: 'document', createdByUserId: 'self' }],
    AuditLog: [], OtpCode: [], Export: [], ...options.tables,
  });
  const writes = [], queries = [], authDeletes = [], handlers = [];
  const files = new Map(tables.Document.filter((row) => row.fileUrl).map((row) => [row.fileUrl, `contents:${row.id}`]));
  const admin = {
    auth: {
      getUser: async (token) => ({ data: { user: token === 'valid' ? { id: 'auth-self', email: self.email } : null }, error: null }),
      admin: {
        signOut: async () => { writes.push({ kind: 'signOut' }); return { error: null }; },
        deleteUser: async (id) => { authDeletes.push(id); writes.push({ kind: 'authDelete', id }); return { error: null }; },
      },
    },
    rpc: async (name, args) => {
      assert.equal(name, 'profile_has_auth_identity');
      queries.push({ table: name, args });
      if (options.rpcError) return { data: null, error: { code: 'PGRST202', message: 'identity RPC unavailable' } };
      if (Object.hasOwn(options, 'rpcResult')) return { data: options.rpcResult, error: null };
      return { data: (options.authIdentityIds ?? []).includes(args.p_user_id), error: null };
    },
    from(table) {
      const filters = [];
      let columns = '*', operation = 'select', changes, single = false, countRequested = false;
      const query = {
        select(value, config) { columns = value; countRequested = config?.count === 'exact'; return query; },
        eq(key, value) { filters.push((row) => row[key] === value); return query; },
        neq(key, value) { filters.push((row) => row[key] !== value); return query; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
        is(key, value) { filters.push((row) => row[key] === value); return query; },
        not(key, operator, value) { assert.equal(operator, 'is'); filters.push((row) => row[key] !== value); return query; },
        maybeSingle() { single = true; return query; },
        update(value) { operation = 'update'; changes = value; return query; },
        delete() { operation = 'delete'; return query; },
        then(resolve, reject) {
          queries.push({ table, operation, columns });
          if (options.preMigration && table === 'FamilyLink' && columns.includes('accessOrigin')) {
            return Promise.resolve({ data: null, error: { code: '42703', message: 'accessOrigin does not exist' }, count: null }).then(resolve, reject);
          }
          if (options.failTable === table) {
            return Promise.resolve({ data: null, error: new Error('lookup failed'), count: null }).then(resolve, reject);
          }
          const rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
          if (operation !== 'select') {
            writes.push({ kind: operation, table, ids: rows.map((row) => row.id), changes });
            if (operation === 'update') rows.forEach((row) => Object.assign(row, changes));
            else {
              tables[table] = tables[table].filter((row) => !rows.includes(row));
              if (table === 'User') {
                const ids = rows.map((row) => row.id);
                // The real schema cascades both ownership and uploader/creator foreign keys.
                const deletedDocs = tables.Document.filter((row) => ids.includes(row.ownerUserId) || ids.includes(row.uploadedByUserId));
                tables.Document = tables.Document.filter((row) => !deletedDocs.includes(row));
                tables.ParameterReading = tables.ParameterReading.filter((row) => !ids.includes(row.userId)
                  && !ids.includes(row.createdByUserId) && !deletedDocs.some((doc) => doc.id === row.documentId));
              }
            }
          }
          let data = rows.map((row) => columns === '*' ? { ...row }
            : Object.fromEntries(columns.split(',').map((column) => column.trim()).map((column) => [column, row[column]])));
          const count = countRequested ? data.length : null;
          if (options.truncateTable === table && !single) data = data.slice(0, 1);
          return Promise.resolve({ data: single ? data[0] ?? null : data, error: null, count }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: {
      from(bucket) {
        return {
          list: async (prefix, config = {}) => {
            if (bucket !== 'medical-documents') return { data: [], error: null };
            const names = new Map();
            for (const file of files.keys()) {
              if (!file.startsWith(`${prefix}/`)) continue;
              const rest = file.slice(prefix.length + 1), [name] = rest.split('/');
              if (config.search && name !== config.search) continue;
              names.set(name, { name, id: rest.includes('/') ? null : file });
            }
            return { data: [...names.values()], error: null };
          },
          move: async (from, to) => {
            writes.push({ kind: 'move', from, to });
            if (!files.has(from)) return { error: new Error('missing source') };
            files.set(to, files.get(from)); files.delete(from);
            return { error: null };
          },
          remove: async (paths) => {
            writes.push({ kind: 'remove', bucket, paths });
            if (bucket === 'medical-documents') paths.forEach((file) => files.delete(file));
            return { error: null };
          },
        };
      },
    },
  };
  const context = vm.createContext({
    Request, Response, Headers, URL, Error,
    Deno: {
      env: { get: (key) => ({ SUPABASE_URL: 'https://local.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only' })[key] },
      serve: (handler) => handlers.push(handler),
    },
    fetch: () => { throw new Error('Network access is forbidden in account-deletion tests'); },
  });
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    if (file.startsWith('https:') || file.startsWith('jsr:')) {
      const module = new vm.SyntheticModule(file.startsWith('https:') ? ['createClient'] : [], function () {
        if (file.startsWith('https:')) this.setExport('createClient', () => admin);
      }, { context, identifier: file });
      modules.set(file, module);
      return module;
    }
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: file,
    });
    const module = new vm.SourceTextModule(outputText, { context, identifier: file });
    modules.set(file, module);
    await module.link((specifier) => load(specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : specifier));
    return module;
  }
  await (await load(path.join(root, 'supabase/functions/delete-account/index.ts'))).evaluate();
  return {
    tables, files, writes, authDeletes, queries,
    async request(token = 'valid') {
      const response = await handlers[0](new Request('https://local.invalid/delete-account', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test('pending outgoing invitation cannot delete or mutate another owner\'s managed profile', async () => {
  const victimDocument = document('member', 'other');
  const h = await harness({ tables: {
    FamilyLink: [grant({ status: 'pending', accessOrigin: 'unverified', acceptedAt: null, inviteToken: 'attacker-token' }),
      grant({ id: 'real-owner-grant', ownerUserId: 'other' })],
    Document: [victimDocument],
    ParameterReading: [{ id: 'reading', userId: 'member', documentId: 'document', createdByUserId: 'other' }],
  } });
  assert.equal((await h.request()).status, 200);
  assert.ok(h.tables.User.some((row) => row.id === 'member'), 'the victim User must survive account deletion');
  assert.deepEqual(h.tables.Document, [victimDocument]);
  assert.equal(h.tables.ParameterReading.length, 1);
  assert.equal(h.files.get(victimDocument.fileUrl), 'contents:document');
  assert.equal(h.writes.some((write) => write.kind === 'move'), false);
  assert.deepEqual(h.authDeletes, ['auth-self']);
});

test('exclusive trusted managed profile still deletes with its owning account', async () => {
  const h = await harness();
  assert.equal((await h.request()).status, 200);
  assert.deepEqual(h.tables.User.map((row) => row.id), ['other']);
  assert.deepEqual(h.tables.Document, []);
  assert.deepEqual(h.tables.ParameterReading, []);
  assert.equal(h.files.size, 0);
});

for (const permissions of [
  { docTypes: ['lab_report'] }, { docTypes: [] },
  undefined, null, {}, [], 'all', { docTypes: 'all' },
  { docTypes: [...fullDocTypes, null] }, { docTypes: [...fullDocTypes, 'unknown'] },
]) {
  test(`restricted or malformed scope stops deletion before all mutations: ${JSON.stringify(permissions)}`, async () => {
    const excludedDocument = { ...document(), docType: 'prescription' };
    const h = await harness({ tables: {
      FamilyLink: [grant({ permissions })], Document: [excludedDocument],
    } });
    const before = structuredClone(h.tables);
    assert.equal((await h.request()).status, 503);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.authDeletes, []);
    assert.deepEqual(h.tables, before);
    assert.equal(h.files.get(excludedDocument.fileUrl), 'contents:document');
  });
}

for (const link of [
  grant({ accessOrigin: 'accepted', permissions: { docTypes: ['lab_report'] } }),
  grant({ status: 'revoked', revokedAt: acceptedAt, permissions: { docTypes: ['lab_report'] } }),
]) {
  test(`restricted ${link.accessOrigin}/${link.status} scope cannot migrate excluded data instead of deleting it`, async () => {
    const excludedDocument = { ...document(), docType: 'prescription' };
    const h = await harness({ tables: { FamilyLink: [link], Document: [excludedDocument] } });
    const before = structuredClone(h.tables);
    assert.equal((await h.request()).status, 503);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.authDeletes, []);
    assert.deepEqual(h.tables, before);
    assert.equal(h.files.get(excludedDocument.fileUrl), 'contents:document');
  });
}

test('full managed authority is independent of document-type ordering', async () => {
  const h = await harness({ tables: { FamilyLink: [grant({ permissions: { docTypes: [...fullDocTypes].reverse() } })] } });
  assert.equal((await h.request()).status, 200);
  assert.deepEqual(h.tables.User.map((row) => row.id), ['other']);
  assert.deepEqual(h.tables.Document, []);
  assert.deepEqual(h.authDeletes, ['auth-self']);
});

for (const link of [grant({ accessOrigin: 'accepted' }), grant({ status: 'revoked', accessOrigin: 'accepted', revokedAt: acceptedAt }),
  grant({ status: 'revoked', revokedAt: acceptedAt })]) {
  test(`${link.accessOrigin} identity is preserved even with nullable identity fields (${link.status})`, async () => {
    const h = await harness({ tables: { FamilyLink: [link] } });
    assert.equal((await h.request()).status, 200);
    assert.ok(h.tables.User.some((row) => row.id === 'member'));
    assert.equal(h.tables.Document[0]?.uploadedByUserId, 'member');
    assert.equal(h.tables.ParameterReading[0]?.createdByUserId, 'member');
    assert.equal(h.files.get('member/documents/document/report.pdf'), 'contents:document');
  });
}

for (const extra of [grant({ id: 'shared', ownerUserId: 'other' }),
  grant({ id: 'reverse-share', ownerUserId: 'member', memberUserId: 'other', accessOrigin: 'accepted' })]) {
  test(`managed profile shared through ${extra.id} survives, including its files and readings`, async () => {
    const h = await harness({ tables: { FamilyLink: [grant(), extra] } });
    assert.equal((await h.request()).status, 200);
    assert.ok(h.tables.User.some((row) => row.id === 'member'));
    assert.equal(h.tables.Document.length, 1);
    assert.equal(h.tables.ParameterReading.length, 1);
    assert.equal(h.files.get('member/documents/document/report.pdf'), 'contents:document');
  });
}

test('legacy Auth identity remains protected when authUserId, email and phone are null', async () => {
  const h = await harness({ authIdentityIds: ['member'] });
  assert.equal((await h.request()).status, 200);
  assert.ok(h.tables.User.some((row) => row.id === 'member'));
  assert.equal(h.tables.Document.length, 1);
  assert.equal(h.tables.ParameterReading.length, 1);
});

for (const identity of [{ authUserId: 'auth-member' }, { email: 'member@example.test' }, { phone: '+15550001234' }, { email: '' }]) {
  test(`managed provenance cannot delete a profile with an identity field: ${JSON.stringify(identity)}`, async () => {
    const h = await harness({ tables: { User: [self, { ...member, ...identity }, other] } });
    assert.equal((await h.request()).status, 200);
    assert.ok(h.tables.User.some((row) => row.id === 'member'));
    assert.equal(h.tables.Document[0]?.uploadedByUserId, 'member');
    assert.equal(h.tables.ParameterReading[0]?.createdByUserId, 'member');
    assert.equal(h.files.get('member/documents/document/report.pdf'), 'contents:document');
    assert.deepEqual(h.authDeletes, ['auth-self']);
  });
}

test('another caller\'s pending invitation does not establish shared ownership', async () => {
  const h = await harness({ tables: { FamilyLink: [grant(), grant({
    id: 'pending-other', ownerUserId: 'other', accessOrigin: 'unverified', status: 'pending',
    acceptedAt: null, inviteToken: 'other-token',
  })] } });
  assert.equal((await h.request()).status, 200);
  assert.deepEqual(h.tables.User.map((row) => row.id), ['other']);
});

for (const options of [{ preMigration: true }, { rpcError: true }, { rpcResult: null },
  { failTable: 'FamilyLink' }, { failTable: 'User' },
  { rpcResult: 'false' },
  { tables: { FamilyLink: [grant({ status: 'pending_verification', accessOrigin: 'unverified' })] } },
  { tables: { FamilyLink: [grant({ accessOrigin: 'unverified' })] } },
  { tables: { FamilyLink: [grant({ acceptedAt: null })] } },
  { tables: { FamilyLink: [grant({ inviteToken: 'not-consumed' })] } },
  { tables: { User: [self, { ...member, authUserId: undefined }, other] } },
  { tables: { FamilyLink: [grant({ memberUserId: 'missing-member' })] } },
  { truncateTable: 'FamilyLink', tables: { FamilyLink: [grant(), grant({ id: 'shared', ownerUserId: 'other' })] } },
  { truncateTable: 'FamilyLink', tables: { FamilyLink: [grant(), grant({ id: 'second', memberUserId: 'other' })] } },
  { truncateTable: 'User', tables: { FamilyLink: [grant(), grant({ id: 'second', memberUserId: 'other', accessOrigin: 'accepted' })] } }]) {
  test(`uncertain provenance stops all destructive work: ${JSON.stringify(options)}`, async () => {
    const h = await harness(options);
    assert.ok((await h.request()).status >= 400);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.authDeletes, []);
    assert.equal(h.tables.User.length, 3);
    assert.equal(h.tables.Document.length, 1);
    assert.equal(h.files.size, 1);
  });
}

test('invalid bearer token cannot reach account or storage deletion', async () => {
  const h = await harness();
  assert.equal((await h.request('invalid')).status, 401);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.queries, []);
});

for (const authUserId of [null, '', 'auth-victim']) {
  test(`split bound and legacy identities stop deletion before all mutations (${JSON.stringify(authUserId)})`, async () => {
    const h = await harness({ tables: {
      User: [self, { ...member, id: 'auth-self', authUserId }, other], FamilyLink: [],
      Document: [document('self', 'self')],
      ParameterReading: [{ id: 'reading', userId: 'self', documentId: 'document', createdByUserId: 'self' }],
    } });
    const before = structuredClone(h.tables);
    assert.equal((await h.request()).status, 403);
    assert.equal(h.queries.every(query => query.table === 'User'), true);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.authDeletes, []);
    assert.deepEqual(h.tables, before);
    assert.equal(h.files.size, 1);
  });
}

for (const authUserId of [null, 'auth-victim']) {
  test(`email collision never selects or implicitly binds a deletion target (${authUserId})`, async () => {
    const victim = { ...member, email: self.email, authUserId };
    const victimDocument = document('member', 'member');
    const victimReading = { id: 'reading', userId: 'member', documentId: 'document', createdByUserId: 'member' };
    const h = await harness({ tables: {
      User: [victim, other], FamilyLink: [], Document: [victimDocument], ParameterReading: [victimReading],
    } });
    assert.equal((await h.request()).status, 200);
    assert.deepEqual(h.tables.User, [victim, other]);
    assert.deepEqual(h.tables.Document, [victimDocument]);
    assert.deepEqual(h.tables.ParameterReading, [victimReading]);
    assert.equal(h.files.get(victimDocument.fileUrl), 'contents:document');
    assert.equal(h.writes.some((write) => write.table === 'User' || write.kind === 'move' || write.kind === 'remove'), false);
    assert.deepEqual(h.authDeletes, ['auth-self']);
  });
}

for (const authUserId of ['auth-victim', '']) {
  test(`legacy ID with a conflicting non-null binding fails closed (${JSON.stringify(authUserId)})`, async () => {
    const h = await harness({ tables: { User: [{ ...member, id: 'auth-self', authUserId }, other], FamilyLink: [] } });
    assert.equal((await h.request()).status, 403);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.authDeletes, []);
    assert.equal(h.tables.User.length, 2);
  });
}

for (const authUserId of [null, 'auth-self']) {
  test(`legacy ID with a null or matching binding may delete its own account (${authUserId})`, async () => {
    const h = await harness({ tables: {
      User: [{ ...member, id: 'auth-self', authUserId }, other], FamilyLink: [],
      Document: [document('auth-self', 'auth-self')],
      ParameterReading: [{ id: 'reading', userId: 'auth-self', documentId: 'document', createdByUserId: 'auth-self' }],
    } });
    assert.equal((await h.request()).status, 200);
    assert.deepEqual(h.tables.User, [other]);
    assert.deepEqual(h.tables.Document, []);
    assert.deepEqual(h.tables.ParameterReading, []);
    assert.equal(h.files.size, 0);
    assert.deepEqual(h.authDeletes, ['auth-self']);
    assert.equal(h.writes.some((write) => write.table === 'User' && write.kind === 'update'), false);
  });
}
