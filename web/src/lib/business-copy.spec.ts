import { describe, expect, it } from 'vitest';
import {
  ERROR_CODE_TRANSLATIONS,
  getFriendlyErrorMessage,
  resolveApiErrorMessage,
} from './business-copy.js';

describe('business-copy', () => {
  describe('getFriendlyErrorMessage', () => {
    it('translates recognized error codes into Portuguese copy', () => {
      expect(getFriendlyErrorMessage('HERO_VERSION_CONFLICT')).toBe(
        ERROR_CODE_TRANSLATIONS.HERO_VERSION_CONFLICT,
      );
      expect(getFriendlyErrorMessage('DUPLICATE_HERO')).toBe(
        ERROR_CODE_TRANSLATIONS.DUPLICATE_HERO,
      );
      expect(getFriendlyErrorMessage('MISSION_SCHEDULE_CONFLICT')).toBe(
        ERROR_CODE_TRANSLATIONS.MISSION_SCHEDULE_CONFLICT,
      );
      expect(getFriendlyErrorMessage('FILE_TOO_LARGE')).toBe(
        ERROR_CODE_TRANSLATIONS.FILE_TOO_LARGE,
      );
    });

    it('sanitizes technical errors and returns safe fallback', () => {
      const technicalMessage = 'ER_DUP_ENTRY: Duplicate entry for key uq_heroes_identity';
      const result = getFriendlyErrorMessage('UNKNOWN_CODE', technicalMessage);
      expect(result).toBe('Ocorreu um erro ao processar sua solicitação. Tente novamente.');
    });

    it('sanitizes internal server error strings', () => {
      const raw = 'Internal Server Error at Fastify.handle';
      expect(getFriendlyErrorMessage(null, raw)).toBe(
        'Ocorreu um erro ao processar sua solicitação. Tente novamente.',
      );
    });

    it('returns raw message if non-technical and no code matched', () => {
      const friendly = 'O nome de guerra deve conter no máximo 60 caracteres.';
      expect(getFriendlyErrorMessage('OTHER_ERROR', friendly)).toBe(friendly);
    });

    it('returns custom fallback when code and message are empty', () => {
      expect(getFriendlyErrorMessage(null, '', 'Fallback custom')).toBe('Fallback custom');
    });
  });

  describe('resolveApiErrorMessage', () => {
    it('resolves error object with code', () => {
      const err = { code: 'HERO_NOT_FOUND', message: 'Hero not found' };
      expect(resolveApiErrorMessage(err)).toBe('Herói não encontrado.');
    });

    it('resolves error object with unknown code but non-technical message', () => {
      const err = { message: 'Por favor tente mais tarde.' };
      expect(resolveApiErrorMessage(err)).toBe('Por favor tente mais tarde.');
    });

    it('resolves plain string', () => {
      expect(resolveApiErrorMessage('Operação concluída com ressalvas.')).toBe(
        'Operação concluída com ressalvas.',
      );
    });

    it('resolves null or undefined with fallback', () => {
      expect(resolveApiErrorMessage(null, 'Falha genérica')).toBe('Falha genérica');
      expect(resolveApiErrorMessage(undefined, 'Falha genérica')).toBe('Falha genérica');
    });
  });
});
