import { describe, expect, it, vi } from 'vitest';
import { MissionEntity } from '../domain/entities/mission.entity.js';
import { MissionsController } from './missions.controller.js';

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const HERO_ID = '22222222-2222-4222-8222-222222222222';

function makeEntity(): MissionEntity {
  return new MissionEntity({
    id: MISSION_ID,
    title: 'Patrulha Norte',
    starts_at: new Date('2026-12-01T10:00:00.000Z'),
    ends_at: new Date('2026-12-01T12:00:00.000Z'),
    status: 'scheduled',
    heroes: [{ id: HERO_ID, nickname: 'Thor' }],
  });
}

describe('MissionsController', () => {
  it('maps mission entity to response DTO across endpoints', async () => {
    const entity = makeEntity();
    const createMission = { execute: vi.fn(async () => entity) };
    const getMission = { execute: vi.fn(async () => entity) };
    const listMissions = {
      execute: vi.fn(async () => ({ data: [entity], next_cursor: null })),
    };
    const listHeroMissions = {
      execute: vi.fn(async () => ({ data: [entity], next_cursor: null })),
    };
    const assignHero = { execute: vi.fn(async () => entity) };
    const removeHero = { execute: vi.fn(async () => entity) };
    const startMission = { execute: vi.fn(async () => entity) };
    const finishMission = { execute: vi.fn(async () => entity) };
    const cancelMission = { execute: vi.fn(async () => entity) };

    const controller = new MissionsController(
      createMission as never,
      getMission as never,
      listMissions as never,
      listHeroMissions as never,
      assignHero as never,
      removeHero as never,
      startMission as never,
      finishMission as never,
      cancelMission as never,
    );

    const created = await controller.createMission({
      title: 'Patrulha Norte',
      starts_at: '2026-12-01T10:00:00.000Z',
      ends_at: '2026-12-01T12:00:00.000Z',
    });
    expect(created.id).toBe(MISSION_ID);
    expect(created.starts_at).toBe('2026-12-01T10:00:00.000Z');

    const page = await controller.listMissions({ limit: 10 });
    expect(page.data).toHaveLength(1);
    expect(page.next_cursor).toBeNull();

    const heroPage = await controller.listHeroMissions(HERO_ID, { limit: 10 });
    expect(heroPage.data).toHaveLength(1);

    const assigned = await controller.assignHero(MISSION_ID, { hero_id: HERO_ID });
    expect(assigned.heroes[0]?.nickname).toBe('Thor');

    await controller.removeHero(MISSION_ID, HERO_ID);
    await controller.startMission(MISSION_ID);
    await controller.finishMission(MISSION_ID, { result: 'succeeded' });
    await controller.cancelMission(MISSION_ID);

    expect(removeHero.execute).toHaveBeenCalledWith(MISSION_ID, HERO_ID);
    expect(startMission.execute).toHaveBeenCalledWith(MISSION_ID);
    expect(finishMission.execute).toHaveBeenCalledWith(MISSION_ID, 'succeeded');
    expect(cancelMission.execute).toHaveBeenCalledWith(MISSION_ID);
  });
});

