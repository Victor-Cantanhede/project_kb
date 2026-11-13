import { describe, expect, it } from 'vitest';
import { formatLocalDateTime, MISSION_STATUS_LABELS } from './mission-formatters.js';

describe('mission-formatters', () => {
  describe('formatLocalDateTime', () => {
    it('formats ISO string into localized date and time in pt-BR', () => {
      const iso = '2025-06-15T18:30:00.000Z';
      const formatted = formatLocalDateTime(iso);
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('MISSION_STATUS_LABELS', () => {
    it('contains friendly Portuguese labels for all 5 statuses', () => {
      expect(MISSION_STATUS_LABELS.scheduled).toBe('Agendada');
      expect(MISSION_STATUS_LABELS.in_progress).toBe('Em andamento');
      expect(MISSION_STATUS_LABELS.succeeded).toBe('Sucesso');
      expect(MISSION_STATUS_LABELS.failed).toBe('Fracasso');
      expect(MISSION_STATUS_LABELS.cancelled).toBe('Cancelada');
    });
  });
});
