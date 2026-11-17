import { Module } from '@nestjs/common';
import { AnnualPlansService } from './annual-plans.service';
import { AnnualPlansController } from './annual-plans.controller';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  controllers: [AnnualPlansController, ProjectsController],
  providers: [AnnualPlansService, ProjectsService],
  exports: [AnnualPlansService, ProjectsService],
})
export class PlanningModule {}
