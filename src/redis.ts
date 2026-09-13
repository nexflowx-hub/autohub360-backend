import Redis from 'ioredis';
import { env } from './config.js';

export function createRedis(connectionName: string) {
  return new Redis(env.REDIS_URL, {
    connectionName: `autohub360-${connectionName}`,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export function bullConnection() {
  const url = new URL(env.REDIS_URL);
  const db = url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export async function redisStatus(redis: Redis) {
  try {
    const pong = await redis.ping();
    return { status: pong === 'PONG' ? 'OK' : 'ERROR' } as const;
  } catch (error) {
    return { status: 'ERROR', error: error instanceof Error ? error.message : 'Redis check failed' } as const;
  }
}
