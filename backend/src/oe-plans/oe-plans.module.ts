import { Module } from '@nestjs/common';
import { OePlansService } from './oe-plans.service';
import { OePlansController } from './oe-plans.controller';
import { CodeGeneratorModule } from '../code-generator/code-generator.module';

@Module({
  imports: [CodeGeneratorModule],
  controllers: [OePlansController],
  providers: [OePlansService],
  exports: [OePlansService],
})
export class OePlansModule {}
