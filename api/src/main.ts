import 'reflect-metadata';
import { z } from 'zod';
import { createNestApp } from './app-bootstrap.js';
import { createPool } from './core/database/mysql-database.service.js';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  INSTANCE_ID: z.string().default('api-local'),
});

const env = envSchema.parse(process.env);
const pool = createPool(env.DATABASE_URL, 15);
const instance = await createNestApp(pool, env.INSTANCE_ID);

const closeGracefully = async (): Promise<void> => {
  await instance.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => void closeGracefully());
process.on('SIGTERM', () => void closeGracefully());

await instance.app.listen(env.PORT, '0.0.0.0');
console.log(`[${env.INSTANCE_ID}] API ouvindo na porta ${env.PORT}`);
