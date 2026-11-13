import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { createNestApp, type AppInstance } from '../src/app-bootstrap.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedHeroes } from '../src/db/seed.js';
import { createPool, execute } from '../src/core/database/mysql-database.service.js';
import { assertSafeTestDatabase } from './circuit-breaker.js';

// Mandatory fail-safe circuit breaker before any connection or migration
const TEST_DB_URL = assertSafeTestDatabase(process.env);

const heroResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string(),
  date_of_birth: z.string(),
  universe: z.string(),
  main_power: z.string(),
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const heroPageSchema = z.object({
  data: z.array(heroResponseSchema),
  next_cursor: z.string().nullable(),
});

const historyPageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      field: z.string(),
      old_value: z.string().nullable(),
      new_value: z.string().nullable(),
      changed_at: z.string(),
    }),
  ),
  next_cursor: z.string().nullable(),
});

const missionResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(['scheduled', 'in_progress', 'succeeded', 'failed', 'cancelled']),
  heroes: z.array(z.object({ id: z.string(), nickname: z.string() })),
});

const importResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  total_rows: z.number(),
  processed_rows: z.number(),
  imported_count: z.number(),
  duplicate_count: z.number(),
  error_count: z.number(),
  errors: z.array(z.object({ line: z.number(), message: z.string() })),
});

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

