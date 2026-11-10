#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONSENT_VERSION = '2026-07-10';
const SEEDED_KINDS = [
  'managed-profile',
  'document',
  'reading',
  'doctor-share',
  'export',
  'storage-object',
  'export-storage-object',
];

export async function runDeletionSmoke({
  fetchImpl = fetch,
  publishableKey,
  runId = `${Date.now()}-${randomUUID().slice(0, 8)}`,
  serviceRoleKey,
  supabaseUrl,
}) {
  invariant(supabaseUrl, 'A Supabase URL is required.');
  invariant(publishableKey, 'A Supabase publishable key is required.');

  const baseUrl = supabaseUrl.replace(/\/+$/, '');
  const email = `healthfolio-delete-${runId}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const now = new Date();
  const ids = {
    audit: randomUUID(),
    document: randomUUID(),
    export: randomUUID(),
    reading: randomUUID(),
    share: randomUUID(),
    shareAccess: randomUUID(),
  };
  let accessToken;
  let appUserId;
  let authUserId;
  let exportStoragePath;
  let managedProfileId;
  let storagePath;
  let verifiedDeleted = false;

  try {
    const signup = await requestJson(fetchImpl, baseUrl, '/auth/v1/signup', {
      apiKey: publishableKey,
      body: { email, password },
      method: 'POST',
    });
    accessToken = signup?.access_token;
    authUserId = signup?.user?.id;
    invariant(accessToken && authUserId, 'Signup did not return an authenticated session.');

    await requestJson(fetchImpl, baseUrl, '/rest/v1/rpc/upsert_app_user_profile', {
      accessToken,
      apiKey: publishableKey,
      body: {
        p_blood_group: null,
        p_dob: '1990-01-01T00:00:00.000Z',
        p_has_blood_group: false,
        p_name: `Synthetic Delete ${runId}`,
        p_sex: 'other',
        p_units_preference: 'metric',
      },
      method: 'POST',
    });

    const appUsers = await requestJson(
      fetchImpl,
      baseUrl,
      restPath('User', {
        select: 'id,authUserId',
        authUserId: `eq.${authUserId}`,
        limit: '1',
      }),
      { accessToken, apiKey: publishableKey, method: 'GET' },
    );
    appUserId = appUsers?.[0]?.id;
    invariant(appUserId, 'App user profile was not created.');

    await requestJson(
      fetchImpl,
      baseUrl,
      restPath('UserConsent', {
        on_conflict: 'userId,consentVersion',
        select: 'consentVersion',
      }),
      {
        accessToken,
        apiKey: publishableKey,
        body: {
          consentVersion: CONSENT_VERSION,
          eulaType: 'apple_standard',
          healthDataProcessingAccepted: true,
          privacyPolicyVersion: CONSENT_VERSION,
          source: 'ios_email',
          userId: appUserId,
        },
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=representation',
      },
    );

    managedProfileId = await requestJson(
      fetchImpl,
      baseUrl,
      '/rest/v1/rpc/create_managed_profile',
      {
        accessToken,
        apiKey: publishableKey,
        body: {
          p_blood_group: null,
          p_dob: '2010-01-01T00:00:00.000Z',
          p_name: `Synthetic Family ${runId}`,
          p_residency_region: 'US',
          p_sex: 'other',
          p_units_preference: 'metric',
        },
        method: 'POST',
      },
    );
    invariant(typeof managedProfileId === 'string', 'Managed profile was not created.');

    const parameters = await requestJson(
      fetchImpl,
      baseUrl,
      restPath('ParameterCatalog', { select: 'id,unit', limit: '1' }),
      { accessToken, apiKey: publishableKey, method: 'GET' },
    );
    const parameter = parameters?.[0];
    invariant(parameter?.id, 'No parameter catalog row was available for the smoke test.');

    storagePath = `${authUserId}/documents/${ids.document}/synthetic-delete-smoke.pdf`;
    await requestRaw(
      fetchImpl,
      baseUrl,
      `/storage/v1/object/medical-documents/${storagePath}`,
      {
        accessToken,
        apiKey: publishableKey,
        body: `%PDF-1.4\n% Synthetic HealthFolio deletion smoke ${runId}\n%%EOF\n`,
        contentType: 'application/pdf',
        method: 'POST',
        headers: { 'x-upsert': 'false' },
      },
    );

    await insertRow(fetchImpl, baseUrl, publishableKey, accessToken, 'Document', {
      createdAt: now.toISOString(),
      deletedAt: null,
      docType: 'lab_report',
      fileType: 'application/pdf',
      fileUrl: storagePath,
      id: ids.document,
      labName: 'Example Health Lab',
      notes: `Synthetic deletion smoke ${runId}`,
      ocrAttempts: 0,
      ocrStatus: 'ready_for_review',
      ownerUserId: managedProfileId,
      sourceDate: now.toISOString(),
      uploadedByUserId: appUserId,
    });

    await insertRow(fetchImpl, baseUrl, publishableKey, accessToken, 'ParameterReading', {
      confidenceScore: 1,
      createdByUserId: appUserId,
      documentId: ids.document,
      id: ids.reading,
      isUserVerified: true,
      parameterId: parameter.id,
      rangeFlag: 'normal',
      recordedAt: now.toISOString(),
      status: 'verified',
      unit: parameter.unit ?? 'unit',
      userId: managedProfileId,
      value: 100,
    });

    await insertRow(fetchImpl, baseUrl, publishableKey, accessToken, 'DoctorShare', {
      customNote: `Synthetic deletion smoke ${runId}`,
      dateRangeEnd: now.toISOString(),
      dateRangeStart: new Date(now.getTime() - 86_400_000).toISOString(),
      expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
      id: ids.share,
      includeDocuments: true,
      ownerUserId: appUserId,
      parameterSet: [parameter.id],
      profileUserId: managedProfileId,
      shareToken: randomUUID().replaceAll('-', ''),
      singleUse: false,
    });

    exportStoragePath = `${authUserId}/exports/${ids.export}/synthetic-delete-export.pdf`;
    await requestRaw(fetchImpl, baseUrl, `/storage/v1/object/exports/${exportStoragePath}`, {
      accessToken,
      apiKey: publishableKey,
      body: `%PDF-1.4\n% Synthetic HealthFolio export ${runId}\n%%EOF\n`,
      contentType: 'application/pdf',
      method: 'POST',
      headers: { 'x-upsert': 'false' },
    });

    await insertRow(fetchImpl, baseUrl, publishableKey, accessToken, 'Export', {
      config: { format: 'pdf', synthetic: true },
      expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
      fileUrl: exportStoragePath,
      id: ids.export,
      profileUserId: managedProfileId,
      status: 'queued',
      userId: appUserId,
    });

    if (serviceRoleKey) {
      await insertRow(fetchImpl, baseUrl, serviceRoleKey, serviceRoleKey, 'DoctorShareAccess', {
        accessedAt: now.toISOString(),
        id: ids.shareAccess,
        ipCity: 'Synthetic',
        ipCountry: 'ZZ',
        shareId: ids.share,
        userAgent: 'HealthFolio deletion smoke',
      });
      await insertRow(fetchImpl, baseUrl, serviceRoleKey, serviceRoleKey, 'AuditLog', {
        action: 'synthetic_deletion_smoke',
        actorUserId: appUserId,
        entityId: ids.document,
        entityType: 'Document',
        id: ids.audit,
        targetUserId: managedProfileId,
        timestamp: now.toISOString(),
      });
    }

    const deletion = await requestJson(fetchImpl, baseUrl, '/functions/v1/delete-account', {
      accessToken,
      apiKey: publishableKey,
      body: { confirm: true },
      method: 'POST',
    });
    invariant(deletion?.ok === true, 'Delete account did not return success.');

    await verifyReauthenticationRejected(fetchImpl, baseUrl, publishableKey, email, password);
    const staleJwt = await verifyStaleJwtDenied(
      fetchImpl,
      baseUrl,
      publishableKey,
      accessToken,
      authUserId,
      email,
      serviceRoleKey,
    );

    if (serviceRoleKey) {
      await verifyAdministrativeCleanup(fetchImpl, baseUrl, serviceRoleKey, {
        ...ids,
        appUserId,
        authUserId,
        exportStoragePath,
        managedProfileId,
        storagePath,
      });
    }

    verifiedDeleted = true;
    return {
      adminVerified: Boolean(serviceRoleKey),
      appUserId,
      authUserId,
      deleted: true,
      email,
      managedProfileId,
      reauthenticationRejected: true,
      runId,
      seeded: serviceRoleKey
        ? [...SEEDED_KINDS, 'doctor-share-access', 'audit-log']
        : SEEDED_KINDS,
      staleJwtRestDenied: staleJwt.rest,
      staleJwtStorageDenied: staleJwt.storage,
    };
  } finally {
    if (!verifiedDeleted && authUserId) {
      const functionCleanupSucceeded = accessToken
        ? await attemptFunctionCleanup(fetchImpl, baseUrl, publishableKey, accessToken)
        : false;
      if (!functionCleanupSucceeded) {
        if (!serviceRoleKey) {
          throw new Error(
            `Automatic cleanup failed for synthetic auth user ${authUserId}. Admin cleanup is required.`,
          );
        }
        await cleanupWithServiceRole(fetchImpl, baseUrl, serviceRoleKey, {
          ...ids,
          appUserId,
          authUserId,
          email,
          exportStoragePath,
          managedProfileId,
          storagePath,
        });
      }
    }
  }
}

async function verifyReauthenticationRejected(
  fetchImpl,
  baseUrl,
  publishableKey,
  email,
  password,
) {
  const response = await fetchImpl(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  invariant(response.status === 400, `Deleted-account sign-in returned ${response.status}.`);

  const payload = await response.json().catch(() => ({}));
  const reason = [
    payload.code,
    payload.error,
    payload.error_code,
    payload.message,
    payload.msg,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ');
  invariant(
    /invalid[_\s-]?(?:login|credentials)|invalid credentials/i.test(reason),
    'Deleted-account sign-in did not return an invalid-credentials error.',
  );
}

async function verifyStaleJwtDenied(
  fetchImpl,
  baseUrl,
  publishableKey,
  accessToken,
  authUserId,
  email,
  serviceRoleKey,
) {
  const upsertResponse = await fetchImpl(`${baseUrl}/rest/v1/rpc/upsert_app_user_profile`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const upsertFailure = upsertResponse.ok ? '' : await upsertResponse.text();
  invariant(
    upsertResponse.status === 401 ||
      upsertResponse.status === 403 ||
      (upsertResponse.status === 400 &&
        /account.deleted|auth user no longer exists|not.authenticated/i.test(upsertFailure)),
    upsertResponse.ok
      ? 'Stale JWT could recreate the app user after account deletion.'
      : `Stale-JWT profile-upsert probe returned ${upsertResponse.status}.`,
  );

  const directInsertResponse = await fetchImpl(`${baseUrl}/rest/v1/User`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: authUserId,
      authUserId,
      email,
      phone: null,
      name: 'Stale JWT probe',
      dob: '1970-01-01T00:00:00.000Z',
      sex: 'other',
      unitsPreference: 'metric',
      bloodGroup: null,
      residencyRegion: 'US',
    }),
  });
  const directInsertFailure = directInsertResponse.ok ? '' : await directInsertResponse.text();
  invariant(
    directInsertResponse.status === 401 ||
      directInsertResponse.status === 403 ||
      (directInsertResponse.status === 400 &&
        /row.level security|unauthori[sz]ed|invalid jwt|jwt expired/i.test(
          directInsertFailure,
        )),
    directInsertResponse.ok
      ? 'Stale JWT could insert an app user directly after account deletion.'
      : `Stale-JWT direct-user-insert probe returned ${directInsertResponse.status}.`,
  );

  const restResponse = await fetchImpl(
    new URL(restPath('User', { select: 'id', limit: '1' }), `${baseUrl}/`),
    {
      method: 'GET',
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
    },
  );
  if (restResponse.ok) {
    const rows = await restResponse.json();
    invariant(Array.isArray(rows) && rows.length === 0, 'Stale JWT could still read app rows.');
  } else {
    invariant(
      restResponse.status === 401 || restResponse.status === 403,
      `Stale-JWT REST probe returned ${restResponse.status}.`,
    );
  }

  const probePath = `${authUserId}/stale-jwt-probe.pdf`;
  const storageResponse = await fetchImpl(
    `${baseUrl}/storage/v1/object/medical-documents/${probePath}`,
    {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'false',
      },
      body: '%PDF-1.4\n% stale JWT probe\n%%EOF\n',
    },
  );
  if (storageResponse.ok) {
    const cleanupToken = serviceRoleKey ?? accessToken;
    const cleanupKey = serviceRoleKey ?? publishableKey;
    await requestJson(fetchImpl, baseUrl, '/storage/v1/object/medical-documents', {
      accessToken: cleanupToken,
      apiKey: cleanupKey,
      body: { prefixes: [probePath] },
      method: 'DELETE',
    });
    throw new Error('Stale JWT could still create storage objects after account deletion.');
  }

  const storageFailure = await storageResponse.text();
  invariant(
    storageResponse.status === 401 ||
      storageResponse.status === 403 ||
      (storageResponse.status === 400 &&
        /row.level security|unauthori[sz]ed|invalid jwt|jwt expired/i.test(storageFailure)),
    `Stale-JWT Storage probe returned ${storageResponse.status}.`,
  );

  return { rest: true, storage: true };
}

async function attemptFunctionCleanup(fetchImpl, baseUrl, publishableKey, accessToken) {
  try {
    const result = await requestJson(fetchImpl, baseUrl, '/functions/v1/delete-account', {
      accessToken,
      apiKey: publishableKey,
      body: { confirm: true },
      method: 'POST',
    });
    return result?.ok === true;
  } catch {
    return false;
  }
}

async function cleanupWithServiceRole(fetchImpl, baseUrl, serviceRoleKey, ids) {
  const discoveredUsers = await requestJson(
    fetchImpl,
    baseUrl,
    restPath('User', {
      select: 'id',
      or: `(authUserId.eq.${ids.authUserId},email.eq.${ids.email})`,
    }),
    { accessToken: serviceRoleKey, apiKey: serviceRoleKey, method: 'GET' },
  );
  const userIds = [
    ids.appUserId,
    ids.managedProfileId,
    ...discoveredUsers.map((user) => user.id),
  ].filter(Boolean);

  for (const [bucket, paths] of [
    ['medical-documents', [ids.storagePath].filter(Boolean)],
    ['exports', [ids.exportStoragePath].filter(Boolean)],
  ]) {
    if (paths.length === 0) continue;
    await requestJson(fetchImpl, baseUrl, `/storage/v1/object/${bucket}`, {
      accessToken: serviceRoleKey,
      apiKey: serviceRoleKey,
      body: { prefixes: paths },
      method: 'DELETE',
    });
  }

  await requestJson(
    fetchImpl,
    baseUrl,
    restPath('OtpCode', { identifier: `eq.${ids.email}` }),
    {
      accessToken: serviceRoleKey,
      apiKey: serviceRoleKey,
      method: 'DELETE',
      prefer: 'return=minimal',
    },
  );

  if (userIds.length > 0) {
    await requestJson(
      fetchImpl,
      baseUrl,
      restPath('AuditLog', {
        or: orInFilter(['actorUserId', 'targetUserId'], userIds),
      }),
      {
        accessToken: serviceRoleKey,
        apiKey: serviceRoleKey,
        method: 'DELETE',
        prefer: 'return=minimal',
      },
    );

    await requestJson(fetchImpl, baseUrl, restPath('User', { id: inFilter(userIds) }), {
      accessToken: serviceRoleKey,
      apiKey: serviceRoleKey,
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  }

  await requestJson(fetchImpl, baseUrl, `/auth/v1/admin/users/${ids.authUserId}`, {
    accessToken: serviceRoleKey,
    apiKey: serviceRoleKey,
    method: 'DELETE',
  });
}

async function insertRow(fetchImpl, baseUrl, apiKey, accessToken, table, body) {
  const rows = await requestJson(fetchImpl, baseUrl, restPath(table, { select: 'id' }), {
    accessToken,
    apiKey,
    body,
    method: 'POST',
    prefer: 'return=representation',
  });
  invariant(rows?.[0]?.id, `${table} smoke row was not created.`);
}

async function verifyAdministrativeCleanup(fetchImpl, baseUrl, serviceRoleKey, ids) {
  const userIds = [ids.appUserId, ids.managedProfileId];
  const checks = [
    ['User', { id: inFilter(userIds) }],
    ['UserConsent', { userId: `eq.${ids.appUserId}` }],
    ['FamilyLink', { or: orInFilter(['ownerUserId', 'memberUserId'], userIds) }],
    ['Document', { id: `eq.${ids.document}` }],
    ['ParameterReading', { id: `eq.${ids.reading}` }],
    ['DoctorShare', { id: `eq.${ids.share}` }],
    ['DoctorShareAccess', { shareId: `eq.${ids.share}` }],
    ['Export', { id: `eq.${ids.export}` }],
    ['AuditLog', { or: orInFilter(['actorUserId', 'targetUserId'], userIds) }],
  ];

  for (const [table, filters] of checks) {
    const rows = await requestJson(
      fetchImpl,
      baseUrl,
      restPath(table, { select: 'id', limit: '1', ...filters }),
      { accessToken: serviceRoleKey, apiKey: serviceRoleKey, method: 'GET' },
    );
    invariant(rows.length === 0, `${table} retained synthetic deletion data.`);
  }

  const authLookup = await fetchImpl(`${baseUrl}/auth/v1/admin/users/${ids.authUserId}`, {
    method: 'GET',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  invariant(authLookup.status === 404, 'Deleted auth user still exists.');

  for (const bucket of ['medical-documents', 'exports']) {
    for (const prefix of [ids.authUserId, ids.appUserId, ids.managedProfileId]) {
      const objects = await requestJson(
        fetchImpl,
        baseUrl,
        `/storage/v1/object/list/${bucket}`,
        {
          accessToken: serviceRoleKey,
          apiKey: serviceRoleKey,
          body: { limit: 1, offset: 0, prefix },
          method: 'POST',
        },
      );
      invariant(
        objects.length === 0,
        `${bucket} retained synthetic objects under ${prefix}.`,
      );
    }
  }
}

async function requestJson(fetchImpl, baseUrl, path, options) {
  const response = await requestRaw(fetchImpl, baseUrl, path, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    contentType: 'application/json',
  });
  if (response === null) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function requestRaw(
  fetchImpl,
  baseUrl,
  path,
  {
    accessToken,
    apiKey,
    body,
    contentType,
    headers: extraHeaders = {},
    method,
    prefer,
    tolerateFailure = false,
  },
) {
  const headers = {
    apikey: apiKey,
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(prefer ? { Prefer: prefer } : {}),
    ...extraHeaders,
  };
  const response = await fetchImpl(new URL(path, `${baseUrl}/`), { method, headers, body });
  if (!response.ok) {
    if (tolerateFailure) return null;
    throw new Error(`Deletion smoke request failed: ${method} ${new URL(path, baseUrl).pathname} (${response.status})`);
  }
  return response;
}

function restPath(table, query) {
  const params = new URLSearchParams(query);
  return `/rest/v1/${table}?${params}`;
}

function inFilter(values) {
  return `in.(${values.join(',')})`;
}

function orInFilter(columns, values) {
  return `(${columns.map((column) => `${column}.${inFilter(values)}`).join(',')})`;
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function loadConfiguration() {
  const appConfig = JSON.parse(
    readFileSync(new URL('../apps/mobile/app.json', import.meta.url), 'utf8'),
  );
  const publicConfig = appConfig.expo?.extra?.publicConfig ?? {};
  return {
    publishableKey:
      process.env.HEALTHFOLIO_SUPABASE_ANON_KEY ?? publicConfig.supabaseAnonKey,
    serviceRoleKey: process.env.HEALTHFOLIO_SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.HEALTHFOLIO_SUPABASE_URL ?? publicConfig.supabaseUrl,
  };
}

async function main() {
  const result = await runDeletionSmoke(loadConfiguration());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Deletion smoke failed.'}\n`);
    process.exitCode = 1;
  });
}
