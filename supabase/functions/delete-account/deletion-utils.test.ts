import { assertEquals } from 'jsr:@std/assert';

import {
  managedIdentityCanBeDeleted,
  parseStorageReference,
  partitionManagedIdentities,
  preservedStorageDestination,
  storageReferencesToDelete,
} from './deletion-utils.ts';

Deno.test('managed profiles with independent identities are preserved', () => {
  assertEquals(
    managedIdentityCanBeDeleted({ authUserId: 'auth-1', email: null, phone: null }),
    false,
  );
});

Deno.test('anonymous managed profiles are deletable', () => {
  assertEquals(managedIdentityCanBeDeleted({ authUserId: null, email: null, phone: null }), true);
});

Deno.test('managed identity partition preserves every claimed identity', () => {
  assertEquals(
    partitionManagedIdentities([
      { id: 'anonymous', authUserId: null, email: null, phone: null },
      { id: 'auth', authUserId: 'auth-1', email: null, phone: null },
      { id: 'email', authUserId: null, email: 'member@example.com', phone: null },
    ]),
    { deletableIds: ['anonymous'], preservedIds: ['auth', 'email'] },
  );
});

Deno.test('storage references normalize storage URLs', () => {
  assertEquals(parseStorageReference('storage://medical-documents/u/report.pdf', 'exports'), {
    bucket: 'medical-documents',
    path: 'u/report.pdf',
  });
});

Deno.test('storage cleanup excludes objects referenced by preserved profiles', () => {
  assertEquals(
    storageReferencesToDelete(
      [
        { bucket: 'medical-documents', path: 'owner/documents/delete/report.pdf' },
        { bucket: 'medical-documents', path: 'owner/documents/preserve/report.pdf' },
      ],
      [{ bucket: 'medical-documents', path: 'owner/documents/preserve/report.pdf' }],
    ),
    [{ bucket: 'medical-documents', path: 'owner/documents/delete/report.pdf' }],
  );
});

Deno.test('preserved storage moves under the stable app profile id', () => {
  assertEquals(
    preservedStorageDestination(
      { bucket: 'medical-documents', path: 'former-auth/documents/doc-1/report.pdf' },
      'profile-1',
    ),
    { bucket: 'medical-documents', path: 'profile-1/documents/doc-1/report.pdf' },
  );
});