describe('Integration Suite — Multi-Instance API & MySQL 8 Concurrency Guarantees', () => {
  let pool1: Pool;
  let pool2: Pool;
  let instance1: AppInstance;
  let instance2: AppInstance;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    pool1 = createPool(TEST_DB_URL, 10);
    pool2 = createPool(TEST_DB_URL, 10);
    instance1 = await createNestApp(pool1, 'api1');
    instance2 = await createNestApp(pool2, 'api2');
  });

  beforeEach(async () => {
    await execute(pool1, 'DELETE FROM mission_heroes');
    await execute(pool1, 'DELETE FROM missions');
    await execute(pool1, 'DELETE FROM hero_history');
    await execute(pool1, 'DELETE FROM heroes');
    await execute(pool1, 'DELETE FROM hero_imports');
    await execute(pool1, 'DELETE FROM avatars');
  });

  afterAll(async () => {
    await instance1.close();
    await instance2.close();
    await pool1.end();
    await pool2.end();
  });

  describe('Block 1: Happy Path Specifications', () => {
    it('should create a hero, search case/accent-insensitively (joao -> João), and paginate with ties without duplicates', async () => {
      // Arrange
      const sameTimestamp = new Date('2026-05-01T12:00:00.000Z');
      const heroNames = ['João da Silva', 'Joana Prado', 'Carlos Magno', 'Bárbara Luz', 'Luís Fernando'];
      for (let idx = 0; idx < heroNames.length; idx += 1) {
        await execute(
          pool1,
          `INSERT INTO heroes (id, name, nickname, date_of_birth, universe, main_power, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, '1985-04-10', 'Marvel', 'Força', NULL, ?, ?)`,
          [
            `00000000-0000-4000-8000-00000000000${idx + 1}`,
            heroNames[idx],
            `Herói ${idx + 1}`,
            sameTimestamp,
            sameTimestamp,
          ],
        );
      }

      // Act — Search "joao" without accent or uppercase
      const searchRes = await instance1.inject({
        method: 'GET',
        url: '/heroes?search=joao',
      });
      const searchBody = heroPageSchema.parse(searchRes.json());

      // Act — Paginate 2 by 2 across 5 heroes created in the exact same millisecond
      const collectedIds: string[] = [];
      let cursor: string | null = null;
      do {
        const url: string = cursor ? `/heroes?limit=2&cursor=${encodeURIComponent(cursor)}` : '/heroes?limit=2';
        const pageRes = await instance2.inject({ method: 'GET', url });
        const page = heroPageSchema.parse(pageRes.json());
        collectedIds.push(...page.data.map((h) => h.id));
        cursor = page.next_cursor;
      } while (cursor !== null);

      // Assert
      expect(searchRes.statusCode).toBe(200);
      expect(searchBody.data).toHaveLength(1);
      expect(searchBody.data[0]?.name).toBe('João da Silva');
      expect(collectedIds).toHaveLength(5);
      expect(new Set(collectedIds).size).toBe(5);
    });

    it('should record field-by-field history on edit, deactivation, and activation, with filtering', async () => {
      // Arrange
      const createRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Robert Bruce Banner',
          nickname: 'Hulk',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
        },
      });
      const created = heroResponseSchema.parse(createRes.json());

      // Act
      await instance1.inject({
        method: 'PATCH',
        url: `/heroes/${created.id}`,
        payload: { nickname: 'Hulk Verde', universe: 'Marvel 616', version: created.version },
      });
      await instance2.inject({ method: 'POST', url: `/heroes/${created.id}/deactivate` });
      await instance1.inject({ method: 'POST', url: `/heroes/${created.id}/activate` });

      const allHistoryRes = await instance2.inject({
        method: 'GET',
        url: `/heroes/${created.id}/history`,
      });
      const nickHistoryRes = await instance1.inject({
        method: 'GET',
        url: `/heroes/${created.id}/history?field=nickname`,
      });

      // Assert
      const allHistory = historyPageSchema.parse(allHistoryRes.json());
      const nickHistory = historyPageSchema.parse(nickHistoryRes.json());
      expect(allHistory.data).toHaveLength(4);
      expect(nickHistory.data).toHaveLength(1);
      expect(nickHistory.data[0]?.old_value).toBe('Hulk');
      expect(nickHistory.data[0]?.new_value).toBe('Hulk Verde');
    });

    it('should hide soft-deleted heroes from list and search while preserving their nickname in missions', async () => {
      // Arrange
      const heroRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Natasha Romanoff',
          nickname: 'Viúva Negra',
          date_of_birth: '1984-11-22',
          universe: 'Marvel',
          main_power: 'Espionagem',
        },
      });
      const hero = heroResponseSchema.parse(heroRes.json());

      const missionRes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Operação Budapeste',
          starts_at: '2026-11-03T10:00:00.000Z',
          ends_at: '2026-11-03T12:00:00.000Z',
        },
      });
      const mission = missionResponseSchema.parse(missionRes.json());

      await instance1.inject({
        method: 'POST',
        url: `/missions/${mission.id}/heroes`,
        payload: { hero_id: hero.id },
      });

      // Act — Delete the hero
      const deleteRes = await instance2.inject({
        method: 'DELETE',
        url: `/heroes/${hero.id}`,
      });
      const getHeroRes = await instance1.inject({ method: 'GET', url: `/heroes/${hero.id}` });
      const getHeroMissionsRes = await instance1.inject({
        method: 'GET',
        url: `/heroes/${hero.id}/missions`,
      });
      const listHeroesRes = await instance1.inject({ method: 'GET', url: '/heroes?search=Natasha' });
      const getMissionRes = await instance2.inject({ method: 'GET', url: `/missions/${mission.id}` });

      // Assert
      expect(deleteRes.statusCode).toBe(204);
      expect(getHeroRes.statusCode).toBe(404);
      expect(getHeroMissionsRes.statusCode).toBe(404);
      expect(heroPageSchema.parse(listHeroesRes.json()).data).toHaveLength(0);
      const updatedMission = missionResponseSchema.parse(getMissionRes.json());
      expect(updatedMission.heroes).toEqual([{ id: hero.id, nickname: 'Viúva Negra' }]);
    });

    it('should allow adjacent mission schedules (10h-12h and 12h-14h) and freeing schedule after mission finishes', async () => {
      // Arrange
      const thorRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Thor Odinson',
          nickname: 'Thor',
          date_of_birth: '1962-08-01',
          universe: 'Marvel',
          main_power: 'Trovão',
        },
      });
      const thor = heroResponseSchema.parse(thorRes.json());

      const missionARes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Missão A (10h-12h)',
          starts_at: '2026-11-03T10:00:00.000Z',
          ends_at: '2026-11-03T12:00:00.000Z',
        },
      });
      const missionA = missionResponseSchema.parse(missionARes.json());

      const missionCRes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Missão C (12h-14h)',
          starts_at: '2026-11-03T12:00:00.000Z',
          ends_at: '2026-11-03T14:00:00.000Z',
        },
      });
      const missionC = missionResponseSchema.parse(missionCRes.json());

      const missionBRes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Missão B (11h-13h)',
          starts_at: '2026-11-03T11:00:00.000Z',
          ends_at: '2026-11-03T13:00:00.000Z',
        },
      });
      const missionB = missionResponseSchema.parse(missionBRes.json());

      // Act — Assign Thor to A (10-12) and C (12-14)
      const assignARes = await instance1.inject({
        method: 'POST',
        url: `/missions/${missionA.id}/heroes`,
        payload: { hero_id: thor.id },
      });
      const assignCRes = await instance2.inject({
        method: 'POST',
        url: `/missions/${missionC.id}/heroes`,
        payload: { hero_id: thor.id },
      });

      // Start and finish both A and C, then assign Thor to B (11-13)
      await instance1.inject({ method: 'POST', url: `/missions/${missionA.id}/start` });
      await instance1.inject({
        method: 'POST',
        url: `/missions/${missionA.id}/finish`,
        payload: { result: 'succeeded' },
      });
      await instance2.inject({ method: 'POST', url: `/missions/${missionC.id}/cancel` });

      const assignBRes = await instance1.inject({
        method: 'POST',
        url: `/missions/${missionB.id}/heroes`,
        payload: { hero_id: thor.id },
      });

      // Assert
      expect(assignARes.statusCode).toBe(200);
      expect(assignCRes.statusCode).toBe(200);
      expect(assignBRes.statusCode).toBe(200);
    });

    it('should import CSV in background, isolate bad rows, and prevent duplicates on re-import', async () => {
      // Arrange
      const csv = [
        'name,nickname,date_of_birth,universe,main_power,avatar_url',
        'Clark Kent,Superman,1938-04-18,DC,Voo,https://exemplo.com/superman.jpg',
        '',
        'Bruce Wayne,Batman,1939-03-30,DC,Inteligência,',
        'Herói do Futuro,Viajante,2099-01-01,DC,Tempo,',
      ].join('\n');

      // Act — First import on api1
      const startRes = await instance1.inject({
        method: 'POST',
        url: '/imports/heroes',
        payload: { filename: 'lote1.csv', csv },
      });
      const initialJob = importResponseSchema.parse(startRes.json());
      await instance1.imports.waitForAll();

      // Poll status from api2
      const statusRes = await instance2.inject({
        method: 'GET',
        url: `/imports/heroes/${initialJob.id}`,
      });
      const completedJob = importResponseSchema.parse(statusRes.json());

      // Re-import the exact same CSV on api2
      const secondRes = await instance2.inject({
        method: 'POST',
        url: '/imports/heroes',
        payload: { filename: 'lote1-repetido.csv', csv },
      });
      const secondJobId = importResponseSchema.parse(secondRes.json()).id;
      await instance2.imports.waitForAll();
      const secondStatusRes = await instance1.inject({
        method: 'GET',
        url: `/imports/heroes/${secondJobId}`,
      });
      const secondCompleted = importResponseSchema.parse(secondStatusRes.json());

      // Assert
      expect(startRes.statusCode).toBe(202);
      expect(completedJob.status).toBe('completed');
      expect(completedJob.imported_count).toBe(2);
      expect(completedJob.duplicate_count).toBe(0);
      expect(completedJob.error_count).toBe(1);
      expect(completedJob.errors[0]?.line).toBe(5);

      expect(secondCompleted.imported_count).toBe(0);
      expect(secondCompleted.duplicate_count).toBe(2);
      expect(secondCompleted.error_count).toBe(1);
    });

    it('should run seedHeroes idempotently without duplicating any records on a second execution', async () => {
      // Arrange & Act
      const firstRun = await seedHeroes(pool1, 150);
      const secondRun = await seedHeroes(pool2, 150);

      // Assert
      expect(firstRun).toBe(150);
      expect(secondRun).toBe(0);
    });
  });

  describe('Block 2: Adverse & Boundary Edge Cases', () => {
    it('should return 404 for unknown resources and 400 with field details for invalid payloads', async () => {
      // Arrange
      const missingId = '00000000-0000-4000-8000-000000000999';

      // Act
      const notFoundHero = await instance1.inject({ method: 'GET', url: `/heroes/${missingId}` });
      const notFoundMission = await instance2.inject({ method: 'GET', url: `/missions/${missingId}` });
      const badCreate = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: { name: '   ', nickname: '', date_of_birth: '2099-01-01', universe: '', main_power: '' },
      });

      // Assert
      expect(notFoundHero.statusCode).toBe(404);
      expect(notFoundMission.statusCode).toBe(404);
      expect(badCreate.statusCode).toBe(400);
      const errBody = errorResponseSchema.parse(badCreate.json());
      expect(errBody.error.code).toBe('VALIDATION_ERROR');
      expect(errBody.error.fields?.map((f) => f.field)).toEqual(
        expect.arrayContaining(['name', 'nickname', 'date_of_birth', 'universe', 'main_power']),
      );

      const missingHeroMissions = await instance1.inject({
        method: 'GET',
        url: `/heroes/${missingId}/missions`,
      });
      expect(missingHeroMissions.statusCode).toBe(404);
      expect(errorResponseSchema.parse(missingHeroMissions.json()).error.code).toBe('HERO_NOT_FOUND');

      const invalidHeroMissions = await instance1.inject({
        method: 'GET',
        url: '/heroes/not-a-uuid/missions',
      });
      expect(invalidHeroMissions.statusCode).toBe(400);
      const invalidHeroErr = errorResponseSchema.parse(invalidHeroMissions.json());
      expect(invalidHeroErr.error.fields?.[0]?.field).toBe('id');
    });

    it('should return 413 for oversized avatars/payloads and 400 (never 500) for malformed multipart or JSON', async () => {
      // Oversized avatar (2.1 MB > MAX_AVATAR_BYTES) -> 413 FILE_TOO_LARGE
      const boundary = '----TestBoundary123';
      const oversizedAvatar = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(2 * 1024 * 1024 + 1024, 0),
      ]);
      const oversizedBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        oversizedAvatar,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const avatarTooBigRes = await instance1.inject({
        method: 'POST',
        url: '/avatars',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: oversizedBody,
      });
      expect(avatarTooBigRes.statusCode).toBe(413);
      expect(errorResponseSchema.parse(avatarTooBigRes.json()).error.code).toBe('FILE_TOO_LARGE');

      // Malformed multipart (missing boundary & truncated body) -> 400 INVALID_PAYLOAD (never 500)
      const missingBoundaryRes = await instance2.inject({
        method: 'POST',
        url: '/avatars',
        headers: { 'content-type': 'multipart/form-data' },
        payload: 'abc',
      });
      expect(missingBoundaryRes.statusCode).toBe(400);
      expect(errorResponseSchema.parse(missingBoundaryRes.json()).error.code).toBe('INVALID_PAYLOAD');

      const truncatedMultipartRes = await instance2.inject({
        method: 'POST',
        url: '/avatars',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\nabc`,
      });
      expect(truncatedMultipartRes.statusCode).toBe(400);
      expect(errorResponseSchema.parse(truncatedMultipartRes.json()).error.code).toBe('INVALID_PAYLOAD');

      // Prototype violation in multipart -> 400 INVALID_PAYLOAD
      const protoRes = await instance2.inject({
        method: 'POST',
        url: '/avatars',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: `--${boundary}\r\nContent-Disposition: form-data; name="__proto__"\r\n\r\n1\r\n--${boundary}--\r\n`,
      });
      expect(protoRes.statusCode).toBe(400);
      expect(errorResponseSchema.parse(protoRes.json()).error.code).toBe('INVALID_PAYLOAD');

      // Oversized JSON (> 15 MB bodyLimit) -> 413 FILE_TOO_LARGE
      const oversizedJsonRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        headers: { 'content-type': 'application/json' },
        payload: `{"name":"${'A'.repeat(16 * 1024 * 1024)}"}`,
      });
      expect(oversizedJsonRes.statusCode).toBe(413);
      expect(errorResponseSchema.parse(oversizedJsonRes.json()).error.code).toBe('FILE_TOO_LARGE');

      // Multiple files in multipart (FST_FILES_LIMIT) -> 400 INVALID_PAYLOAD (never 500)
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const multiFileBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file1"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        validPng,
        Buffer.from(
          `\r\n--${boundary}\r\nContent-Disposition: form-data; name="file2"; filename="b.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        validPng,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const multiFileRes = await instance2.inject({
        method: 'POST',
        url: '/avatars',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: multiFileBody,
      });
      expect(multiFileRes.statusCode).toBe(400);
      expect(errorResponseSchema.parse(multiFileRes.json()).error.code).toBe('INVALID_PAYLOAD');

      // Malformed JSON -> 400 INVALID_PAYLOAD
      const malformedJsonRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        headers: { 'content-type': 'application/json' },
        payload: '{"name": ',
      });
      expect(malformedJsonRes.statusCode).toBe(400);
      expect(errorResponseSchema.parse(malformedJsonRes.json()).error.code).toBe('INVALID_PAYLOAD');
    });

    it('should forbid editing an inactive hero or assigning an inactive hero to a mission', async () => {
      // Arrange
      const createRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Stephen Strange',
          nickname: 'Doutor Estranho',
          date_of_birth: '1930-11-18',
          universe: 'Marvel',
          main_power: 'Magia',
        },
      });
      const hero = heroResponseSchema.parse(createRes.json());
      await instance1.inject({ method: 'POST', url: `/heroes/${hero.id}/deactivate` });

      const missionRes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Defender o Sanctum',
          starts_at: '2026-11-03T13:00:00.000Z',
          ends_at: '2026-11-03T15:00:00.000Z',
        },
      });
      const mission = missionResponseSchema.parse(missionRes.json());

      // Act
      const editInactiveRes = await instance2.inject({
        method: 'PATCH',
        url: `/heroes/${hero.id}`,
        payload: { nickname: 'Mago Supremo', version: 2 },
      });
      const assignInactiveRes = await instance2.inject({
        method: 'POST',
        url: `/missions/${mission.id}/heroes`,
        payload: { hero_id: hero.id },
      });

      // Assert
      expect(editInactiveRes.statusCode).toBe(409);
      expect(errorResponseSchema.parse(editInactiveRes.json()).error.code).toBe('HERO_INACTIVE');
      expect(assignInactiveRes.statusCode).toBe(409);
      expect(errorResponseSchema.parse(assignInactiveRes.json()).error.code).toBe('HERO_INACTIVE');
    });

    it('should forbid starting an empty mission or changing heroes after mission has started', async () => {
      // Arrange
      const heroRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Wanda Maximoff',
          nickname: 'Feiticeira Escarlate',
          date_of_birth: '1989-02-10',
          universe: 'Marvel',
          main_power: 'Magia do Caos',
        },
      });
      const hero = heroResponseSchema.parse(heroRes.json());

      const missionRes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Proteger Westview',
          starts_at: '2026-11-03T13:00:00.000Z',
          ends_at: '2026-11-03T15:00:00.000Z',
        },
      });
      const mission = missionResponseSchema.parse(missionRes.json());

      // Act — Try starting with 0 heroes
      const emptyStartRes = await instance1.inject({
        method: 'POST',
        url: `/missions/${mission.id}/start`,
      });

      // Assign hero, start mission, then try removing hero while in_progress
      await instance1.inject({
        method: 'POST',
        url: `/missions/${mission.id}/heroes`,
        payload: { hero_id: hero.id },
      });
      await instance1.inject({ method: 'POST', url: `/missions/${mission.id}/start` });
      const removeAfterStartRes = await instance2.inject({
        method: 'DELETE',
        url: `/missions/${mission.id}/heroes/${hero.id}`,
      });

      // Assert
      expect(emptyStartRes.statusCode).toBe(409);
      expect(errorResponseSchema.parse(emptyStartRes.json()).error.code).toBe('MISSION_REQUIRES_HERO');
      expect(removeAfterStartRes.statusCode).toBe(409);
      expect(errorResponseSchema.parse(removeAfterStartRes.json()).error.code).toBe('MISSION_NOT_SCHEDULED');
    });
  });

  describe('Block 3: Security & Concurrency Exploits (Multi-Instance Race Conditions)', () => {
    it('should create only ONE hero when Save is clicked twice or retried after network drop across api1 and api2', async () => {
      // Arrange
      const idempotencyKey = 'modal-save-key-001';
      const payload = {
        name: 'Robert Bruce Banner',
        nickname: 'Hulk',
        date_of_birth: '1962-04-10',
        universe: 'Marvel',
        main_power: 'Força',
      };

      // Act — Simultaneous double click routed to api1 and api2
      const [res1, res2] = await Promise.all([
        instance1.inject({
          method: 'POST',
          url: '/heroes',
          headers: { 'idempotency-key': idempotencyKey },
          payload,
        }),
        instance2.inject({
          method: 'POST',
          url: '/heroes',
          headers: { 'idempotency-key': idempotencyKey },
          payload,
        }),
      ]);

      // Act — Retry after network drop with the same Idempotency-Key
      const retryRes = await instance2.inject({
        method: 'POST',
        url: '/heroes',
        headers: { 'idempotency-key': idempotencyKey },
        payload,
      });

      const listRes = await instance1.inject({ method: 'GET', url: '/heroes' });
      const list = heroPageSchema.parse(listRes.json());

      // Assert
      expect([res1.statusCode, res2.statusCode].sort()).toEqual([200, 201]);
      expect(retryRes.statusCode).toBe(200);
      const hero1 = heroResponseSchema.parse(res1.json());
      const hero2 = heroResponseSchema.parse(res2.json());
      const heroRetry = heroResponseSchema.parse(retryRes.json());
      expect(hero1.id).toBe(hero2.id);
      expect(heroRetry.id).toBe(hero1.id);
      expect(list.data).toHaveLength(1);
    });

    it('should detect concurrent edits (Ana & Bruno) via optimistic locking and allow merging without data loss', async () => {
      // Arrange — Create Hulk (version 1)
      const createRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Robert Bruce Banner',
          nickname: 'Hulk',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
        },
      });
      const hulkV1 = heroResponseSchema.parse(createRes.json());

      // Act — 1. Ana changes nickname to "Hulk Verde" on api1 (succeeds -> version 2)
      const anaRes = await instance1.inject({
        method: 'PATCH',
        url: `/heroes/${hulkV1.id}`,
        payload: { nickname: 'Hulk Verde', version: hulkV1.version },
      });
      const hulkV2 = heroResponseSchema.parse(anaRes.json());

      // Act — 2. Bruno changes universe to "Marvel 616" on api2 still holding version 1 (conflicts!)
      const brunoConflictRes = await instance2.inject({
        method: 'PATCH',
        url: `/heroes/${hulkV1.id}`,
        payload: { universe: 'Marvel 616', version: hulkV1.version },
      });

      // Act — 3. Bruno refreshes from conflict details and applies his universe change onto version 2
      const brunoMergedRes = await instance2.inject({
        method: 'PATCH',
        url: `/heroes/${hulkV1.id}`,
        payload: { universe: 'Marvel 616', version: hulkV2.version },
      });
      const hulkV3 = heroResponseSchema.parse(brunoMergedRes.json());

      // Assert
      expect(anaRes.statusCode).toBe(200);
      expect(hulkV2.version).toBe(2);
      expect(brunoConflictRes.statusCode).toBe(409);
      expect(errorResponseSchema.parse(brunoConflictRes.json()).error.code).toBe('HERO_VERSION_CONFLICT');
      expect(brunoMergedRes.statusCode).toBe(200);
      expect(hulkV3.version).toBe(3);
      expect(hulkV3.nickname).toBe('Hulk Verde'); // Ana's edit preserved
      expect(hulkV3.universe).toBe('Marvel 616'); // Bruno's edit preserved
    });

    it('should allow ONLY ONE assignment when Ana (api1) and Bruno (api2) assign Thor to overlapping missions at the same instant', async () => {
      // Arrange
      const thorRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          name: 'Thor Odinson',
          nickname: 'Thor',
          date_of_birth: '1962-08-01',
          universe: 'Marvel',
          main_power: 'Trovão',
        },
      });
      const thor = heroResponseSchema.parse(thorRes.json());

      const missionARes = await instance1.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Missão A (10h-12h)',
          starts_at: '2026-11-03T10:00:00.000Z',
          ends_at: '2026-11-03T12:00:00.000Z',
        },
      });
      const missionA = missionResponseSchema.parse(missionARes.json());

      const missionBRes = await instance2.inject({
        method: 'POST',
        url: '/missions',
        payload: {
          title: 'Missão B (11h-13h)',
          starts_at: '2026-11-03T11:00:00.000Z',
          ends_at: '2026-11-03T13:00:00.000Z',
        },
      });
      const missionB = missionResponseSchema.parse(missionBRes.json());

      // Act — Ana on api1 and Bruno on api2 assign Thor simultaneously
      const [anaAssign, brunoAssign] = await Promise.all([
        instance1.inject({
          method: 'POST',
          url: `/missions/${missionA.id}/heroes`,
          payload: { hero_id: thor.id },
        }),
        instance2.inject({
          method: 'POST',
          url: `/missions/${missionB.id}/heroes`,
          payload: { hero_id: thor.id },
        }),
      ]);

      // Assert — Exactly one 200 OK and one 409 MISSION_SCHEDULE_CONFLICT
      const statuses = [anaAssign.statusCode, brunoAssign.statusCode].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictResponse = anaAssign.statusCode === 409 ? anaAssign : brunoAssign;
      const conflictError = errorResponseSchema.parse(conflictResponse.json());
      expect(conflictError.error.code).toBe('MISSION_SCHEDULE_CONFLICT');
      expect(conflictError.error.message).toContain('Choque de horário');
    });

    it('should ignore mass-assigned id/created_at/updated_at and escape SQL LIKE wildcards in search', async () => {
      // Arrange
      const forgedId = '11111111-1111-4111-8111-111111111111';
      const forgedDate = '1999-01-01T00:00:00.000Z';

      // Act
      const createRes = await instance1.inject({
        method: 'POST',
        url: '/heroes',
        payload: {
          id: forgedId,
          name: 'Diana Prince',
          nickname: 'Mulher Maravilha',
          date_of_birth: '1941-10-21',
          universe: 'DC',
          main_power: 'Força Divina',
          created_at: forgedDate,
          updated_at: forgedDate,
        },
      });
      const created = heroResponseSchema.parse(createRes.json());
      const wildcardSearchRes = await instance2.inject({
        method: 'GET',
        url: '/heroes?search=%25', // literal "%"
      });

      // Assert
      expect(created.id).not.toBe(forgedId);
      expect(created.created_at).not.toBe(forgedDate);
      expect(created.updated_at).not.toBe(forgedDate);
      expect(heroPageSchema.parse(wildcardSearchRes.json()).data).toHaveLength(0);
    });
  });
});

