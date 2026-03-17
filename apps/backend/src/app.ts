import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { roomRoutes } from './modules/rooms/rooms.routes';
import { guestRoutes } from './modules/guests/guests.routes';
import { reservationRoutes } from './modules/reservations/reservations.routes';
import { checkInRoutes } from './modules/reservations/checkin.routes';
import { checkOutRoutes } from './modules/reservations/checkout.routes';
import { transactionRoutes } from './modules/transactions/transactions.routes';
import { reportRoutes } from './modules/reports/reports.routes';
import { userRoutes } from './modules/users/users.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { fiscalNoteRoutes } from './modules/fiscal/fiscal-note.routes';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  // ── Security plugins ────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Muitas requisições. Tente novamente em instantes.',
    }),
  });

  // ── Global input sanitization hook ─────────────────────────
  // Strips any attempt at XSS payloads from string fields before
  // they reach route handlers. Zod validation adds a second layer.
  app.addHook('preHandler', async (request) => {
    if (request.body && typeof request.body === 'object') {
      sanitizeObject(request.body as Record<string, unknown>);
    }
  });

  // ── Routes ─────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(roomRoutes);
  await app.register(guestRoutes);
  await app.register(reservationRoutes);
  await app.register(checkInRoutes);
  await app.register(checkOutRoutes);
  await app.register(transactionRoutes);
  await app.register(reportRoutes);
  await app.register(userRoutes);
  await app.register(auditRoutes);
  await app.register(dashboardRoutes);
  await app.register(fiscalNoteRoutes);

  // ── Health check ────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  return app;
}

// ── Helpers ──────────────────────────────────────────────────

const XSS_PATTERN = /<[^>]*>|javascript:|data:/gi;

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = val.replace(XSS_PATTERN, '');
    } else if (val !== null && typeof val === 'object') {
      sanitizeObject(val as Record<string, unknown>);
    }
  }
}
