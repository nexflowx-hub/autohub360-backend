import cors from '@fastify/cors';
import Fastify from 'fastify';
import { corsOrigins, env } from './config.js';
import { createRedis, redisStatus } from './redis.js';
import { supabaseConfigured, supabaseStatus } from './supabase.js';

const app = Fastify({ logger: { level: env.LOG_LEVEL } });
const redis = createRedis('api');

await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.addHook('onSend', async (_request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return payload;
});

app.get('/api/health', async () => ({
  success: true,
  service: 'AutoHub360 API',
  version: env.SERVICE_VERSION,
  status: 'ONLINE',
  timestamp: new Date().toISOString(),
}));

app.get('/api/ready', async (_request, reply) => {
  const [redisCheck, supabaseCheck] = await Promise.all([redisStatus(redis), supabaseStatus()]);
  const ready = redisCheck.status === 'OK' && supabaseCheck.status === 'OK';
  if (!ready) reply.code(503);
  return {
    success: ready,
    status: ready ? 'READY' : 'DEGRADED',
    dependencies: { redis: redisCheck, supabase: supabaseCheck },
    timestamp: new Date().toISOString(),
  };
});

app.get('/api/v1/system/capabilities', async () => ({
  success: true,
  data: {
    runtime: { api: true, worker: true, scheduler: true },
    infrastructure: { redis: true, supabase: supabaseConfigured() },
    modules: [
      'catalog', 'sourcing', 'crm', 'leads', 'orders', 'shipments', 'tracking',
      'support', 'notifications', 'automations', 'ai', 'integrations', 'webhooks',
    ],
  },
}));

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Graceful shutdown');
  await app.close();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info({ port: env.PORT, version: env.SERVICE_VERSION }, 'AutoHub360 API online');
} catch (error) {
  app.log.error(error);
  await redis.quit().catch(() => undefined);
  process.exit(1);
}
