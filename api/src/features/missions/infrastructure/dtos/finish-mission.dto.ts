import { IsIn } from 'class-validator';
import {
  MISSION_OUTCOMES,
  type MissionOutcome,
} from '../../domain/entities/mission.entity.js';

export class FinishMissionDto {
  @IsIn(MISSION_OUTCOMES, {
    message: 'Informe o resultado da missão: succeeded ou failed.',
  })
  result!: MissionOutcome;
}
