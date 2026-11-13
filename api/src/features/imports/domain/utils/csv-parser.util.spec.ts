import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import {
  MAX_CSV_ROWS,
  validateAndExtractCsvRows,
  validateCsvRow,
} from './csv-parser.util.js';

describe('CsvParserUtil', () => {
  const validHeader = 'name,nickname,date_of_birth,universe,main_power,avatar_url';
  const today = '2026-11-13';

  describe('validateAndExtractCsvRows', () => {
    it('throws validationError when csv is completely empty', () => {
      expect(() => validateAndExtractCsvRows('')).toThrowError(DomainError);
      try {
        validateAndExtractCsvRows('');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.kind).toBe('validation');
        expect(domainErr.extra.fields?.[0]?.message).toBe('O arquivo CSV está vazio.');
      }
    });

    it('throws validationError when csv has only whitespace or comments', () => {
      expect(() => validateAndExtractCsvRows('   \n  \n')).toThrowError(DomainError);
    });

    it('throws validationError when header does not match expected format', () => {
      expect(() => validateAndExtractCsvRows('wrong,header,format\n1,2,3')).toThrowError(DomainError);
      try {
        validateAndExtractCsvRows('name,nickname,date_of_birth\nA,B,1990-01-01');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.extra.fields?.[0]?.message).toContain('O cabeçalho do CSV deve ser exatamente');
      }
    });

    it('throws validationError when csv has only the header and no data rows', () => {
      expect(() => validateAndExtractCsvRows(`${validHeader}\n`)).toThrowError(DomainError);
      try {
        validateAndExtractCsvRows(`${validHeader}\n\n`);
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.extra.fields?.[0]?.message).toBe(
          'O arquivo CSV não contém heróis para importar.',
        );
      }
    });

    it('throws CSV_ROW_LIMIT_EXCEEDED when rows exceed MAX_CSV_ROWS', () => {
      const row = 'Bruce Wayne,Batman,1939-03-30,DC,Preparo,\n';
      const csv = `${validHeader}\n${row.repeat(MAX_CSV_ROWS + 1)}`;
      expect(() => validateAndExtractCsvRows(csv)).toThrowError(DomainError);
      try {
        validateAndExtractCsvRows(csv);
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.code).toBe('CSV_ROW_LIMIT_EXCEEDED');
      }
    });

    it('extracts rows and preserves physical line numbers even with blank lines and BOM', () => {
      const csvWithBom = `\uFEFF${validHeader}\nClark Kent,Superman,1938-04-18,DC,Voo,https://exemplo.com/sup.png\n\nBruce Wayne,Batman,1939-03-30,DC,Inteligência,`;
      const rows = validateAndExtractCsvRows(csvWithBom);
      expect(rows.length).toBe(2);
      expect(rows[0]?.line).toBe(2);
      expect(rows[0]?.columns[0]).toBe('Clark Kent');
      expect(rows[1]?.line).toBe(4);
      expect(rows[1]?.columns[0]).toBe('Bruce Wayne');
    });

    it('throws validationError if csv has unparseable syntax', () => {
      expect(() => validateAndExtractCsvRows('"unclosed quote,1,2,3')).toThrowError(DomainError);
    });
  });

  describe('validateCsvRow', () => {
    it('returns invalid when columns count is not 6', () => {
      const result = validateCsvRow(['Clark', 'Superman', '1938-04-18'], 2, today);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(2);
        expect(result.error.message).toBe('Esperadas 6 colunas, mas foram encontradas 3.');
      }
    });

    it('returns valid for a correct hero row with avatar_url', () => {
      const result = validateCsvRow(
        ['Clark Kent', 'Superman', '1938-04-18', 'DC', 'Voo', 'https://exemplo.com/sup.png'],
        2,
        today,
      );
      expect(result.kind).toBe('valid');
      if (result.kind === 'valid') {
        expect(result.line).toBe(2);
        expect(result.input).toEqual({
          name: 'Clark Kent',
          nickname: 'Superman',
          date_of_birth: '1938-04-18',
          universe: 'DC',
          main_power: 'Voo',
          avatar_url: 'https://exemplo.com/sup.png',
        });
      }
    });

    it('normalizes blank or missing avatar_url to null', () => {
      const result = validateCsvRow(
        ['Bruce Wayne', 'Batman', '1939-03-30', 'DC', 'Preparo', '   '],
        3,
        today,
      );
      expect(result.kind).toBe('valid');
      if (result.kind === 'valid') {
        expect(result.input.avatar_url).toBeNull();
      }
    });

    it('returns invalid when birth date is in the future', () => {
      const result = validateCsvRow(
        ['Viajante', 'Futurista', '2099-01-01', 'DC', 'Tempo', ''],
        5,
        today,
      );
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(5);
        expect(result.error.message).toContain('date_of_birth: A data de nascimento não pode ser no futuro.');
      }
    });

    it('returns invalid when birth date is before year 1000', () => {
      const result = validateCsvRow(
        ['Ancião', 'Mago', '0999-12-31', 'Marvel', 'Magia', ''],
        6,
        today,
      );
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(6);
        expect(result.error.message).toContain('a partir do ano 1000');
      }
    });

    it('returns invalid when birth date is not a valid calendar day', () => {
      const result = validateCsvRow(
        ['Diana', 'Mulher Maravilha', '2025-02-29', 'DC', 'Força', ''],
        7,
        today,
      );
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(7);
        expect(result.error.message).toContain('Use uma data válida no formato AAAA-MM-DD');
      }
    });

    it('returns invalid when required text fields are empty or whitespace only', () => {
      const result = validateCsvRow(['   ', '', '1990-01-01', ' ', ' ', ''], 8, today);
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(8);
        expect(result.error.message).toContain('name');
        expect(result.error.message).toContain('nickname');
        expect(result.error.message).toContain('universe');
        expect(result.error.message).toContain('main_power');
      }
    });

    it('returns invalid when avatar_url is not http/https or /api/avatars/uuid', () => {
      const result = validateCsvRow(
        ['Tony', 'Iron Man', '1970-05-29', 'Marvel', 'Armadura', 'javascript:alert(1)'],
        9,
        today,
      );
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') {
        expect(result.error.line).toBe(9);
        expect(result.error.message).toContain('avatar_url: Informe uma URL http(s) válida.');
      }
    });

    it('accepts /api/avatars/:uuid as a valid avatar_url', () => {
      const result = validateCsvRow(
        [
          'Peter Parker',
          'Spider-Man',
          '2001-08-10',
          'Marvel',
          'Sentido Aranha',
          '/api/avatars/11111111-1111-4111-8111-111111111111',
        ],
        10,
        today,
      );
      expect(result.kind).toBe('valid');
      if (result.kind === 'valid') {
        expect(result.input.avatar_url).toBe('/api/avatars/11111111-1111-4111-8111-111111111111');
      }
    });
  });
});
