import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readSingleMultipartFile } from '../../../core/security/multipart-file.util.js';
import { UploadAvatarUseCase, type UploadAvatarResult } from '../application/use-cases/upload-avatar.use-case.js';
import { GetAvatarUseCase } from '../application/use-cases/get-avatar.use-case.js';

@Controller(['avatars', 'api/avatars'])
export class AvatarsController {
  constructor(
    @Inject(UploadAvatarUseCase)
    private readonly uploadAvatarUseCase: UploadAvatarUseCase,
    @Inject(GetAvatarUseCase)
    private readonly getAvatarUseCase: GetAvatarUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async uploadAvatar(@Req() req: Request): Promise<UploadAvatarResult> {
    const file = await readSingleMultipartFile(
      req,
      'Nenhum arquivo enviado.',
      2 * 1024 * 1024,
    );
    return this.uploadAvatarUseCase.execute(file.buffer);
  }

  @Get(':id')
  async getAvatar(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const avatar = await this.getAvatarUseCase.execute(id);

    res.setHeader('Content-Type', avatar.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(avatar.content);
  }
}
