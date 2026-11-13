import { describe, expect, it } from 'vitest';
import { validateImageMagicBytes } from '../features/avatars/domain/utils/image-magic-bytes.validator.js';
import {
  buildShowcaseMissions,
  createHeroAvatarPng,
  SHOWCASE_AVATARS,
  SHOWCASE_HEROES,
  SHOWCASE_HISTORY,
  SHOWCASE_IMPORTS,
} from './seed-dev.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('seed-dev fixtures', () => {
  it('uses valid UUID v4 identifiers for all avatars, heroes, missions and imports', () => {
    for (const avatar of SHOWCASE_AVATARS) {
      expect(avatar.id).toMatch(UUID_V4_REGEX);
    }
    for (const hero of SHOWCASE_HEROES) {
      expect(hero.id).toMatch(UUID_V4_REGEX);
    }
    for (const mission of buildShowcaseMissions(new Date('2026-06-01T12:00:00Z'))) {
      expect(mission.id).toMatch(UUID_V4_REGEX);
    }
    for (const job of SHOWCASE_IMPORTS) {
      expect(job.id).toMatch(UUID_V4_REGEX);
    }
  });

  it('generates valid PNG buffers accepted by validateImageMagicBytes', () => {
    for (const avatar of SHOWCASE_AVATARS) {
      const png = createHeroAvatarPng(avatar);
      expect(validateImageMagicBytes(png)).toBe('image/png');
    }
  });

  it('keeps non-deleted showcase hero identities unique and history references valid', () => {
    const heroIds = new Set(SHOWCASE_HEROES.map((h) => h.id));
    const avatarPaths = new Set(SHOWCASE_AVATARS.map((a) => `/api/avatars/${a.id}`));
    const identities = new Set<string>();

    for (const hero of SHOWCASE_HEROES) {
      if (hero.avatar_url) {
        expect(avatarPaths.has(hero.avatar_url)).toBe(true);
      }
      if (hero.deleted_at === null) {
        const key = `${hero.name.toLowerCase()}|${hero.nickname.toLowerCase()}|${hero.date_of_birth}`;
        expect(identities.has(key)).toBe(false);
        identities.add(key);
      }
    }

    for (const entry of SHOWCASE_HISTORY) {
      expect(heroIds.has(entry.hero_id)).toBe(true);
    }
  });

  it('has zero overlapping scheduled/in_progress missions for the same hero', () => {
    const missions = buildShowcaseMissions(new Date('2026-06-01T12:00:00Z'));
    const activeByHero = new Map<string, Array<{ starts: number; ends: number }>>();

    for (const mission of missions) {
      expect(mission.ends_at.getTime()).toBeGreaterThan(mission.starts_at.getTime());
      if (mission.status !== 'scheduled' && mission.status !== 'in_progress') continue;

      for (const heroId of mission.hero_ids) {
        const hero = SHOWCASE_HEROES.find((h) => h.id === heroId);
        expect(hero?.is_active).toBe(true);
        expect(hero?.deleted_at).toBeNull();

        const list = activeByHero.get(heroId) ?? [];
        const starts = mission.starts_at.getTime();
        const ends = mission.ends_at.getTime();
        for (const existing of list) {
          const overlaps = existing.starts < ends && existing.ends > starts;
          expect(overlaps).toBe(false);
        }
        list.push({ starts, ends });
        activeByHero.set(heroId, list);
      }
    }
  });
});

