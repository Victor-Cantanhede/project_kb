import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { createPool, execute, selectRows } from '../core/database/mysql-database.service.js';

export interface SeedDevSummary {
  readonly avatars: number;
  readonly heroes: number;
  readonly history: number;
  readonly missions: number;
  readonly missionHeroes: number;
  readonly imports: number;
}

export interface ShowcaseAvatarDef {
  readonly id: string;
  readonly rgb: readonly [number, number, number];
}

export interface ShowcaseHeroDef {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
  readonly is_active: boolean;
  readonly version: number;
  readonly created_at: Date;
  readonly deleted_at: Date | null;
}

export interface ShowcaseHistoryDef {
  readonly hero_id: string;
  readonly field: 'nickname' | 'main_power' | 'universe' | 'is_active' | 'avatar_url';
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly changed_at: Date;
}

export interface ShowcaseMissionDef {
  readonly id: string;
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly status: 'scheduled' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
  readonly created_at: Date;
  readonly hero_ids: readonly string[];
}

export interface ShowcaseImportDef {
  readonly id: string;
  readonly filename: string;
  readonly status: 'completed';
  readonly total_rows: number;
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly { readonly line: number; readonly message: string }[];
  readonly created_at: Date;
}

// Deterministic v4-compatible UUIDs so repeated seed runs hit PRIMARY KEY / INSERT IGNORE cleanly.
export const AVATAR_IDS = {
  iron: '10000000-0000-4000-8000-000000000001',
  wonder: '10000000-0000-4000-8000-000000000002',
  hulk: '10000000-0000-4000-8000-000000000003',
  spider: '10000000-0000-4000-8000-000000000004',
  scarlet: '10000000-0000-4000-8000-000000000005',
  panther: '10000000-0000-4000-8000-000000000006',
} as const;

export const HERO_IDS = {
  tony: '20000000-0000-4000-8000-000000000001',
  diana: '20000000-0000-4000-8000-000000000002',
  bruce: '20000000-0000-4000-8000-000000000003',
  natasha: '20000000-0000-4000-8000-000000000004',
  peter: '20000000-0000-4000-8000-000000000005',
  wanda: '20000000-0000-4000-8000-000000000006',
  clark: '20000000-0000-4000-8000-000000000007',
  ororo: '20000000-0000-4000-8000-000000000008',
  tchalla: '20000000-0000-4000-8000-000000000009',
  steve: '20000000-0000-4000-8000-000000000010',
  arthur: '20000000-0000-4000-8000-000000000011',
  logan: '20000000-0000-4000-8000-000000000012',
} as const;

export const SHOWCASE_AVATARS: readonly ShowcaseAvatarDef[] = [
  { id: AVATAR_IDS.iron, rgb: [185, 28, 28] },
  { id: AVATAR_IDS.wonder, rgb: [29, 78, 216] },
  { id: AVATAR_IDS.hulk, rgb: [21, 128, 61] },
  { id: AVATAR_IDS.spider, rgb: [220, 38, 38] },
  { id: AVATAR_IDS.scarlet, rgb: [159, 18, 57] },
  { id: AVATAR_IDS.panther, rgb: [30, 41, 59] },
];

const SHOWCASE_BASE = Date.UTC(2026, 0, 15, 12, 0, 0);
const minAfter = (minutes: number): Date => new Date(SHOWCASE_BASE + minutes * 60_000);

