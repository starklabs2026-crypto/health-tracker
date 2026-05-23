import { z } from 'zod';

import { DocType } from './document.js';

/** Family-link roles (PRD §7.7, playbook permission matrix). */
export enum FamilyRole {
  Viewer = 'viewer',
  Contributor = 'contributor',
  Guardian = 'guardian',
}

export enum FamilyLinkStatus {
  Pending = 'pending',
  Active = 'active',
  Declined = 'declined',
  Revoked = 'revoked',
}

export const familyRoleSchema = z.nativeEnum(FamilyRole);
export const familyLinkStatusSchema = z.nativeEnum(FamilyLinkStatus);

/**
 * Per-link permission grant. `docTypes` lists which document categories the
 * owner shares with the member; role governs read/upload/edit/delete within
 * those categories (see ResourceAccessGuard matrix in Phase 2/4).
 */
export interface Permissions {
  docTypes: DocType[];
}

export const permissionsSchema = z.object({
  docTypes: z.array(z.nativeEnum(DocType)),
});

export interface FamilyLink {
  id: string;
  ownerUserId: string;
  memberUserId: string;
  role: FamilyRole;
  permissions: Permissions;
  status: FamilyLinkStatus;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
