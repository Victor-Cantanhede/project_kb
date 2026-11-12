import { pathToFileURL } from 'node:url';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { createPool, execute, selectRows } from '../shared/infra/db.js';

export const SEED_TOTAL = 100_000;
const BATCH_SIZE = 1_000;
const BASE_TIME = Date.UTC(2024, 0, 1);

type NonEmpty<T> = readonly [T, ...T[]];
const pick = <T>(list: NonEmpty<T>, index: number): T => list[index % list.length] ?? list[0];

const FIRST_NAMES: NonEmpty<string> = ['João', 'José', 'Ana', 'Márcia', 'Luís', 'Bárbara', 'Cláudio', 'Débora', 'Inês', 'Otávio', 'Bruce', 'Diana', 'Peter', 'Natasha', 'Tony', 'Wanda', 'Conceição'];
const LAST_NAMES: NonEmpty<string> = ['Silva', 'Araújo', 'Gonçalves', 'Lopes', 'Banner', 'Wayne', 'Prince', 'Parker', 'Romanoff', 'Stark', 'Maximoff', 'Simões', 'Magalhães'];
const NICKNAMES: NonEmpty<string> = ['Capitão Relâmpago', 'Mulher Maravilha', 'Homem de Ferro', 'Feiticeira Escarlate', 'Pantera Negra', 'Gavião Arqueiro', 'Viúva Negra', 'Lanterna Verde', 'Tempestade', 'Fênix', 'Falcão', 'Hulk'];
const UNIVERSES: NonEmpty<string> = ['Marvel', 'DC', 'Image', 'Dark Horse', 'Valiant'];
const POWERS: NonEmpty<string> = ['Força', 'Voo', 'Telepatia', 'Velocidade', 'Invisibilidade', 'Telecinese', 'Regeneração', 'Controle do clima'];

/** Deterministic id per position: re-running the seed hits the primary key and inserts nothing new. */
export const seedHeroId = (index: number): string => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

export function seedHeroRow(index: number): readonly unknown[] {
  const id = seedHeroId(index);
  const pad = (value: number) => String(value).padStart(2, '0');
  // Groups of 5 heroes share the exact same created_at, to exercise pagination tie-breaking.
  const createdAt = new Date(BASE_TIME + Math.floor(index / 5) * 1000);
  return [
    id,
    `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, Math.floor(index / FIRST_NAMES.length))}`,
    `${pick(NICKNAMES, index)} ${index + 1}`,
    `${1940 + (index % 60)}-${pad(1 + (index % 12))}-${pad(1 + (index % 28))}`,
    pick(UNIVERSES, index),
    pick(POWERS, index),
    index % 3 === 0 ? null : `https://robohash.org/${id}?set=set4&size=200x200`,
    createdAt,
    createdAt,
  ];
}

export async function seedHeroes(pool: Pool, total = SEED_TOTAL): Promise<number> {
  const done = await selectRows(pool, z.object({ id: z.string() }), 'SELECT id FROM heroes WHERE id = ?', [seedHeroId(total - 1)]);
  if (done.length > 0) return 0; // batches run in order, so the last id means every batch is in
  let inserted = 0;
  for (let start = 0; start < total; start += BATCH_SIZE) {
    const rows = Array.from({ length: Math.min(BATCH_SIZE, total - start) }, (_, offset) => seedHeroRow(start + offset));
    // IGNORE only skips rows that already exist; the values above are generated valid.
    const result = await execute(
      pool,
      'INSERT IGNORE INTO heroes (id, name, nickname, date_of_birth, universe, main_power, avatar_url, created_at, updated_at) VALUES ?',
      [rows],
    );
    inserted += result.affectedRows;
  }
  return inserted;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool(z.string().min(1).parse(process.env.DATABASE_URL), 2);
  const startedAt = performance.now();
  const inserted = await seedHeroes(pool);
  console.log(`Seed: ${inserted} heróis novos em ${Math.round(performance.now() - startedAt)} ms (alvo: ${SEED_TOTAL}).`);
  await pool.end();
}

