import { FastifyRequest, FastifyReply } from 'fastify';

// ─── Permission Matrix ────────────────────────────────────────────────────────
//
//  Resource              admin   reception   housekeeping
//  ─────────────────── ──────── ─────────── ─────────────
//  rooms:read              ✓        ✓             ✓
//  rooms:write             ✓        ✗             ✗
//  rooms:status_update     ✓        ✓             ✓
//  guests:read             ✓        ✓             ✗
//  guests:write            ✓        ✓             ✗
//  reservations:read       ✓        ✓             ✗
//  reservations:write      ✓        ✓             ✗
//  transactions:read       ✓        ✓             ✗
//  transactions:write      ✓        ✓             ✗
//  invoices:close          ✓        ✓             ✗
//  users:manage            ✓        ✗             ✗
//  audit_logs:read         ✓        ✗             ✗
//
// ─────────────────────────────────────────────────────────────────────────────

type Permission =
  | 'rooms:read'
  | 'rooms:write'
  | 'rooms:status_update'
  | 'guests:read'
  | 'guests:write'
  | 'reservations:read'
  | 'reservations:write'
  | 'transactions:read'
  | 'transactions:write'
  | 'invoices:close'
  | 'users:manage'
  | 'audit_logs:read'
  | 'reports:read';

type Role = 'admin' | 'reception' | 'housekeeping';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'rooms:read',
    'rooms:write',
    'rooms:status_update',
    'guests:read',
    'guests:write',
    'reservations:read',
    'reservations:write',
    'transactions:read',
    'transactions:write',
    'invoices:close',
    'users:manage',
    'audit_logs:read',
    'reports:read',
  ],
  reception: [
    'rooms:read',
    'rooms:status_update',
    'guests:read',
    'guests:write',
    'reservations:read',
    'reservations:write',
    'transactions:read',
    'transactions:write',
    'invoices:close',
    'reports:read',
  ],
  housekeeping: [
    'rooms:read',
    'rooms:status_update',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Fastify preHandler factory — restrict route to users with a given permission.
 * Usage: { preHandler: [authenticate, authorize('reservations:write')] }
 */
export function authorize(permission: Permission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const role = request.user?.role as Role;

    if (!role || !hasPermission(role, permission)) {
      return reply.status(403).send({
        error: 'Acesso negado. Você não tem permissão para realizar esta operação.',
      });
    }
  };
}
