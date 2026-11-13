import { describe, expect, it } from 'vitest';
import {
  isCalendarDay,
  MIN_DATE_OF_BIRTH,
  todayIn,
} from './calendar-date.validator.js';

describe('calendar-date.validator', () => {
  describe('MIN_DATE_OF_BIRTH', () => {
    it('should be defined as 1000-01-01', () => {
      expect(MIN_DATE_OF_BIRTH).toBe('1000-01-01');
    });
  });

  describe('isCalendarDay', () => {
    it('should accept valid dates', () => {
      expect(isCalendarDay('2000-01-01')).toBe(true);
      expect(isCalendarDay('1990-12-31')).toBe(true);
      expect(isCalendarDay('2024-02-29')).toBe(true); // 2024 is leap year
      expect(isCalendarDay('1000-01-01')).toBe(true);
    });

    it('should reject non-leap year Feb 29 and impossible days', () => {
      expect(isCalendarDay('2025-02-29')).toBe(false);
      expect(isCalendarDay('2026-02-30')).toBe(false);
      expect(isCalendarDay('2024-04-31')).toBe(false); // April has 30 days
      expect(isCalendarDay('2026-13-01')).toBe(false); // Month 13
      expect(isCalendarDay('2026-00-10')).toBe(false); // Month 0
      expect(isCalendarDay('2026-05-00')).toBe(false); // Day 0
      expect(isCalendarDay('2026-05-32')).toBe(false); // Day 32
    });

    it('should reject malformed or non-date strings', () => {
      expect(isCalendarDay('')).toBe(false);
      expect(isCalendarDay('2026-5-5')).toBe(false);
      expect(isCalendarDay('2026/05/05')).toBe(false);
      expect(isCalendarDay('not-a-date')).toBe(false);
      expect(isCalendarDay('2026-05-05T00:00:00Z')).toBe(false);
    });
  });

  describe('todayIn', () => {
    it('should return current date in specified IANA timezone', () => {
      // 2026-11-12T01:30:00Z is 2026-11-11 in America/Sao_Paulo (UTC-3)
      const instant = new Date('2026-11-12T01:30:00.000Z');
      const spDate = todayIn('America/Sao_Paulo', instant);
      const utcDate = todayIn('UTC', instant);

      expect(spDate).toBe('2026-11-11');
      expect(utcDate).toBe('2026-11-12');
    });

    it('should fallback cleanly on invalid timezone', () => {
      const instant = new Date('2026-11-12T01:30:00.000Z');
      const fallbackDate = todayIn('Invalid/Timezone_Name', instant, 'UTC');

      expect(fallbackDate).toBe('2026-11-12');
    });

    it('should default now to current time if omitted', () => {
      const today = todayIn('UTC');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isCalendarDay(today)).toBe(true);
    });
  });
});
