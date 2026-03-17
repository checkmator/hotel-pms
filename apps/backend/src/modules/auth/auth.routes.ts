import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env';
import { recordAudit } from '../../services/audit.service';
import { authenticate } from '../../middleware/authenticate';

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (jwt.sign as any)(
      { sub: user.id, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    ) as string;

    await recordAudit({
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'login',
      ipAddress: request.ip,
    });

    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // POST /auth/logout (client-side token discard + server-side log)
  app.post('/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    await recordAudit({
      userId: request.user.sub,
      entityType: 'user',
      entityId: request.user.sub,
      action: 'logout',
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Logout registrado com sucesso.' });
  });
}
