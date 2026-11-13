import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Page } from '../../../core/pagination/keyset-pagination.js';
import type { HeroHistoryEntity } from '../domain/entities/hero-history.entity.js';
import { CreateHeroDto } from '../infrastructure/dtos/create-hero.dto.js';
import { UpdateHeroDto } from '../infrastructure/dtos/update-hero.dto.js';
import { ListHeroesQueryDto } from '../infrastructure/dtos/list-heroes-query.dto.js';
import { ListHeroHistoryQueryDto } from '../infrastructure/dtos/list-hero-history-query.dto.js';
import { HeroResponseDto } from '../infrastructure/dtos/hero-response.dto.js';
import { CreateHeroUseCase } from '../application/use-cases/create-hero.use-case.js';
import { UpdateHeroUseCase } from '../application/use-cases/update-hero.use-case.js';
import { ListHeroesUseCase } from '../application/use-cases/list-heroes.use-case.js';
import { GetHeroUseCase } from '../application/use-cases/get-hero.use-case.js';
import { ToggleHeroStatusUseCase } from '../application/use-cases/toggle-hero-status.use-case.js';
import { DeleteHeroUseCase } from '../application/use-cases/delete-hero.use-case.js';
import { ListHeroHistoryUseCase } from '../application/use-cases/list-hero-history.use-case.js';

function headerString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

@Controller(['heroes', 'api/heroes'])
export class HeroesController {
  constructor(
    @Inject(CreateHeroUseCase)
    private readonly createHeroUseCase: CreateHeroUseCase,
    @Inject(UpdateHeroUseCase)
    private readonly updateHeroUseCase: UpdateHeroUseCase,
    @Inject(ListHeroesUseCase)
    private readonly listHeroesUseCase: ListHeroesUseCase,
    @Inject(GetHeroUseCase)
    private readonly getHeroUseCase: GetHeroUseCase,
    @Inject(ToggleHeroStatusUseCase)
    private readonly toggleHeroStatusUseCase: ToggleHeroStatusUseCase,
    @Inject(DeleteHeroUseCase)
    private readonly deleteHeroUseCase: DeleteHeroUseCase,
    @Inject(ListHeroHistoryUseCase)
    private readonly listHeroHistoryUseCase: ListHeroHistoryUseCase,
  ) {}

  @Get()
  async listHeroes(
    @Query() query: ListHeroesQueryDto,
  ): Promise<Page<HeroResponseDto>> {
    const page = await this.listHeroesUseCase.execute(query);
    return {
      data: page.data.map((hero) => HeroResponseDto.fromEntity(hero)),
      next_cursor: page.next_cursor,
    };
  }

  @Post()
  async createHero(
    @Body() dto: CreateHeroDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const idempotencyKey = headerString(req.headers['idempotency-key']);
    const timeZone = headerString(req.headers['x-timezone']);

    const result = await this.createHeroUseCase.execute(dto, {
      idempotencyKey,
      timeZone,
    });

    res
      .status(result.created ? HttpStatus.CREATED : HttpStatus.OK)
      .json(HeroResponseDto.fromEntity(result.hero));
  }

  @Get(':id')
  async getHero(@Param('id') id: string): Promise<HeroResponseDto> {
    const hero = await this.getHeroUseCase.execute(id);
    return HeroResponseDto.fromEntity(hero);
  }

  @Patch(':id')
  async updateHero(
    @Param('id') id: string,
    @Body() dto: UpdateHeroDto,
    @Req() req: Request,
  ): Promise<HeroResponseDto> {
    const timeZone = headerString(req.headers['x-timezone']);
    const hero = await this.updateHeroUseCase.execute(id, dto, timeZone);
    return HeroResponseDto.fromEntity(hero);
  }

  @Post(':id/activate')
  async activateHero(@Param('id') id: string): Promise<HeroResponseDto> {
    const hero = await this.toggleHeroStatusUseCase.execute(id, true);
    return HeroResponseDto.fromEntity(hero);
  }

  @Post(':id/deactivate')
  async deactivateHero(@Param('id') id: string): Promise<HeroResponseDto> {
    const hero = await this.toggleHeroStatusUseCase.execute(id, false);
    return HeroResponseDto.fromEntity(hero);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHero(@Param('id') id: string): Promise<void> {
    await this.deleteHeroUseCase.execute(id);
  }

  @Get(':id/history')
  async listHeroHistory(
    @Param('id') id: string,
    @Query() query: ListHeroHistoryQueryDto,
  ): Promise<Page<HeroHistoryEntity>> {
    return this.listHeroHistoryUseCase.execute(id, query);
  }
}