// Timestamps are after BASE_TIME (2024-01-01) so showcase heroes appear on page 1 immediately.
export const SHOWCASE_HEROES: readonly ShowcaseHeroDef[] = [
  {
    id: HERO_IDS.tony,
    name: 'Anthony Edward Stark',
    nickname: 'Homem de Ferro',
    date_of_birth: '1970-05-29',
    universe: 'Marvel',
    main_power: 'Armadura tecnológica',
    avatar_url: `/api/avatars/${AVATAR_IDS.iron}`,
    is_active: true,
    version: 3,
    created_at: minAfter(120),
    deleted_at: null,
  },
  {
    id: HERO_IDS.diana,
    name: 'Diana Prince',
    nickname: 'Mulher-Maravilha',
    date_of_birth: '1941-10-21',
    universe: 'DC',
    main_power: 'Força divina e laço da verdade',
    avatar_url: `/api/avatars/${AVATAR_IDS.wonder}`,
    is_active: true,
    version: 2,
    created_at: minAfter(110),
    deleted_at: null,
  },
  {
    id: HERO_IDS.bruce,
    name: 'Robert Bruce Banner',
    nickname: 'Hulk',
    date_of_birth: '1969-12-18',
    universe: 'Marvel',
    main_power: 'Força gama ilimitada',
    avatar_url: `/api/avatars/${AVATAR_IDS.hulk}`,
    is_active: true,
    version: 2,
    created_at: minAfter(100),
    deleted_at: null,
  },
  {
    id: HERO_IDS.natasha,
    name: 'Natalia Alianovna Romanova',
    nickname: 'Viúva Negra',
    date_of_birth: '1984-11-22',
    universe: 'Marvel',
    main_power: 'Espionagem e combate tático',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: minAfter(90),
    deleted_at: null,
  },
  {
    id: HERO_IDS.peter,
    name: 'Peter Benjamin Parker',
    nickname: 'Homem-Aranha',
    date_of_birth: '2001-08-10',
    universe: 'Marvel',
    main_power: 'Sentido aranha e agilidade',
    avatar_url: `/api/avatars/${AVATAR_IDS.spider}`,
    is_active: true,
    version: 1,
    created_at: minAfter(80),
    deleted_at: null,
  },
  {
    id: HERO_IDS.wanda,
    name: 'Wanda Maximoff',
    nickname: 'Feiticeira Escarlate',
    date_of_birth: '1989-02-10',
    universe: 'Marvel',
    main_power: 'Magia do caos',
    avatar_url: `/api/avatars/${AVATAR_IDS.scarlet}`,
    is_active: true,
    version: 2,
    created_at: minAfter(70),
    deleted_at: null,
  },
  {
    id: HERO_IDS.clark,
    name: 'Clark Joseph Kent',
    nickname: 'Superman',
    date_of_birth: '1978-06-18',
    universe: 'DC',
    main_power: 'Voo, superforça e visão de calor',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: minAfter(60),
    deleted_at: null,
  },
  {
    id: HERO_IDS.ororo,
    name: 'Ororo Munroe',
    nickname: 'Tempestade',
    date_of_birth: '1975-05-01',
    universe: 'Marvel',
    main_power: 'Controle climático',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: minAfter(50),
    deleted_at: null,
  },
  {
    id: HERO_IDS.tchalla,
    name: "T'Challa Udaku",
    nickname: 'Pantera Negra',
    date_of_birth: '1980-11-29',
    universe: 'Marvel',
    main_power: 'Traje de vibranium e sentidos aguçados',
    avatar_url: `/api/avatars/${AVATAR_IDS.panther}`,
    is_active: true,
    version: 1,
    created_at: minAfter(40),
    deleted_at: null,
  },
  {
    id: HERO_IDS.steve,
    name: 'Steven Grant Rogers',
    nickname: 'Capitão América',
    date_of_birth: '1920-07-04',
    universe: 'Marvel',
    main_power: 'Soro do supersoldado',
    avatar_url: null,
    is_active: false,
    version: 2,
    created_at: minAfter(30),
    deleted_at: null,
  },
  {
    id: HERO_IDS.arthur,
    name: 'Arthur Curry',
    nickname: 'Aquaman',
    date_of_birth: '1986-01-29',
    universe: 'DC',
    main_power: 'Hidrocinese e telepatia marinha',
    avatar_url: null,
    is_active: false,
    version: 1,
    created_at: minAfter(20),
    deleted_at: null,
  },
  {
    id: HERO_IDS.logan,
    name: 'James Logan Howlett',
    nickname: 'Wolverine',
    date_of_birth: '1882-04-12',
    universe: 'Marvel',
    main_power: 'Fator de cura e garras de adamantium',
    avatar_url: null,
    is_active: false,
    version: 1,
    created_at: minAfter(10),
    deleted_at: minAfter(15),
  },
];

