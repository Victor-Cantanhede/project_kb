import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { validationError } from '../../../core/errors/domain.exception.js';
import { readSingleMultipartFile } from '../../../core/security/multipart-file.util.js';
import type { HeroImportJobEntity } from '../domain/entities/hero-import-job.entity.js';
import { GetCsvImportUseCase } from '../application/use-cases/get-csv-import.use-case.js';
import { ListCsvImportsUseCase } from '../application/use-cases/list-csv-imports.use-case.js';
import { StartCsvImportUseCase } from '../application/use-cases/start-csv-import.use-case.js';

function headerString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

@Controller(['imports/heroes', 'api/imports/heroes'])
export class ImportsController {
  constructor(
    @Inject(StartCsvImportUseCase)
    private readonly startCsvImportUseCase: StartCsvImportUseCase,
    @Inject(GetCsvImportUseCase)
    private readonly getCsvImportUseCase: GetCsvImportUseCase,
    @Inject(ListCsvImportsUseCase)
    private readonly listCsvImportsUseCase: ListCsvImportsUseCase,
  ) {}

  @Get()
  async listImports(): Promise<{ data: readonly HeroImportJobEntity[] }> {
    return {
      data: await this.listCsvImportsUseCase.execute(),
    };
  }

  @Get(':id')
  async getImport(@Param('id') id: string): Promise<HeroImportJobEntity> {
    return this.getCsvImportUseCase.execute(id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startImport(@Req() req: Request): Promise<HeroImportJobEntity> {
    const timeZone = headerString(req.headers['x-timezone']);
    const contentType = (headerString(req.headers['content-type']) ?? '').toLowerCase();

    if (contentType.includes('multipart/form-data')) {
      const file = await readSingleMultipartFile(req, 'Envie um arquivo CSV.');
      return this.startCsvImportUseCase.execute(
        file.filename,
        file.buffer.toString('utf8'),
        timeZone,
      );
    }

    if (typeof req.body === 'string') {
      return this.startCsvImportUseCase.execute('herois.csv', req.body, timeZone);
    }

    if (
      typeof req.body === 'object' &&
      req.body !== null &&
      'csv' in req.body &&
      typeof (req.body as { csv: unknown }).csv === 'string'
    ) {
      const body = req.body as { csv: string; filename?: unknown };
      const filename =
        typeof body.filename === 'string' ? body.filename : 'herois.csv';
      return this.startCsvImportUseCase.execute(filename, body.csv, timeZone);
    }

    throw validationError([
      {
        field: 'file',
        message: 'Envie um arquivo CSV via multipart/form-data ou texto.',
      },
    ]);
  }
}

