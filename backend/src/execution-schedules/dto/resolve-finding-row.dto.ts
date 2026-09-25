import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Body for the resolve-finding-row route. Deliberately narrow: this is the whole security
 * boundary for `execution-schedules:resolve-finding` - a caller who holds only this permission
 * (not `execution-schedules:update`) can PATCH nothing on the row or the report beyond what's
 * listed here: Completed Date, Corrective Action, attachments and the one-way Resolve.
 * Corrective Action Date/Remarks are deliberately NOT here - they stay editor-only. Never add
 * a field here that isn't part of "fill in the corrective action and mark it resolved."
 */
export class ResolveFindingRowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveFinalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveFinalRemarks?: string;

  @ApiPropertyOptional({
    description: 'Row attachments (same {id, name, size, type, data} shape the UI already uses).',
  })
  @IsOptional()
  @IsArray()
  attachments?: unknown[];

  @ApiPropertyOptional({
    description:
      'true = mark resolved (server sets correctiveFinalUser/correctiveFinalDatetime from the ' +
      'caller and now); omitted = leave as-is. One-way: resolving an already-resolved row is ' +
      'rejected (409), and false is rejected (400) - only a report editor ' +
      '(execution-schedules:update) can undo a resolution, through the generic PATCH.',
  })
  @IsOptional()
  @IsBoolean()
  resolve?: boolean;

  @ApiPropertyOptional({
    description:
      'The updatedAt this edit was based on. When given, the save is rejected (409) if ' +
      'someone else has changed the schedule since - same optimistic-concurrency guard as ' +
      'the generic PATCH.',
  })
  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;
}
