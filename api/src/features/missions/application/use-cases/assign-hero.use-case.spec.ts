import { describe, expect, it, vi } from 'vitest';
import type { MysqlTransactionManager, Tx } from '../../../../core/database/mysql-transaction.manager.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import type { HeroFacadeService } from '../../../heroes/index.js';
import { MissionEntity } from '../../domain/entities/mission.entity.js';
import type { IMissionRepository } from '../../domain/ports/mission-repository.port.js';
import { AssignHeroUseCase } from './assign-hero.use-case.js';

const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const HERO_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MISSION_ID = '33333333-3333-4333-8333-333333333333';

function makeMission(overrides: Partial<MissionEntity> = {}): MissionEntity {
  return new MissionEntity({
    id: overrides.id ?? MISSION_ID,
    title: overrides.title ?? 'Operação Aurora',
    starts_at: overrides.starts_at ?? new Date('2026-12-01T10:00:00.000Z'),
    ends_at: overrides.ends_at ?? new Date('2026-12-01T12:00:00.000Z'),
    status: overrides.status ?? 'scheduled',
    heroes: overrides.heroes ?? [],
  });
}

describe('AssignHeroUseCase', () => {
  it('locks hero before mission, checks overlap, and assigns hero', async () => {
    const order: string[] = [];
    const fakeTx = {} as Tx;
    const txManager = {
      run: vi.fn(async (work: (tx: Tx) => Promise<unknown>) => work(fakeTx)),
    } as unknown as MysqlTransactionManager;

    const heroFacade = {
      parseHeroId: vi.fn((id: string) => id),
      lockActiveHeroForMission: vi.fn(async () => {
        order.push('lockHero');
      }),
    } as unknown as HeroFacadeService;

    const initialMission = makeMission();
    const updatedMission = makeMission({ heroes: [{ id: HERO_ID, nickname: 'Thor' }] });

    const missionRepo: Partial<IMissionRepository> = {
      lockById: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push('lockMission');
          return initialMission;
        })
        .mockResolvedValueOnce(updatedMission),
      findOverlappingActiveMission: vi.fn(async () => null),
      addHero: vi.fn(async () => 'added' as const),
    };

    const useCase = new AssignHeroUseCase(
      missionRepo as IMissionRepository,
      heroFacade,
      txManager,
    );

    const result = await useCase.execute(MISSION_ID, HERO_ID);

    expect(order).toEqual(['lockHero', 'lockMission']);
    expect(result.heroes).toEqual([{ id: HERO_ID, nickname: 'Thor' }]);
  });

  it('throws MISSION_SCHEDULE_CONFLICT with conflicting_mission details on overlap', async () => {
    const fakeTx = {} as Tx;
    const txManager = {
      run: vi.fn(async (work: (tx: Tx) => Promise<unknown>) => work(fakeTx)),
    } as unknown as MysqlTransactionManager;

    const heroFacade = {
      parseHeroId: vi.fn((id: string) => id),
      lockActiveHeroForMission: vi.fn(async () => undefined),
    } as unknown as HeroFacadeService;

    const overlapping = makeMission({ id: OTHER_MISSION_ID, title: 'Defesa Orbital' });
    const missionRepo: Partial<IMissionRepository> = {
      lockById: vi.fn(async () => makeMission()),
      findOverlappingActiveMission: vi.fn(async () => overlapping),
    };

    const useCase = new AssignHeroUseCase(
      missionRepo as IMissionRepository,
      heroFacade,
      txManager,
    );

    await expect(useCase.execute(MISSION_ID, HERO_ID)).rejects.toMatchObject({
      kind: 'conflict',
      code: 'MISSION_SCHEDULE_CONFLICT',
      extra: {
        details: {
          conflicting_mission: {
            id: OTHER_MISSION_ID,
            title: 'Defesa Orbital',
          },
        },
      },
    } satisfies Partial<DomainError>);
  });

  it('throws HERO_ALREADY_ASSIGNED if hero is already in roster', async () => {
    const fakeTx = {} as Tx;
    const txManager = {
      run: vi.fn(async (work: (tx: Tx) => Promise<unknown>) => work(fakeTx)),
    } as unknown as MysqlTransactionManager;

    const heroFacade = {
      parseHeroId: vi.fn((id: string) => id),
      lockActiveHeroForMission: vi.fn(async () => undefined),
    } as unknown as HeroFacadeService;

    const missionRepo: Partial<IMissionRepository> = {
      lockById: vi.fn(async () =>
        makeMission({ heroes: [{ id: HERO_ID, nickname: 'Thor' }] }),
      ),
    };

    const useCase = new AssignHeroUseCase(
      missionRepo as IMissionRepository,
      heroFacade,
      txManager,
    );

    await expect(useCase.execute(MISSION_ID, HERO_ID)).rejects.toMatchObject({
      kind: 'conflict',
      code: 'HERO_ALREADY_ASSIGNED',
    });
  });
});
