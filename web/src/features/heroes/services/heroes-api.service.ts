import { request, type Page } from '../../../lib/index.js';
import type { Mission, MissionStatus } from '../../missions/index.js';
import type {
  Hero,
  HeroHistoryEntry,
  HeroSavePayload,
  HistoryField,
} from '../types/heroes.types.js';

export class HeroesApiService {
  static listHeroes(params: {
    readonly search?: string;
    readonly cursor?: string | null;
    readonly limit?: number;
  }): Promise<Page<Hero>> {
    const query = new URLSearchParams();
    if (params.search && params.search.trim().length > 0) {
      query.set('search', params.search.trim());
    }
    if (params.cursor) {
      query.set('cursor', params.cursor);
    }
    query.set('limit', String(params.limit ?? 10));
    return request<Page<Hero>>(`/heroes?${query.toString()}`);
  }

  static getHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}`);
  }

  static createHero(payload: HeroSavePayload, idempotencyKey: string): Promise<Hero> {
    return request<Hero>('/heroes', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
  }

  static updateHero(
    id: string,
    payload: Partial<HeroSavePayload> & { readonly version: number },
  ): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static activateHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  }

  static deactivateHero(id: string): Promise<Hero> {
    return request<Hero>(`/heroes/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
  }

  static deleteHero(id: string): Promise<void> {
    return request<void>(`/heroes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  static listHeroHistory(
    heroId: string,
    params: {
      readonly field?: HistoryField | '';
      readonly cursor?: string | null;
      readonly limit?: number;
    },
  ): Promise<Page<HeroHistoryEntry>> {
    const query = new URLSearchParams();
    if (params.field) query.set('field', params.field);
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 8));
    return request<Page<HeroHistoryEntry>>(
      `/heroes/${encodeURIComponent(heroId)}/history?${query.toString()}`,
    );
  }

  static listHeroMissions(
    heroId: string,
    params: {
      readonly status?: MissionStatus | '';
      readonly cursor?: string | null;
      readonly limit?: number;
    },
  ): Promise<Page<Mission>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.cursor) query.set('cursor', params.cursor);
    query.set('limit', String(params.limit ?? 5));
    return request<Page<Mission>>(
      `/heroes/${encodeURIComponent(heroId)}/missions?${query.toString()}`,
    );
  }

  static uploadAvatar(file: File): Promise<{ readonly id: string; readonly url: string }> {
    const form = new FormData();
    form.append('file', file);
    return request<{ readonly id: string; readonly url: string }>('/avatars', {
      method: 'POST',
      body: form,
    });
  }
}
