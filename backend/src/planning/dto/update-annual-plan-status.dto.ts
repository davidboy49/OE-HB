import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Mirrors the status values documented on the shared AnnualPlan type. */
export const ANNUAL_PLAN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const;

export class UpdateAnnualPlanStatusDto {
  @ApiProperty({ enum: ANNUAL_PLAN_STATUSES })
  @IsIn(ANNUAL_PLAN_STATUSES)
  status!: (typeof ANNUAL_PLAN_STATUSES)[number];
}
