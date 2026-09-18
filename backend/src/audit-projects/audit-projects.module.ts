import { Module } from '@nestjs/common';
import { AuditProjectsService } from './audit-projects.service';
import { AuditProjectsController } from './audit-projects.controller';
import { CodeGeneratorModule } from '../code-generator/code-generator.module';

@Module({
  imports: [CodeGeneratorModule],
  controllers: [AuditProjectsController],
  providers: [AuditProjectsService],
  exports: [AuditProjectsService],
})
export class AuditProjectsModule {}
