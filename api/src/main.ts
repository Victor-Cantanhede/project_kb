import { z } from 'zod';
import { buildApp } from './app.js';
import { createPool } from './shared/infra/db.js';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  INSTANCE_ID: z.string().default('api-local'),
});

const env = envSchema.parse(process.env);
const pool = createPool(env.DATABASE_URL, 15);
const { app, imports } = buildApp(pool, env.INSTANCE_ID);

const closeGracefully = async (): Promise<void> => {
  await app.close();
  await imports.waitForAll();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => void closeGracefully());
process.on('SIGTERM', () => void closeGracefully());

await app.listen({ host: '0.0.0.0', port: env.PORT });
console.log(`[${env.INSTANCE_ID}] API ouvindo na porta ${env.PORT}`);

