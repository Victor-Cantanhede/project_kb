import { request, type Page } from '../../../lib/index.js';
import type {
  CreateMissionPayload,
  Mission,
  MissionOutcome,
  MissionStatus,
} from '../types/missions.types.js';

export class MissionsApiService {
  static listMissions(params: {
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
  }

  static getMission(id: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(id)}`);
  }

  static createMission(payload: CreateMissionPayload): Promise<Mission> {
    return request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static assignHeroToMission(missionId: string, heroId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/heroes`, {
      method: 'POST',
      body: JSON.stringify({ hero_id: heroId }),
    });
  }

  static removeHeroFromMission(missionId: string, heroId: string): Promise<Mission> {
    return request<Mission>(
      `/missions/${encodeURIComponent(missionId)}/heroes/${encodeURIComponent(heroId)}`,
      { method: 'DELETE' },
    );
  }

  static startMission(missionId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/start`, {
      method: 'POST',
    });
  }

  static finishMission(missionId: string, result: MissionOutcome): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/finish`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    });
  }

  static cancelMission(missionId: string): Promise<Mission> {
    return request<Mission>(`/missions/${encodeURIComponent(missionId)}/cancel`, {
      method: 'POST',
    });
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
}
