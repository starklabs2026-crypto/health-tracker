import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts';
import {
  parseStorageReference,
  preservedStorageDestination,
  storageReferencesToDelete,
  unique,
  type AppUserIdentity,
  type DeletionIdentity,
  type StorageReference,
} from './deletion-utils.ts';

type SupabaseClient = ReturnType<typeof getAdminClient>;

type AppUser = AppUserIdentity;

type FamilyLinkRow = {
  id: string;
  ownerUserId: string;
  memberUserId: string;
  status: string;
  accessOrigin: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  inviteToken: string | null;
  permissions: unknown;
};

type UserIdentityRow = AppUserIdentity;

type PreservedDocumentRow = {
  id: string;
  ownerUserId: string;
  fileUrl: string | null;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const STORAGE_BUCKETS = ['medical-documents', 'exports'];
const FULL_DOCUMENT_TYPES = ['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'vaccination_record', 'other'];

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, 'Supabase service configuration is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization');
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new HttpError(401, 'Missing bearer token');
  return match[1];
}

async function getDeletionIdentity(
  admin: SupabaseClient,
  req: Request,
): Promise<{ token: string; identity: DeletionIdentity }> {
  const token = bearerToken(req);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid bearer token');

  const authUserId = data.user.id;
  const authEmail = data.user.email ?? null;
  const authPhone = data.user.phone ?? null;

  const bound = await admin
    .from('User')
    .select('id, authUserId, email, phone')
    .eq('authUserId', authUserId)
    .maybeSingle();
  if (bound.error) throw bound.error;

  const legacy = await admin
    .from('User')
    .select('id, authUserId, email, phone')
    .eq('id', authUserId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  if (bound.data && legacy.data && bound.data.id !== legacy.data.id) {
    throw new HttpError(403, 'Profile identity does not match authenticated user');
  }
  const appUser = (bound.data ?? legacy.data) as AppUser | null;
  if (appUser) {
    if (appUser.authUserId !== null && appUser.authUserId !== authUserId) {
      throw new HttpError(403, 'Profile identity does not match authenticated user');
    }
    return {
      token,
      identity: { appUser, authUserId, authEmail, authPhone },
    };
  }

  return { token, identity: { appUser: null, authUserId, authEmail, authPhone } };
}

async function listStoragePaths(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const stack = [prefix.replace(/^\/+|\/+$/g, '')];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const { data, error } = await admin.storage.from(bucket).list(current, { limit: 1000 });
    if (error) throw error;

    for (const item of data ?? []) {
      const path = `${current}/${item.name}`;
      if (item.id === null) {
        stack.push(path);
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}

async function storedFileReferences(
  admin: SupabaseClient,
  userIds: string[],
): Promise<StorageReference[]> {
  if (userIds.length === 0) return [];

  const [ownedDocuments, exports] = await Promise.all([
    admin.from('Document').select('fileUrl').in('ownerUserId', userIds).not('fileUrl', 'is', null),
    admin.from('Export').select('fileUrl').in('userId', userIds).not('fileUrl', 'is', null),
  ]);

  if (ownedDocuments.error) throw ownedDocuments.error;
  if (exports.error) throw exports.error;

  return [
    ...((ownedDocuments.data ?? []) as Array<{ fileUrl: string | null }>).map((row) =>
      parseStorageReference(row.fileUrl, 'medical-documents'),
    ),
    ...((exports.data ?? []) as Array<{ fileUrl: string | null }>).map((row) =>
      parseStorageReference(row.fileUrl, 'exports'),
    ),
  ].filter((reference): reference is StorageReference => reference !== null);
}

async function removeStoragePrefixes(
  admin: SupabaseClient,
  prefixes: string[],
  preservedReferences: StorageReference[],
): Promise<void> {
  for (const bucket of STORAGE_BUCKETS) {
    const candidates = (
      await Promise.all(prefixes.map((prefix) => listStoragePaths(admin, bucket, prefix)))
    )
      .flat()
      .map((path) => ({ bucket, path }));
    const paths = storageReferencesToDelete(candidates, preservedReferences).map(
      (reference) => reference.path,
    );

    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      if (batch.length === 0) continue;
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
    }
  }
}

async function removeStorageReferences(
  admin: SupabaseClient,
  references: StorageReference[],
): Promise<void> {
  const byBucket = new Map<string, Set<string>>();
  for (const reference of references) {
    const paths = byBucket.get(reference.bucket) ?? new Set<string>();
    paths.add(reference.path);
    byBucket.set(reference.bucket, paths);
  }

  for (const [bucket, paths] of byBucket.entries()) {
    const allPaths = [...paths];
    for (let i = 0; i < allPaths.length; i += 100) {
      const batch = allPaths.slice(i, i + 100);
      if (batch.length === 0) continue;
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
    }
  }
}

function provenanceUnavailable(): HttpError {
  return new HttpError(503, 'Account deletion is unavailable until family ownership can be verified.');
}

async function familyLinksFor(
  admin: SupabaseClient,
  column: 'ownerUserId' | 'memberUserId',
  userIds: string[],
): Promise<FamilyLinkRow[]> {
  const { data, error, count } = await admin
    .from('FamilyLink')
    .select('id, ownerUserId, memberUserId, status, accessOrigin, acceptedAt, revokedAt, inviteToken, permissions', { count: 'exact' })
    .in(column, userIds);
  // Missing migration fields or a server row cap must never look like exclusive ownership.
  if (error || !Array.isArray(data) || count !== data.length) throw provenanceUnavailable();
  return data as FamilyLinkRow[];
}

function familyLinkKind(link: FamilyLinkRow): 'invitation' | 'managed' | 'preserved' {
  const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  if (!nonempty(link.id) || !nonempty(link.ownerUserId) || !nonempty(link.memberUserId)
    || link.ownerUserId === link.memberUserId) throw provenanceUnavailable();

  if (link.accessOrigin === 'unverified' && link.acceptedAt === null && nonempty(link.inviteToken)
    && ((link.status === 'pending' && link.revokedAt === null)
      || (link.status === 'revoked' && nonempty(link.revokedAt)))) return 'invitation';

  if ((link.accessOrigin === 'managed' || link.accessOrigin === 'accepted')
    && nonempty(link.acceptedAt) && link.inviteToken === null
    && ((link.status === 'active' && link.revokedAt === null)
      || (link.status === 'revoked' && nonempty(link.revokedAt)))) {
    return link.accessOrigin === 'managed' && link.status === 'active' ? 'managed' : 'preserved';
  }
  throw provenanceUnavailable();
}

async function managedProfilePartition(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<{ deletableIds: string[]; preservedIds: string[] }> {
  const links = await familyLinksFor(admin, 'ownerUserId', [ownerUserId]);
  const candidates = new Set<string>();
  const preserved = new Set<string>();
  for (const link of links) {
    const kind = familyLinkKind(link);
    if (kind !== 'invitation') {
      // Both deletion and preservation affect whole-profile data. A restricted
      // grant must stop the operation, not fall through to excluded-file migration.
      if (!link.permissions || typeof link.permissions !== 'object' || Array.isArray(link.permissions)) {
        throw provenanceUnavailable();
      }
      const docTypes = (link.permissions as { docTypes?: unknown }).docTypes;
      if (!Array.isArray(docTypes)
        || docTypes.some((value) => typeof value !== 'string' || !FULL_DOCUMENT_TYPES.includes(value))
        || !FULL_DOCUMENT_TYPES.every((type) => docTypes.includes(type))) throw provenanceUnavailable();
    }
    if (kind === 'managed') candidates.add(link.memberUserId);
    if (kind === 'preserved') preserved.add(link.memberUserId);
  }

  // Unaccepted invitations are caller-writable, so they authorize neither deletion nor file migration.
  const memberIds = unique([...candidates, ...preserved]);
  if (memberIds.length === 0) return { deletableIds: [], preservedIds: [] };

  const { data: members, error: memberError, count } = await admin
    .from('User')
    .select('id, authUserId, email, phone', { count: 'exact' })
    .in('id', memberIds);
  if (memberError || !Array.isArray(members) || count !== members.length
    || members.length !== memberIds.length
    || new Set(members.map((member) => member.id)).size !== memberIds.length) throw provenanceUnavailable();

  for (const member of members as UserIdentityRow[]) {
    const identifiers = [member.authUserId, member.email, member.phone];
    if (!memberIds.includes(member.id)
      || identifiers.some((value) => value !== null && typeof value !== 'string')) throw provenanceUnavailable();
    if (identifiers.some((value) => value !== null)) preserved.add(member.id);
  }

  const candidateIds = [...candidates].filter((id) => !preserved.has(id));
  if (candidateIds.length > 0) {
    const incoming = await familyLinksFor(admin, 'memberUserId', candidateIds);
    const outgoing = await familyLinksFor(admin, 'ownerUserId', candidateIds);
    for (const link of incoming) {
      const kind = familyLinkKind(link);
      if (kind !== 'invitation' && (kind !== 'managed' || link.ownerUserId !== ownerUserId)) {
        preserved.add(link.memberUserId);
      }
    }
    for (const link of outgoing) {
      if (familyLinkKind(link) !== 'invitation') preserved.add(link.ownerUserId);
    }

    for (const id of candidateIds) {
      if (preserved.has(id)) continue;
      // Nullable User fields do not rule out a legacy auth.users identity with the same ID.
      const { data, error } = await admin.rpc('profile_has_auth_identity', { p_user_id: id });
      if (error || typeof data !== 'boolean') throw provenanceUnavailable();
      if (data) preserved.add(id);
    }
  }

  return { deletableIds: [...candidates].filter((id) => !preserved.has(id)), preservedIds: [...preserved] };
}

async function storageObjectExists(
  admin: SupabaseClient,
  reference: StorageReference,
): Promise<boolean> {
  const slash = reference.path.lastIndexOf('/');
  const folder = slash >= 0 ? reference.path.slice(0, slash) : '';
  const fileName = slash >= 0 ? reference.path.slice(slash + 1) : reference.path;
  const { data, error } = await admin.storage
    .from(reference.bucket)
    .list(folder, { limit: 100, search: fileName });
  if (error) throw error;
  return (data ?? []).some((item) => item.name === fileName && item.id !== null);
}

async function migratePreservedDocumentStorage(
  admin: SupabaseClient,
  ownerUserIds: string[],
): Promise<StorageReference[]> {
  if (ownerUserIds.length === 0) return [];
  const { data, error } = await admin
    .from('Document')
    .select('id,ownerUserId,fileUrl')
    .in('ownerUserId', ownerUserIds)
    .not('fileUrl', 'is', null);
  if (error) throw error;

  const preservedReferences: StorageReference[] = [];
  for (const document of (data ?? []) as PreservedDocumentRow[]) {
    const source = parseStorageReference(document.fileUrl, 'medical-documents');
    if (!source) continue;
    const destination = preservedStorageDestination(source, document.ownerUserId);

    if (source.path !== destination.path || source.bucket !== destination.bucket) {
      if (source.bucket !== destination.bucket) {
        throw new Error('Preserved document storage cannot move across buckets.');
      }

      const [sourceExists, destinationExists] = await Promise.all([
        storageObjectExists(admin, source),
        storageObjectExists(admin, destination),
      ]);
      if (!sourceExists && !destinationExists) {
        throw new Error(`Preserved document file is missing: ${document.id}`);
      }

      if (sourceExists && !destinationExists) {
        const { error: moveError } = await admin.storage
          .from(source.bucket)
          .move(source.path, destination.path);
        if (moveError) throw moveError;
      } else if (sourceExists && destinationExists) {
        const { error: removeError } = await admin.storage
          .from(source.bucket)
          .remove([source.path]);
        if (removeError) throw removeError;
      }

      const { error: updateError } = await admin
        .from('Document')
        .update({ fileUrl: destination.path })
        .eq('id', document.id);
      if (updateError) throw updateError;
    }

    preservedReferences.push(destination);
  }
  return preservedReferences;
}

async function reassignPreservedProfileData(
  admin: SupabaseClient,
  preservedProfileIds: string[],
  deletingUserIds: string[],
): Promise<void> {
  for (const profileId of preservedProfileIds) {
    let result = await admin
      .from('Document')
      .update({ uploadedByUserId: profileId })
      .eq('ownerUserId', profileId)
      .in('uploadedByUserId', deletingUserIds);
    if (result.error) throw result.error;

    result = await admin
      .from('ParameterReading')
      .update({ createdByUserId: profileId })
      .eq('userId', profileId)
      .in('createdByUserId', deletingUserIds);
    if (result.error) throw result.error;
  }
}

async function revokeSessionsBeforeDelete(
  admin: SupabaseClient,
  token: string,
  authUserId: string,
): Promise<void> {
  const { error: signOutError } = await admin.auth.admin.signOut(token, 'global');
  if (!signOutError) return;

  const { data, error: authLookupError } = await admin.auth.admin.getUserById(authUserId);
  if (authLookupError) throw authLookupError;
  if (data.user) throw signOutError;
}

async function deleteAppData(
  admin: SupabaseClient,
  userIds: string[],
  identifiers: string[],
): Promise<void> {
  if (identifiers.length > 0) {
    const otpResult = await admin.from('OtpCode').delete().in('identifier', identifiers);
    if (otpResult.error) throw otpResult.error;
  }

  if (userIds.length === 0) return;

  let result = await admin.from('AuditLog').delete().in('actorUserId', userIds);
  if (result.error) throw result.error;

  result = await admin.from('AuditLog').delete().in('targetUserId', userIds);
  if (result.error) throw result.error;

  result = await admin.from('User').delete().in('id', userIds);
  if (result.error) throw result.error;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const admin = getAdminClient();
    const { token, identity } = await getDeletionIdentity(admin, req);
    const profiles = identity.appUser
      ? await managedProfilePartition(admin, identity.appUser.id)
      : { deletableIds: [], preservedIds: [] };
    const userIds = identity.appUser ? unique([identity.appUser.id, ...profiles.deletableIds]) : [];
    const identifiers = unique([
      identity.appUser?.email,
      identity.appUser?.phone,
      identity.authEmail,
      identity.authPhone,
    ]);
    const storageReferences = await storedFileReferences(admin, userIds);
    const preservedStorageReferences = await migratePreservedDocumentStorage(
      admin,
      profiles.preservedIds,
    );

    await reassignPreservedProfileData(admin, profiles.preservedIds, userIds);

    if (identity.appUser) {
      await removeStoragePrefixes(
        admin,
        unique([identity.authUserId, ...userIds]),
        preservedStorageReferences,
      );
    }
    await removeStorageReferences(
      admin,
      storageReferencesToDelete(storageReferences, preservedStorageReferences),
    );
    await deleteAppData(admin, userIds, identifiers);
    await revokeSessionsBeforeDelete(admin, token, identity.authUserId);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(identity.authUserId);
    if (authDeleteError) throw authDeleteError;

    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
