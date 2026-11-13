import { Inject, Injectable } from '@nestjs/common';
import type { HeroImportJobEntity } from '../../domain/entities/hero-import-job.entity.js';
import {
  IMPORT_REPOSITORY_TOKEN,
  type IImportRepository,
} from '../../domain/ports/import-repository.port.js';

@Injectable()
export class ListCsvImportsUseCase {
  constructor(
    @Inject(IMPORT_REPOSITORY_TOKEN)
    private readonly repo: IImportRepository,
  ) {}

  async execute(limit = 20): Promise<readonly HeroImportJobEntity[]> {
    return this.repo.listRecent(limit);
  }
}

