import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { runDeletionSmoke } from './smoke-test-account-deletion.mjs';

const deletedJwtMigration = readFileSync(
  new URL('../supabase/migrations/20260712160021_reject_deleted_auth_jwts.sql', import.meta.url),
  'utf8',
);
const directInsertMigration = readFileSync(
  new URL('../supabase/migrations/20260712161011_revoke_direct_user_inserts.sql', import.meta.url),
  'utf8',
);

test('profile upsert rejects a JWT after its auth user is deleted', () => {
  assert.match(deletedJwtMigration, /FROM auth\.users/i);
  assert.match(deletedJwtMigration, /account_deleted/i);
});

test('authenticated clients cannot insert app users directly', () => {
  assert.match(directInsertMigration, /DROP POLICY IF EXISTS user_insert_own/i);
});

test('deletion smoke seeds data, deletes the account, and returns no credentials', async () => {
  const calls = [];
  let deleted = false;
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    const contentType = init.headers?.['Content-Type'] ?? init.headers?.['content-type'] ?? '';
    const body = init.body
      ? contentType.includes('application/json')
        ? JSON.parse(init.body)
        : init.body
      : null;
    calls.push({ url, init, body });

    if (url.pathname === '/auth/v1/signup') {
      return json(200, {
        access_token: 'smoke-access-token',
        refresh_token: 'smoke-refresh-token',
        user: { id: 'auth-user-1', email: body.email },
      });
    }
    if (url.pathname === '/rest/v1/rpc/upsert_app_user_profile') {
      return deleted
        ? json(403, { code: 'account_deleted', message: 'Auth user no longer exists.' })
        : json(200, null);
    }
    if (url.pathname === '/rest/v1/User' && init.method === 'POST' && deleted) {
      return json(403, { message: 'new row violates row-level security policy' });
    }
    if (url.pathname === '/rest/v1/User' && init.method === 'GET') {
      return json(200, deleted ? [] : [{ id: 'app-user-1', authUserId: 'auth-user-1' }]);
    }
    if (url.pathname === '/rest/v1/UserConsent') {
      return json(201, [{ consentVersion: '2026-07-10' }]);
    }
    if (url.pathname === '/rest/v1/rpc/create_managed_profile') {
      return json(200, 'managed-user-1');
    }
    if (url.pathname === '/rest/v1/ParameterCatalog') {
      return json(200, [{ id: 'parameter-1' }]);
    }
    if (url.pathname === '/rest/v1/Document') return json(201, [{ id: 'document-1' }]);
    if (url.pathname === '/rest/v1/ParameterReading') {
      return json(201, [{ id: 'reading-1' }]);
    }
    if (url.pathname === '/rest/v1/DoctorShare') return json(201, [{ id: 'share-1' }]);
    if (url.pathname === '/rest/v1/Export') return json(201, [{ id: 'export-1' }]);
    if (url.pathname.includes('/stale-jwt-probe.pdf')) {
      return json(403, { message: 'new row violates row-level security policy' });
    }
    if (url.pathname.startsWith('/storage/v1/object/medical-documents/')) {
      return json(200, { Key: url.pathname });
    }
    if (url.pathname.startsWith('/storage/v1/object/exports/')) {
      return json(200, { Key: url.pathname });
    }
    if (url.pathname === '/functions/v1/delete-account') {
      deleted = true;
      return json(200, { ok: true });
    }
    if (url.pathname === '/auth/v1/token') {
      return json(400, { code: 'invalid_credentials', message: 'Invalid login credentials' });
    }

    return json(500, { error: `Unexpected test request: ${url.pathname}` });
  };

  const result = await runDeletionSmoke({
    fetchImpl,
    publishableKey: 'publishable-test-key',
    runId: 'test-run',
    supabaseUrl: 'https://example.supabase.co',
  });

  assert.equal(result.deleted, true);
  assert.equal(result.reauthenticationRejected, true);
  assert.deepEqual(result.seeded, [
    'managed-profile',
    'document',
    'reading',
    'doctor-share',
    'export',
    'storage-object',
    'export-storage-object',
  ]);
  assert.equal(result.staleJwtRestDenied, true);
  assert.equal(result.staleJwtStorageDenied, true);
  assert.doesNotMatch(JSON.stringify(result), /smoke-access-token|publishable-test-key|password/i);

  const deleteCall = calls.find(({ url }) => url.pathname === '/functions/v1/delete-account');
  assert.equal(deleteCall?.init.headers.Authorization, 'Bearer smoke-access-token');

  assert.equal(
    calls.filter(({ url }) => url.pathname === '/rest/v1/rpc/upsert_app_user_profile').length,
    2,
    'The stale JWT probe must attempt a write-capable profile upsert after deletion',
  );
  assert.equal(
    calls.filter(
      ({ url, init }) => url.pathname === '/rest/v1/User' && init.method === 'POST',
    ).length,
    1,
    'The stale JWT probe must attempt a direct app-user insert after deletion',
  );

  const storageCall = calls.find(({ url }) =>
    url.pathname.startsWith('/storage/v1/object/medical-documents/'),
  );
  assert.match(storageCall?.url.pathname ?? '', /\.pdf$/);
  assert.equal(storageCall?.init.headers['Content-Type'], 'application/pdf');
});

