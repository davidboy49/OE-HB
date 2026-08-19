import { Module } from '@nestjs/common';
import { AnnualPlansService } from './annual-plans.service';
import { AnnualPlansController } from './annual-plans.controller';
import { AuditPlansService } from './audit-plans.service';
import { AuditPlansController } from './audit-plans.controller';

@Module({
  controllers: [AnnualPlansController, AuditPlansController],
  providers: [AnnualPlansService, AuditPlansService],
  exports: [AnnualPlansService, AuditPlansService],
})
export class PlanningModule {}
