export type AppUserIdentity = {
  id: string;
  authUserId: string | null;
  email: string | null;
  phone: string | null;
};

export type DeletionIdentity = {
  authUserId: string;
  authEmail: string | null;
  authPhone: string | null;
  appUser: AppUserIdentity | null;
};

export type ManagedIdentity = {
  authUserId: string | null;
  email: string | null;
  phone: string | null;
};

export type StorageReference = {
  bucket: string;
  path: string;
};

export type ManagedIdentityPartition = {
  deletableIds: string[];
  preservedIds: string[];
};

export function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function managedIdentityCanBeDeleted(identity: ManagedIdentity): boolean {
  return !identity.authUserId && !identity.email && !identity.phone;
}

export function partitionManagedIdentities(
  identities: AppUserIdentity[],
): ManagedIdentityPartition {
  const partition: ManagedIdentityPartition = { deletableIds: [], preservedIds: [] };
  for (const identity of identities) {
    const destination = managedIdentityCanBeDeleted(identity)
      ? partition.deletableIds
      : partition.preservedIds;
    destination.push(identity.id);
  }
  return partition;
}

export function storageReferencesToDelete(
  candidates: StorageReference[],
  preserved: StorageReference[],
): StorageReference[] {
  const preservedKeys = new Set(preserved.map(storageReferenceKey));
  return candidates.filter((reference) => !preservedKeys.has(storageReferenceKey(reference)));
}

export function preservedStorageDestination(
  reference: StorageReference,
  profileId: string,
): StorageReference {
  if (reference.path === profileId || reference.path.startsWith(`${profileId}/`)) {
    return reference;
  }
  const slash = reference.path.indexOf('/');
  const suffix = slash >= 0 ? reference.path.slice(slash + 1) : reference.path;
  return { bucket: reference.bucket, path: `${profileId}/${suffix}` };
}

function storageReferenceKey(reference: StorageReference): string {
  return `${reference.bucket}\u0000${reference.path}`;
}

export function parseStorageReference(
  fileUrl: string | null,
  fallbackBucket: string,
): StorageReference | null {
  if (!fileUrl || /^https?:\/\//i.test(fileUrl)) return null;

  if (fileUrl.startsWith('storage://')) {
    const rest = fileUrl.slice('storage://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
  }

  return { bucket: fallbackBucket, path: fileUrl.replace(/^\/+/, '') };
}