export const SHOWCASE_HISTORY: readonly ShowcaseHistoryDef[] = [
  {
    hero_id: HERO_IDS.tony,
    field: 'main_power',
    old_value: 'Reator Arc Mk III',
    new_value: 'Armadura tecnológica',
    changed_at: minAfter(125),
  },
  {
    hero_id: HERO_IDS.tony,
    field: 'avatar_url',
    old_value: null,
    new_value: `/api/avatars/${AVATAR_IDS.iron}`,
    changed_at: minAfter(130),
  },
  {
    hero_id: HERO_IDS.diana,
    field: 'nickname',
    old_value: 'Princesa de Themyscira',
    new_value: 'Mulher-Maravilha',
    changed_at: minAfter(115),
  },
  {
    hero_id: HERO_IDS.bruce,
    field: 'nickname',
    old_value: 'Gigante Esmeralda',
    new_value: 'Hulk',
    changed_at: minAfter(105),
  },
  {
    hero_id: HERO_IDS.wanda,
    field: 'main_power',
    old_value: 'Telecinese',
    new_value: 'Magia do caos',
    changed_at: minAfter(75),
  },
  {
    hero_id: HERO_IDS.steve,
    field: 'is_active',
    old_value: 'true',
    new_value: 'false',
    changed_at: minAfter(35),
  },
];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function buildShowcaseMissions(anchor: Date = new Date()): readonly ShowcaseMissionDef[] {
  const baseMs = anchor.getTime();
  const offset = (ms: number) => new Date(baseMs + ms);

  return [
    {
      id: '30000000-0000-4000-8000-000000000001',
      title: 'Operação Escudo Orbital',
      starts_at: offset(1 * DAY_MS),
      ends_at: offset(1 * DAY_MS + 3 * HOUR_MS),
      status: 'scheduled',
      created_at: offset(-2 * HOUR_MS),
      hero_ids: [HERO_IDS.tony, HERO_IDS.bruce],
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      title: 'Defesa de Wakanda',
      starts_at: offset(2 * DAY_MS),
      ends_at: offset(2 * DAY_MS + 4 * HOUR_MS),
      status: 'scheduled',
      created_at: offset(-3 * HOUR_MS),
      hero_ids: [HERO_IDS.tchalla, HERO_IDS.ororo],
    },
    {
      id: '30000000-0000-4000-8000-000000000003',
      title: 'Recrutamento em Metrópolis',
      starts_at: offset(5 * DAY_MS),
      ends_at: offset(5 * DAY_MS + 2 * HOUR_MS),
      status: 'scheduled',
      created_at: offset(-4 * HOUR_MS),
      hero_ids: [],
    },
    {
      id: '30000000-0000-4000-8000-000000000004',
      title: 'Contenção do Portal Dimensional',
      starts_at: offset(-2 * HOUR_MS),
      ends_at: offset(4 * HOUR_MS),
      status: 'in_progress',
      created_at: offset(-1 * DAY_MS),
      hero_ids: [HERO_IDS.wanda, HERO_IDS.peter],
    },
    {
      id: '30000000-0000-4000-8000-000000000005',
      title: 'Resgate na Fossa das Marianas',
      starts_at: offset(-1 * HOUR_MS),
      ends_at: offset(6 * HOUR_MS),
      status: 'in_progress',
      created_at: offset(-1 * DAY_MS - HOUR_MS),
      hero_ids: [HERO_IDS.diana, HERO_IDS.clark],
    },
    {
      id: '30000000-0000-4000-8000-000000000006',
      title: 'Incursão na Base Ártica',
      starts_at: offset(-7 * DAY_MS),
      ends_at: offset(-7 * DAY_MS + 5 * HOUR_MS),
      status: 'succeeded',
      created_at: offset(-8 * DAY_MS),
      hero_ids: [HERO_IDS.natasha, HERO_IDS.logan],
    },
    {
      id: '30000000-0000-4000-8000-000000000007',
      title: 'Evacuação de Sokovia',
      starts_at: offset(-3 * DAY_MS),
      ends_at: offset(-3 * DAY_MS + 4 * HOUR_MS),
      status: 'succeeded',
      created_at: offset(-4 * DAY_MS),
      hero_ids: [HERO_IDS.tony, HERO_IDS.bruce, HERO_IDS.wanda],
    },
    {
      id: '30000000-0000-4000-8000-000000000008',
      title: 'Interceptação do Meteoro Ômega',
      starts_at: offset(-5 * DAY_MS),
      ends_at: offset(-5 * DAY_MS + 3 * HOUR_MS),
      status: 'failed',
      created_at: offset(-6 * DAY_MS),
      hero_ids: [HERO_IDS.clark, HERO_IDS.diana],
    },
    {
      id: '30000000-0000-4000-8000-000000000009',
      title: 'Patrulha Noturna no Setor 7',
      starts_at: offset(-2 * DAY_MS),
      ends_at: offset(-2 * DAY_MS + 2 * HOUR_MS),
      status: 'cancelled',
      created_at: offset(-3 * DAY_MS),
      hero_ids: [HERO_IDS.peter],
    },
  ];
}

