import { createSystemQueue } from './queues.js';
import { createRedis } from './redis.js';

const queue = createSystemQueue();
const heartbeat = createRedis('scheduler-heartbeat');

async function tick() {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  await heartbeat.set('autohub360:scheduler:heartbeat', now.toISOString(), 'EX', 150);
  await queue.add(
    'system.ping',
    { scheduledAt: now.toISOString() },
    { jobId: `system-ping-${minute}`, removeOnComplete: 100, removeOnFail: 100 },
  );
}

await tick();
const timer = setInterval(() => void tick().catch((error) => console.error(error)), 60_000);
console.log(JSON.stringify({ level: 'info', service: 'scheduler', status: 'ONLINE' }));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', service: 'scheduler', signal, event: 'shutdown' }));
  clearInterval(timer);
  await queue.close();
  await heartbeat.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
