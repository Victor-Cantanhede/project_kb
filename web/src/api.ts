import {
  ApiClientError,
  type FieldError,
  type Hero,
  type HeroHistoryEntry,
  type HeroImportJob,
  type HistoryField,
  type Mission,
  type MissionOutcome,
  type MissionStatus,
  type Page,
} from './types.js';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function extractFieldErrors(raw: unknown): readonly FieldError[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) =>
    isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string'
      ? [{ field: item.field, message: item.message }]
      : [],
  );
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Timezone', browserTimeZone());
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Não foi possível conectar à API. Verifique se o servidor está no ar e tente novamente.',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isRecord(payload) && isRecord(payload.error)) {
      const errObj = payload.error;
      const code = typeof errObj.code === 'string' ? errObj.code : 'API_ERROR';
      const message =
        typeof errObj.message === 'string'
          ? errObj.message
          : `Erro ao processar requisição (HTTP ${response.status}).`;
      const fields = extractFieldErrors(errObj.fields);
      const details = isRecord(errObj.details) ? errObj.details : {};
      throw new ApiClientError(response.status, code, message, fields, details);
    }
    throw new ApiClientError(
      response.status,
      'HTTP_ERROR',
      `O servidor respondeu com erro (${response.status}). Tente novamente.`,
    );
  }

  return payload as T;
}

export interface HeroSavePayload {
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
}

export const api = {
  listHeroes(params: { readonly search?: string; readonly cursor?: string | null; readonly limit?: number }): Promise<Page<Hero>> {
    const query = new URLSearchParams();
    if (params.search && params.search.trim().length > 0) query.set('search', params.search.trim());
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 10));
    return request<Page<Hero>>(`/heroes?${query.toString()}`);
  },

  getHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}`);
  },

  createHero(payload: HeroSavePayload, idempotencyKey: string): Promise<Hero> {
    return request<Hero>('/heroes', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
  },

  updateHero(id: string, payload: Partial<HeroSavePayload> & { readonly version: number }): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  activateHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  },

  deactivateHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
  },

  deleteHero(id: string): Promise<void> {
    return request<void>(`/heroes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listHeroHistory(
    heroId: string,
    params: { readonly field?: HistoryField | ''; readonly cursor?: string | null; readonly limit?: number },
  ): Promise<Page<HeroHistoryEntry>> {
    const query = new URLSearchParams();
    if (params.field) query.set('field', params.field);
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 8));
    return request<Page<HeroHistoryEntry>>(
      `/heroes/${encodeURIComponent(heroId)}/history?${query.toString()}`,
    );
  },

  listHeroMissions(
    heroId: string,
    params: { readonly status?: MissionStatus | ''; readonly cursor?: string | null; readonly limit?: number },
  ): Promise<Page<Mission>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 5));
    return request<Page<Mission>>(
      `/heroes/${encodeURIComponent(heroId)}/missions?${query.toString()}`,
    );
  },

  listMissions(params: {
    readonly status?: MissionStatus | '';
    readonly heroId?: string;
    readonly cursor?: string | null;
    readonly limit?: number;
  }): Promise<Page<Mission>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.heroId) query.set('hero_id', params.heroId);
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 10));
    return request<Page<Mission>>(`/missions?${query.toString()}`);
  },

  getMission(id: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(id)}`);
  },

  createMission(payload: {
    readonly title: string;
    readonly starts_at: string;
    readonly ends_at: string;
  }): Promise<Mission> {
    return request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  assignHeroToMission(missionId: string, heroId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/heroes`, {
      method: 'POST',
      body: JSON.stringify({ hero_id: heroId }),
    });
  },

  removeHeroFromMission(missionId: string, heroId: string): Promise<Mission> {
    return request<Mission>(
      `/missions/${encodeURIComponent(missionId)}/heroes/${encodeURIComponent(heroId)}`,
      { method: 'DELETE' },
    );
  },

  startMission(missionId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/start`, { method: 'POST' });
  },

  finishMission(missionId: string, result: MissionOutcome): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/finish`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    });
  },

  cancelMission(missionId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/cancel`, { method: 'POST' });
  },

  uploadAvatar(file: File): Promise<{ readonly id: string; readonly url: string }> {
    const form = new FormData();
    form.append('file', file);
    return request<{ readonly id: string; readonly url: string }>('/avatars', {
      method: 'POST',
      body: form,
    });
  },

  startCsvImport(file: File): Promise<HeroImportJob> {
    const form = new FormData();
    form.append('file', file);
    return request<HeroImportJob>('/imports/heroes', {
      method: 'POST',
      body: form,
    });
  },

  getCsvImport(id: string): Promise<HeroImportJob> {
    return request<HeroImportJob>(`/imports/heroes/${encodeURIComponent(id)}`);
  },

  listCsvImports(): Promise<{ readonly data: readonly HeroImportJob[] }> {
    return request<{ readonly data: readonly HeroImportJob[] }>('/imports/heroes');
  },
};

