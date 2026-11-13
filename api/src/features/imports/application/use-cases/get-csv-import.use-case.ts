import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  validationError,
} from '../../../../core/errors/domain.exception.js';
import type { HeroImportJobEntity } from '../../domain/entities/hero-import-job.entity.js';
import {
  IMPORT_REPOSITORY_TOKEN,
  type IImportRepository,
} from '../../domain/ports/import-repository.port.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class GetCsvImportUseCase {
  constructor(
    @Inject(IMPORT_REPOSITORY_TOKEN)
    private readonly repo: IImportRepository,
  ) {}

  async execute(id: string): Promise<HeroImportJobEntity> {
    if (!UUID_REGEX.test(id)) {
      throw validationError([
        { field: 'id', message: 'Identificador de importação inválido.' },
      ]);
    }

    const job = await this.repo.findById(id);
    if (!job) {
      throw new DomainError(
        'not_found',
        'IMPORT_NOT_FOUND',
        'Importação não encontrada.',
      );
    }
    return job;
  }
}

