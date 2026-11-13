import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { type Page } from '../../../core/pagination/keyset-pagination.js';
import { AssignHeroDto } from '../infrastructure/dtos/assign-hero.dto.js';
import { CreateMissionDto } from '../infrastructure/dtos/create-mission.dto.js';
import { FinishMissionDto } from '../infrastructure/dtos/finish-mission.dto.js';
import { ListMissionsQueryDto } from '../infrastructure/dtos/list-missions-query.dto.js';
import { MissionResponseDto } from '../infrastructure/dtos/mission-response.dto.js';
import { AssignHeroUseCase } from '../application/use-cases/assign-hero.use-case.js';
import { CancelMissionUseCase } from '../application/use-cases/cancel-mission.use-case.js';
import { CreateMissionUseCase } from '../application/use-cases/create-mission.use-case.js';
import { FinishMissionUseCase } from '../application/use-cases/finish-mission.use-case.js';
import { GetMissionUseCase } from '../application/use-cases/get-mission.use-case.js';
import { ListHeroMissionsUseCase } from '../application/use-cases/list-hero-missions.use-case.js';
import { ListMissionsUseCase } from '../application/use-cases/list-missions.use-case.js';
import { RemoveHeroUseCase } from '../application/use-cases/remove-hero.use-case.js';
import { StartMissionUseCase } from '../application/use-cases/start-mission.use-case.js';

@Controller()
export class MissionsController {
  constructor(
    @Inject(CreateMissionUseCase)
    private readonly createMissionUseCase: CreateMissionUseCase,
    @Inject(GetMissionUseCase)
    private readonly getMissionUseCase: GetMissionUseCase,
    @Inject(ListMissionsUseCase)
    private readonly listMissionsUseCase: ListMissionsUseCase,
    @Inject(ListHeroMissionsUseCase)
    private readonly listHeroMissionsUseCase: ListHeroMissionsUseCase,
    @Inject(AssignHeroUseCase)
    private readonly assignHeroUseCase: AssignHeroUseCase,
    @Inject(RemoveHeroUseCase)
    private readonly removeHeroUseCase: RemoveHeroUseCase,
    @Inject(StartMissionUseCase)
    private readonly startMissionUseCase: StartMissionUseCase,
    @Inject(FinishMissionUseCase)
    private readonly finishMissionUseCase: FinishMissionUseCase,
    @Inject(CancelMissionUseCase)
    private readonly cancelMissionUseCase: CancelMissionUseCase,
  ) {}

  @Get(['missions', 'api/missions'])
  async listMissions(
    @Query() query: ListMissionsQueryDto,
  ): Promise<Page<MissionResponseDto>> {
    const page = await this.listMissionsUseCase.execute(query);
    return {
      data: page.data.map((mission) => MissionResponseDto.fromEntity(mission)),
      next_cursor: page.next_cursor,
    };
  }

  @Get(['heroes/:id/missions', 'api/heroes/:id/missions'])
  async listHeroMissions(
    @Param('id') id: string,
    @Query() query: ListMissionsQueryDto,
  ): Promise<Page<MissionResponseDto>> {
    const page = await this.listHeroMissionsUseCase.execute(id, query);
    return {
      data: page.data.map((mission) => MissionResponseDto.fromEntity(mission)),
      next_cursor: page.next_cursor,
    };
  }

  @Get(['missions/:id', 'api/missions/:id'])
  async getMission(@Param('id') id: string): Promise<MissionResponseDto> {
    const mission = await this.getMissionUseCase.execute(id);
    return MissionResponseDto.fromEntity(mission);
  }

  @Post(['missions', 'api/missions'])
  @HttpCode(HttpStatus.CREATED)
  async createMission(
    @Body() dto: CreateMissionDto,
  ): Promise<MissionResponseDto> {
    const mission = await this.createMissionUseCase.execute(dto);
    return MissionResponseDto.fromEntity(mission);
  }

  @Post(['missions/:id/heroes', 'api/missions/:id/heroes'])
  @HttpCode(HttpStatus.OK)
  async assignHero(
    @Param('id') id: string,
    @Body() dto: AssignHeroDto,
  ): Promise<MissionResponseDto> {
    const mission = await this.assignHeroUseCase.execute(id, dto.hero_id);
    return MissionResponseDto.fromEntity(mission);
  }

  @Delete(['missions/:id/heroes/:heroId', 'api/missions/:id/heroes/:heroId'])
  async removeHero(
    @Param('id') id: string,
    @Param('heroId') heroId: string,
  ): Promise<MissionResponseDto> {
    const mission = await this.removeHeroUseCase.execute(id, heroId);
    return MissionResponseDto.fromEntity(mission);
  }

  @Post(['missions/:id/start', 'api/missions/:id/start'])
  @HttpCode(HttpStatus.OK)
  async startMission(@Param('id') id: string): Promise<MissionResponseDto> {
    const mission = await this.startMissionUseCase.execute(id);
    return MissionResponseDto.fromEntity(mission);
  }

  @Post(['missions/:id/finish', 'api/missions/:id/finish'])
  @HttpCode(HttpStatus.OK)
  async finishMission(
    @Param('id') id: string,
    @Body() dto: FinishMissionDto,
  ): Promise<MissionResponseDto> {
    const mission = await this.finishMissionUseCase.execute(id, dto.result);
    return MissionResponseDto.fromEntity(mission);
  }

  @Post(['missions/:id/cancel', 'api/missions/:id/cancel'])
  @HttpCode(HttpStatus.OK)
  async cancelMission(@Param('id') id: string): Promise<MissionResponseDto> {
    const mission = await this.cancelMissionUseCase.execute(id);
    return MissionResponseDto.fromEntity(mission);
  }
}