export const SHOWCASE_IMPORTS: readonly ShowcaseImportDef[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    filename: 'novos-recrutas-2026.csv',
    status: 'completed',
    total_rows: 15,
    processed_rows: 15,
    imported_count: 12,
    duplicate_count: 2,
    error_count: 1,
    errors: [{ line: 8, message: 'A data de nascimento não pode ser no futuro.' }],
    created_at: minAfter(140),
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    filename: 'reforcos-multiverso.csv',
    status: 'completed',
    total_rows: 50,
    processed_rows: 50,
    imported_count: 48,
    duplicate_count: 2,
    error_count: 0,
    errors: [],
    created_at: minAfter(135),
  },
];

// Minimal CRC32 table for generating real solid-color 32x32 PNGs without external dependencies.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

export function createSolidPng(rgb: readonly [number, number, number], size = 32): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = 1 + size * 3;
  const raw = Buffer.allocUnsafe(stride * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type None
    for (let x = 0; x < size; x += 1) {
      const px = rowStart + 1 + x * 3;
      const border = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
      raw[px] = border ? 245 : rgb[0];
      raw[px + 1] = border ? 245 : rgb[1];
      raw[px + 2] = border ? 245 : rgb[2];
    }
  }

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function seedDevData(pool: Pool, anchor: Date = new Date()): Promise<SeedDevSummary> {
  const avatarNow = new Date(SHOWCASE_BASE);
  const avatarRows = SHOWCASE_AVATARS.map((avatar) => [
    avatar.id,
    'image/png',
    createSolidPng(avatar.rgb),
    avatarNow,
  ]);
  const avatarRes = await execute(
    pool,
    'INSERT IGNORE INTO avatars (id, mime_type, content, created_at) VALUES ?',
    [avatarRows],
  );

  const heroRows = SHOWCASE_HEROES.map((hero) => [
    hero.id,
    hero.name,
    hero.nickname,
    hero.date_of_birth,
    hero.universe,
    hero.main_power,
    hero.avatar_url,
    hero.is_active,
    hero.version,
    hero.created_at,
    hero.created_at,
    hero.deleted_at,
  ]);
  const heroRes = await execute(
    pool,
    `INSERT IGNORE INTO heroes (
      id, name, nickname, date_of_birth, universe, main_power, avatar_url,
      is_active, version, created_at, updated_at, deleted_at
    ) VALUES ?`,
    [heroRows],
  );

  // Resolve actual IDs in case a showcase hero already existed under another UUID (uq_heroes_identity).
  const showcaseIds = SHOWCASE_HEROES.map((hero) => hero.id);
  const presentRows = await selectRows(
    pool,
    z.object({ id: z.string() }),
    'SELECT id FROM heroes WHERE id IN (?)',
    [showcaseIds],
  );
  const presentIdSet = new Set(presentRows.map((row) => row.id));
  const resolvedHeroId = new Map<string, string>();
  for (const hero of SHOWCASE_HEROES) {
    if (presentIdSet.has(hero.id)) {
      resolvedHeroId.set(hero.id, hero.id);
      continue;
    }
    const matched = await selectRows(
      pool,
      z.object({ id: z.string() }),
      'SELECT id FROM heroes WHERE name = ? AND nickname = ? AND date_of_birth = ? AND deleted_at IS NULL LIMIT 1',
      [hero.name, hero.nickname, hero.date_of_birth],
    );
    if (matched[0]) {
      resolvedHeroId.set(hero.id, matched[0].id);
    }
  }

  // hero_history has AUTO_INCREMENT PK; only seed once per hero_id to stay idempotent.
  const historyCandidates = SHOWCASE_HISTORY.flatMap((entry) => {
    const actualHeroId = resolvedHeroId.get(entry.hero_id);
    return actualHeroId ? [{ ...entry, hero_id: actualHeroId }] : [];
  });
  const seededHeroIds = Array.from(new Set(historyCandidates.map((entry) => entry.hero_id)));
  const existingHistoryRows =
    seededHeroIds.length > 0
      ? await selectRows(
          pool,
          z.object({ hero_id: z.string() }),
          'SELECT DISTINCT hero_id FROM hero_history WHERE hero_id IN (?)',
          [seededHeroIds],
        )
      : [];
  const heroesWithHistory = new Set(existingHistoryRows.map((row) => row.hero_id));
  const pendingHistory = historyCandidates.filter(
    (entry) => !heroesWithHistory.has(entry.hero_id),
  );
  let historyCount = 0;
  if (pendingHistory.length > 0) {
    const historyRes = await execute(
      pool,
      'INSERT INTO hero_history (hero_id, field, old_value, new_value, changed_at) VALUES ?',
      [pendingHistory.map((h) => [h.hero_id, h.field, h.old_value, h.new_value, h.changed_at])],
    );
    historyCount = historyRes.affectedRows;
  }

  const missions = buildShowcaseMissions(anchor);
  const missionRows = missions.map((mission) => [
    mission.id,
    mission.title,
    mission.starts_at,
    mission.ends_at,
    mission.status,
    mission.created_at,
    mission.created_at,
  ]);
  const missionRes = await execute(
    pool,
    `INSERT IGNORE INTO missions (
      id, title, starts_at, ends_at, status, created_at, updated_at
    ) VALUES ?`,
    [missionRows],
  );

  const rosterRows = missions.flatMap((mission) =>
    mission.hero_ids.flatMap((heroId) => {
      const actualHeroId = resolvedHeroId.get(heroId);
      return actualHeroId ? [[mission.id, actualHeroId, mission.created_at]] : [];
    }),
  );
  let missionHeroesCount = 0;
  if (rosterRows.length > 0) {
    const rosterRes = await execute(
      pool,
      'INSERT IGNORE INTO mission_heroes (mission_id, hero_id, assigned_at) VALUES ?',
      [rosterRows],
    );
    missionHeroesCount = rosterRes.affectedRows;
  }

  const importRows = SHOWCASE_IMPORTS.map((job) => [
    job.id,
    job.filename,
    job.status,
    job.total_rows,
    job.processed_rows,
    job.imported_count,
    job.duplicate_count,
    job.error_count,
    JSON.stringify(job.errors),
    null,
    job.created_at,
    job.created_at,
  ]);
  const importRes = await execute(
    pool,
    `INSERT IGNORE INTO hero_imports (
      id, filename, status, total_rows, processed_rows,
      imported_count, duplicate_count, error_count, errors, failure_reason,
      created_at, updated_at
    ) VALUES ?`,
    [importRows],
  );

  return {
    avatars: avatarRes.affectedRows,
    heroes: heroRes.affectedRows,
    history: historyCount,
    missions: missionRes.affectedRows,
    missionHeroes: missionHeroesCount,
    imports: importRes.affectedRows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool(z.string().min(1).parse(process.env.DATABASE_URL), 2);
  const startedAt = performance.now();
  const summary = await seedDevData(pool);
  console.log(
    `Seed DEV concluído em ${Math.round(performance.now() - startedAt)} ms | ` +
      `avatars=${summary.avatars} heroes=${summary.heroes} history=${summary.history} ` +
      `missions=${summary.missions} escalacoes=${summary.missionHeroes} imports=${summary.imports}`,
  );
  await pool.end();
}
