import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JWTPayload {
  sub: string;       // user id 
  role: 'admin' | 'reception' | 'housekeeping';
  email: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    request.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou expirado.' });
  }
}
