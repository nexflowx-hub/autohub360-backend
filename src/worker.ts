import { Worker } from 'bullmq';
import { SYSTEM_QUEUE } from './queues.js';
import { bullConnection, createRedis } from './redis.js';

const heartbeat = createRedis('worker-heartbeat');
const worker = new Worker(
  SYSTEM_QUEUE,
  async (job) => {
    if (job.name === 'system.ping') {
      return { pong: true, workerAt: new Date().toISOString(), input: job.data };
    }
    throw new Error(`Unsupported job: ${job.name}`);
  },
  { connection: bullConnection(), concurrency: 5 },
);

worker.on('completed', (job) => console.log(JSON.stringify({ level: 'info', service: 'worker', event: 'job.completed', jobId: job.id, name: job.name })));
worker.on('failed', (job, error) => console.error(JSON.stringify({ level: 'error', service: 'worker', event: 'job.failed', jobId: job?.id, name: job?.name, error: error.message })));
worker.on('error', (error) => console.error(JSON.stringify({ level: 'error', service: 'worker', event: 'worker.error', error: error.message })));

async function writeHeartbeat() {
  await heartbeat.set('autohub360:worker:heartbeat', new Date().toISOString(), 'EX', 90);
}

await writeHeartbeat();
const timer = setInterval(() => void writeHeartbeat().catch(console.error), 30_000);
console.log(JSON.stringify({ level: 'info', service: 'worker', status: 'ONLINE' }));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', service: 'worker', signal, event: 'shutdown' }));
  clearInterval(timer);
  await worker.close();
  await heartbeat.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
