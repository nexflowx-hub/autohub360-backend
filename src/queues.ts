import { Queue } from 'bullmq';
import { bullConnection } from './redis.js';

export const SYSTEM_QUEUE = 'autohub-system';

export function createSystemQueue() {
  return new Queue(SYSTEM_QUEUE, {
    connection: bullConnection(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
}
