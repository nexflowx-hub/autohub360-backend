import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './config.js';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requireInternalAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!env.INTERNAL_API_TOKEN) {
    return reply.code(503).send({ success: false, error: 'INTERNAL_API_NOT_CONFIGURED' });
  }

  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || !safeEqual(token, env.INTERNAL_API_TOKEN)) {
    return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
  }
}
