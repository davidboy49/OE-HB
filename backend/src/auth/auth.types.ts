import type { UserRole } from '@auditdesk/shared';

/** Decoded JWT payload, attached to `req.user` by JwtStrategy. */
export interface AuthenticatedUser {
  sub: string; // user id
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}
