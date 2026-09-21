import { Module } from '@nestjs/common';
import { AnnualPlansService } from './annual-plans.service';
import { AnnualPlansController } from './annual-plans.controller';
import { PlannedEngagementsService } from './planned-engagements.service';
import { PlannedEngagementsController } from './planned-engagements.controller';

@Module({
  controllers: [AnnualPlansController, PlannedEngagementsController],
  providers: [AnnualPlansService, PlannedEngagementsService],
  exports: [AnnualPlansService, PlannedEngagementsService],
})
export class PlanningModule {}
