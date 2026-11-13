import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HeroesController } from './heroes.controller.js';
import { HeroEntity } from '../domain/entities/hero.entity.js';
import { HeroHistoryEntity } from '../domain/entities/hero-history.entity.js';

describe('HeroesController', () => {
  let controller: HeroesController;
  let mockCreateHeroUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateHeroUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockListHeroesUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetHeroUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockToggleHeroStatusUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDeleteHeroUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockListHeroHistoryUseCase: { execute: ReturnType<typeof vi.fn> };

  const validHeroId = 'e314636e-1ca6-4925-a0e7-da5eb5ae2403';

  const hero = new HeroEntity({
    id: validHeroId,
    name: 'Robert Bruce Banner',
    nickname: 'Hulk',
    date_of_birth: '1962-04-10',
    universe: 'Marvel',
    main_power: 'Força',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    deleted_at: null,
  });

  beforeEach(() => {
    mockCreateHeroUseCase = { execute: vi.fn() };
    mockUpdateHeroUseCase = { execute: vi.fn() };
    mockListHeroesUseCase = { execute: vi.fn() };
    mockGetHeroUseCase = { execute: vi.fn() };
    mockToggleHeroStatusUseCase = { execute: vi.fn() };
    mockDeleteHeroUseCase = { execute: vi.fn() };
    mockListHeroHistoryUseCase = { execute: vi.fn() };

    controller = new HeroesController(
      mockCreateHeroUseCase as any,
      mockUpdateHeroUseCase as any,
      mockListHeroesUseCase as any,
      mockGetHeroUseCase as any,
      mockToggleHeroStatusUseCase as any,
      mockDeleteHeroUseCase as any,
      mockListHeroHistoryUseCase as any,
    );
  });

  describe('listHeroes', () => {
    it('should return paginated list of heroes', async () => {
      mockListHeroesUseCase.execute.mockResolvedValueOnce({
        data: [hero],
        next_cursor: 'cur-123',
      });

      const result = await controller.listHeroes({ limit: 10 });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(validHeroId);
      expect(result.next_cursor).toBe('cur-123');
    });
  });

  describe('createHero', () => {
    it('should return 201 Created when newly created', async () => {
      mockCreateHeroUseCase.execute.mockResolvedValueOnce({
        hero,
        created: true,
      });

      const req = {
        headers: {
          'idempotency-key': 'key-1',
          'x-timezone': 'America/Sao_Paulo',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      const dto = {
        name: 'Robert Bruce Banner',
        nickname: 'Hulk',
        date_of_birth: '1962-04-10',
        universe: 'Marvel',
        main_power: 'Força',
      };

      await controller.createHero(dto as any, req, res);

      expect(mockCreateHeroUseCase.execute).toHaveBeenCalledWith(dto, {
        idempotencyKey: 'key-1',
        timeZone: 'America/Sao_Paulo',
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 200 OK when idempotent retry returns existing hero', async () => {
      mockCreateHeroUseCase.execute.mockResolvedValueOnce({
        hero,
        created: false,
      });

      const req = { headers: {} } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.createHero({} as any, req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });
  });

  describe('getHero', () => {
    it('should return hero by ID', async () => {
      mockGetHeroUseCase.execute.mockResolvedValueOnce(hero);

      const result = await controller.getHero(validHeroId);
      expect(result.id).toBe(validHeroId);
      expect(mockGetHeroUseCase.execute).toHaveBeenCalledWith(validHeroId);
    });
  });

  describe('updateHero', () => {
    it('should update hero and return response dto', async () => {
      mockUpdateHeroUseCase.execute.mockResolvedValueOnce(hero);
      const req = { headers: { 'x-timezone': 'UTC' } } as unknown as Request;

      const result = await controller.updateHero(validHeroId, { version: 1 } as any, req);
      expect(result.id).toBe(validHeroId);
      expect(mockUpdateHeroUseCase.execute).toHaveBeenCalledWith(
        validHeroId,
        { version: 1 },
        'UTC',
      );
    });
  });

  describe('activateHero & deactivateHero', () => {
    it('should activate hero', async () => {
      mockToggleHeroStatusUseCase.execute.mockResolvedValueOnce(hero);

      const result = await controller.activateHero(validHeroId);
      expect(result.id).toBe(validHeroId);
      expect(mockToggleHeroStatusUseCase.execute).toHaveBeenCalledWith(validHeroId, true);
    });

    it('should deactivate hero', async () => {
      const inactive = new HeroEntity({ ...hero, is_active: false });
      mockToggleHeroStatusUseCase.execute.mockResolvedValueOnce(inactive);

      const result = await controller.deactivateHero(validHeroId);
      expect(result.is_active).toBe(false);
      expect(mockToggleHeroStatusUseCase.execute).toHaveBeenCalledWith(validHeroId, false);
    });
  });

  describe('deleteHero', () => {
    it('should delete hero', async () => {
      mockDeleteHeroUseCase.execute.mockResolvedValueOnce(undefined);

      await controller.deleteHero(validHeroId);
      expect(mockDeleteHeroUseCase.execute).toHaveBeenCalledWith(validHeroId);
    });
  });

  describe('listHeroHistory', () => {
    it('should return paginated history', async () => {
      const historyEntry = new HeroHistoryEntity({
        id: '1',
        hero_id: validHeroId,
        field: 'nickname',
        old_value: 'Old',
        new_value: 'New',
        changed_at: new Date(),
      });

      mockListHeroHistoryUseCase.execute.mockResolvedValueOnce({
        data: [historyEntry],
        next_cursor: null,
      });

      const result = await controller.listHeroHistory(validHeroId, { limit: 10 });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.field).toBe('nickname');
    });
  });
});
