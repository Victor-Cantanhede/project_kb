import { request } from '../../../lib/index.js';
import type { HeroImportJob } from '../types/imports.types.js';

export class ImportsApiService {
  static startCsvImport(file: File): Promise<HeroImportJob> {
    const form = new FormData();
    form.append('file', file);
    return request<HeroImportJob>('/imports/heroes', {
      method: 'POST',
      body: form,
    });
  }

  static getCsvImport(id: string): Promise<HeroImportJob> {
    return request<HeroImportJob>(`/imports/heroes/${encodeURIComponent(id)}`);
  }

  static listCsvImports(): Promise<{ readonly data: readonly HeroImportJob[] }> {
    return request<{ readonly data: readonly HeroImportJob[] }>('/imports/heroes');
  }
}
