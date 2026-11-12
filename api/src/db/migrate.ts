import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);
const LOCK = 'hero_factory_migrations';

/** Applies pending `migrations/*.sql` in name order. A named lock keeps concurrent runners from racing. */
export async function runMigrations(databaseUrl: string): Promise<readonly string[]> {
  const connection = await mysql.createConnection({ uri: databaseUrl, multipleStatements: true });
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 60) AS locked', [LOCK]);
    if (z.array(z.object({ locked: z.literal(1) })).safeParse(lockRows).success === false) {
      throw new Error('Não foi possível obter o lock de migração.');
    }
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) NOT NULL)',
    );
    const [appliedRows] = await connection.query<RowDataPacket[]>('SELECT name FROM schema_migrations');
    const applied = new Set(z.array(z.object({ name: z.string() })).parse(appliedRows).map((row) => row.name));
    const pending = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql') && !applied.has(file)).sort();
    for (const file of pending) {
      await connection.query(await readFile(new URL(file, MIGRATIONS_DIR), 'utf8'));
      await connection.query('INSERT INTO schema_migrations (name, applied_at) VALUES (?, UTC_TIMESTAMP(3))', [file]);
    }
    return pending;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [LOCK]);
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = z.string().min(1).parse(process.env.DATABASE_URL);
  const applied = await runMigrations(url);
  console.log(applied.length > 0 ? `Migrações aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
}

