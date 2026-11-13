import { describe, expect, it } from 'vitest';
import { activationChange, diffHero } from './hero-diff.util.js';
import type { HeroEntity } from '../entities/hero.entity.js';

describe('hero-diff.util', () => {
  const baseHero: HeroEntity = {
    id: 'e314636e-1ca6-4925-a0e7-da5eb5ae2403',
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
  };

  it('should return empty array when patch has no differences', () => {
    const changes = diffHero(baseHero, {
      name: 'Robert Bruce Banner',
      nickname: 'Hulk',
    });
    expect(changes).toEqual([]);
  });

  it('should ignore undefined fields in patch', () => {
    const changes = diffHero(baseHero, {});
    expect(changes).toEqual([]);
  });

  it('should detect single field modification', () => {
    const changes = diffHero(baseHero, {
      nickname: 'Hulk Verde',
    });
    expect(changes).toEqual([
      {
        field: 'nickname',
        old_value: 'Hulk',
        new_value: 'Hulk Verde',
      },
    ]);
  });

  it('should detect multiple field modifications including avatar_url transitions', () => {
    const changes = diffHero(baseHero, {
      name: 'Bruce Banner Ph.D.',
      avatar_url: 'https://example.com/hulk.png',
      universe: 'Marvel', // unchanged
    });

    expect(changes).toEqual([
      {
        field: 'name',
        old_value: 'Robert Bruce Banner',
        new_value: 'Bruce Banner Ph.D.',
      },
      {
        field: 'avatar_url',
        old_value: null,
        new_value: 'https://example.com/hulk.png',
      },
    ]);
  });

  it('should detect setting avatar_url to null', () => {
    const heroWithAvatar = {
      ...baseHero,
      avatar_url: 'https://example.com/hulk.png',
    };
    const changes = diffHero(heroWithAvatar, {
      avatar_url: null,
    });

    expect(changes).toEqual([
      {
        field: 'avatar_url',
        old_value: 'https://example.com/hulk.png',
        new_value: null,
      },
    ]);
  });

  describe('activationChange', () => {
    it('should create activation change record for activating a hero', () => {
      const change = activationChange({ is_active: false }, true);
      expect(change).toEqual({
        field: 'is_active',
        old_value: 'false',
        new_value: 'true',
      });
    });

    it('should create activation change record for deactivating a hero', () => {
      const change = activationChange({ is_active: true }, false);
      expect(change).toEqual({
        field: 'is_active',
        old_value: 'true',
        new_value: 'false',
      });
    });
  });
});
