import { describe, expect, it } from 'vitest';
import type { HeroHistoryEntry } from '../types/heroes.types.js';
import {
  DEFAULT_HERO_AVATAR,
  formatBirthDate,
  formatHistoryEntry,
  formatHistoryValue,
} from './hero-formatters.js';

describe('hero-formatters', () => {
  describe('formatBirthDate', () => {
    it('formats YYYY-MM-DD into DD/MM/YYYY without timezone shift', () => {
      expect(formatBirthDate('1962-04-10')).toBe('10/04/1962');
      expect(formatBirthDate('2000-01-01')).toBe('01/01/2000');
      expect(formatBirthDate('1985-12-31')).toBe('31/12/1985');
    });

    it('returns raw value if not strictly YYYY-MM-DD', () => {
      expect(formatBirthDate('invalid')).toBe('invalid');
      expect(formatBirthDate('10/04/1962')).toBe('10/04/1962');
    });
  });

  describe('formatHistoryValue', () => {
    it('formats null or empty as "vazio"', () => {
      expect(formatHistoryValue('name', null)).toBe('vazio');
      expect(formatHistoryValue('name', '')).toBe('vazio');
    });

    it('formats date_of_birth via formatBirthDate', () => {
      expect(formatHistoryValue('date_of_birth', '1990-05-20')).toBe('20/05/1990');
    });

    it('formats is_active boolean strings as Ativo/Inativo', () => {
      expect(formatHistoryValue('is_active', 'true')).toBe('Ativo');
      expect(formatHistoryValue('is_active', 'false')).toBe('Inativo');
    });

    it('returns raw text for other fields', () => {
      expect(formatHistoryValue('universe', 'Marvel')).toBe('Marvel');
      expect(formatHistoryValue('main_power', 'Voo')).toBe('Voo');
    });
  });

  describe('formatHistoryEntry', () => {
    it('formats a history record into expected Portuguese phrase', () => {
      const entry: HeroHistoryEntry = {
        id: 'hist-1',
        field: 'main_power',
        old_value: 'Super Força',
        new_value: 'Voo Supersônico',
        changed_at: '2025-05-10T14:30:00.000Z',
      };
      const formatted = formatHistoryEntry(entry);
      expect(formatted).toContain('habilidade mudou de Super Força para Voo Supersônico');
    });
  });

  describe('DEFAULT_HERO_AVATAR', () => {
    it('provides a valid data URI SVG string', () => {
      expect(DEFAULT_HERO_AVATAR).toMatch(/^data:image\/svg\+xml;utf8,/);
    });
  });
});
