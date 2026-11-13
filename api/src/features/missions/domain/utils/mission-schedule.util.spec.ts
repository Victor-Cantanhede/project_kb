import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import {
  assertCanCancel,
  assertCanFinish,
  assertCanModifyRoster,
  assertCanStart,
  doPeriodsOverlap,
} from './mission-schedule.util.js';

describe('mission-schedule.util', () => {
  describe('doPeriodsOverlap', () => {
    const aStart = new Date('2026-11-03T10:00:00.000Z');
    const aEnd = new Date('2026-11-03T12:00:00.000Z');

    it('should detect overlapping periods', () => {
      const bStart = new Date('2026-11-03T11:00:00.000Z');
      const bEnd = new Date('2026-11-03T13:00:00.000Z');
      expect(doPeriodsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
    });

    it('should allow adjacent periods (no overlap when end equals start)', () => {
      const cStart = new Date('2026-11-03T12:00:00.000Z');
      const cEnd = new Date('2026-11-03T14:00:00.000Z');
      expect(doPeriodsOverlap(aStart, aEnd, cStart, cEnd)).toBe(false);
    });

    it('should return false for completely disjoint periods', () => {
      const dStart = new Date('2026-11-03T14:00:00.000Z');
      const dEnd = new Date('2026-11-03T16:00:00.000Z');
      expect(doPeriodsOverlap(aStart, aEnd, dStart, dEnd)).toBe(false);
    });

    it('should detect when one period is fully contained in another', () => {
      const insideStart = new Date('2026-11-03T10:30:00.000Z');
      const insideEnd = new Date('2026-11-03T11:30:00.000Z');
      expect(doPeriodsOverlap(aStart, aEnd, insideStart, insideEnd)).toBe(true);
    });
  });

  describe('assertCanModifyRoster', () => {
    it('should allow modifying roster when status is scheduled', () => {
      expect(() => assertCanModifyRoster('scheduled')).not.toThrow();
    });

    it('should reject modifying roster when status is not scheduled', () => {
      expect(() => assertCanModifyRoster('in_progress')).toThrowError(DomainError);
      expect(() => assertCanModifyRoster('succeeded')).toThrowError(DomainError);
      expect(() => assertCanModifyRoster('failed')).toThrowError(DomainError);
      expect(() => assertCanModifyRoster('cancelled')).toThrowError(DomainError);

      try {
        assertCanModifyRoster('in_progress');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        expect((err as DomainError).code).toBe('MISSION_NOT_SCHEDULED');
      }
    });
  });

  describe('assertCanStart', () => {
    it('should allow starting scheduled mission with at least 1 hero', () => {
      expect(() => assertCanStart('scheduled', 1)).not.toThrow();
      expect(() => assertCanStart('scheduled', 5)).not.toThrow();
    });

    it('should reject starting mission with 0 heroes', () => {
      try {
        assertCanStart('scheduled', 0);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        expect((err as DomainError).code).toBe('MISSION_REQUIRES_HERO');
      }
    });

    it('should reject starting mission if status is not scheduled', () => {
      try {
        assertCanStart('in_progress', 2);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        expect((err as DomainError).code).toBe('INVALID_MISSION_TRANSITION');
      }
    });
  });

  describe('assertCanFinish', () => {
    it('should allow finishing mission in progress', () => {
      expect(() => assertCanFinish('in_progress')).not.toThrow();
    });

    it('should reject finishing mission not in progress', () => {
      const statuses = ['scheduled', 'succeeded', 'failed', 'cancelled'] as const;
      for (const status of statuses) {
        try {
          assertCanFinish(status);
          expect.unreachable();
        } catch (err) {
          expect(err).toBeInstanceOf(DomainError);
          expect((err as DomainError).code).toBe('INVALID_MISSION_TRANSITION');
        }
      }
    });
  });

  describe('assertCanCancel', () => {
    it('should allow cancelling scheduled or in_progress mission', () => {
      expect(() => assertCanCancel('scheduled')).not.toThrow();
      expect(() => assertCanCancel('in_progress')).not.toThrow();
    });

    it('should reject cancelling finished or already cancelled mission', () => {
      const terminalStatuses = ['succeeded', 'failed', 'cancelled'] as const;
      for (const status of terminalStatuses) {
        try {
          assertCanCancel(status);
          expect.unreachable();
        } catch (err) {
          expect(err).toBeInstanceOf(DomainError);
          expect((err as DomainError).code).toBe('INVALID_MISSION_TRANSITION');
        }
      }
    });
  });
});
