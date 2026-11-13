import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { HeroesModule } from '../heroes/index.js';
import { IMPORT_REPOSITORY_TOKEN } from './domain/ports/import-repository.port.js';
import { MysqlImportRepository } from './infrastructure/adapters/mysql-import.repository.js';
import { GetCsvImportUseCase } from './application/use-cases/get-csv-import.use-case.js';
import { ListCsvImportsUseCase } from './application/use-cases/list-csv-imports.use-case.js';
import { StartCsvImportUseCase } from './application/use-cases/start-csv-import.use-case.js';
import { ImportsController } from './presentation/imports.controller.js';

@Module({
  imports: [DatabaseModule, HeroesModule],
  controllers: [ImportsController],
  providers: [
    StartCsvImportUseCase,
    GetCsvImportUseCase,
    ListCsvImportsUseCase,
    {
      provide: IMPORT_REPOSITORY_TOKEN,
      useClass: MysqlImportRepository,
    },
  ],
  exports: [
    IMPORT_REPOSITORY_TOKEN,
    StartCsvImportUseCase,
    GetCsvImportUseCase,
    ListCsvImportsUseCase,
  ],
})
export class ImportsModule {}

