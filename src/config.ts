import { z } from 'zod';

const emptyToUndefined = (value: unknown) => value === '' ? undefined : value;
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8090),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.string().default('info'),
  REDIS_URL: z.string().url().default('redis://autohub360-redis:6379'),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  CORS_ORIGINS: z.string().default('https://autohub360.store,https://autohub360.tech,https://admin.autohub360.tech'),
});

export const env = schema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
