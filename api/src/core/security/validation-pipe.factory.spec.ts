import { describe, expect, it } from 'vitest';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DomainError } from '../errors/domain.exception.js';
import { createValidationPipe } from './validation-pipe.factory.js';

class ChildDto {
  @IsString()
  @IsNotEmpty({ message: 'Subcampo é obrigatório.' })
  subfield!: string;
}

class SampleDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  name!: string;

  @ValidateNested()
  @Type(() => ChildDto)
  child?: ChildDto;
}

describe('ValidationPipeFactory (Unit Test)', () => {
  const pipe = createValidationPipe();

  it('deve transformar DTO válido com sucesso', async () => {
    const result = (await pipe.transform(
      { name: 'Bruce Wayne', extraIgnored: 123 },
      { type: 'body', metatype: SampleDto },
    )) as SampleDto;

    expect(result).toBeInstanceOf(SampleDto);
    expect(result.name).toBe('Bruce Wayne');
    expect((result as any).extraIgnored).toBeUndefined(); // Stripped by whitelist: true
  });

  it('deve mapear erros do class-validator para DomainError VALIDATION_ERROR com campos mapeados', async () => {
    try {
      await pipe.transform({ name: '' }, { type: 'body', metatype: SampleDto });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('validation');
      expect(domainErr.code).toBe('VALIDATION_ERROR');
      expect(domainErr.message).toBe('Alguns campos estão inválidos.');
      expect(domainErr.extra.fields).toEqual([
        { field: 'name', message: 'Nome é obrigatório.' },
      ]);
    }
  });

  it('deve achatar campos aninhados em notação de ponto', async () => {
    try {
      await pipe.transform(
        { name: 'Clark Kent', child: { subfield: '' } },
        { type: 'body', metatype: SampleDto },
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.extra.fields).toEqual([
        { field: 'child.subfield', message: 'Subcampo é obrigatório.' },
      ]);
    }
  });
});