test('fallback cleanup preserves the auth identity when app-data cleanup fails', async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });

    if (url.pathname === '/auth/v1/signup') {
      return json(200, {
        access_token: 'smoke-access-token',
        user: { id: 'auth-user-1', email: 'synthetic@example.com' },
      });
    }
    if (url.pathname === '/rest/v1/rpc/upsert_app_user_profile') return json(200, null);
    if (url.pathname === '/rest/v1/User' && init.method === 'GET') {
      return json(200, [{ id: 'app-user-1', authUserId: 'auth-user-1' }]);
    }
    if (url.pathname === '/rest/v1/UserConsent') return json(201, [{ id: 'consent-1' }]);
    if (url.pathname === '/rest/v1/rpc/create_managed_profile') {
      return json(200, 'managed-user-1');
    }
    if (url.pathname === '/rest/v1/ParameterCatalog') {
      return json(200, [{ id: 'parameter-1', unit: 'mg/dL' }]);
    }
    if (url.pathname.startsWith('/storage/v1/object/') && init.method === 'POST') {
      return json(200, { Key: url.pathname });
    }
    if (url.pathname === '/rest/v1/Document' && init.method === 'POST') {
      return json(500, { error: 'synthetic seed failure' });
    }
    if (url.pathname === '/functions/v1/delete-account') {
      return json(500, { error: 'synthetic cleanup failure' });
    }
    if (url.pathname.startsWith('/storage/v1/object/') && init.method === 'DELETE') {
      return json(200, []);
    }
    if (url.pathname === '/rest/v1/OtpCode' && init.method === 'DELETE') return empty();
    if (url.pathname === '/rest/v1/AuditLog' && init.method === 'DELETE') {
      return json(500, { error: 'synthetic audit cleanup failure' });
    }
    if (url.pathname === '/rest/v1/User' && init.method === 'DELETE') return empty();
    if (url.pathname.startsWith('/auth/v1/admin/users/') && init.method === 'DELETE') {
      return json(200, {});
    }

    return json(500, { error: `Unexpected test request: ${url.pathname}` });
  };

  await assert.rejects(
    runDeletionSmoke({
      fetchImpl,
      publishableKey: 'publishable-test-key',
      runId: 'cleanup-failure',
      serviceRoleKey: 'service-role-test-key',
      supabaseUrl: 'https://example.supabase.co',
    }),
  );

  assert.equal(
    calls.some(
      ({ url, init }) =>
        url.pathname.startsWith('/auth/v1/admin/users/') && init.method === 'DELETE',
    ),
    false,
    'Auth identity must remain available when app-data cleanup did not complete',
  );
});

test('signup without a session still removes the synthetic auth identity', async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });

    if (url.pathname === '/auth/v1/signup') {
      return json(200, { user: { id: 'auth-user-without-session' } });
    }
    if (url.pathname === '/rest/v1/User' && init.method === 'GET') return json(200, []);
    if (url.pathname === '/rest/v1/OtpCode' && init.method === 'DELETE') return empty();
    if (url.pathname.startsWith('/auth/v1/admin/users/') && init.method === 'DELETE') {
      return json(200, {});
    }

    return json(500, { error: `Unexpected test request: ${url.pathname}` });
  };

  await assert.rejects(
    runDeletionSmoke({
      fetchImpl,
      publishableKey: 'publishable-test-key',
      runId: 'signup-without-session',
      serviceRoleKey: 'service-role-test-key',
      supabaseUrl: 'https://example.supabase.co',
    }),
    /Signup did not return an authenticated session/,
  );

  assert.equal(
    calls.some(
      ({ url, init }) =>
        url.pathname === '/auth/v1/admin/users/auth-user-without-session' &&
        init.method === 'DELETE',
    ),
    true,
    'A synthetic Auth user must not remain when signup omits an access token',
  );
});

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function empty(status = 204) {
  return new Response(null, { status });
}
