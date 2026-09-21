import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessUnitsService } from './business-units.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('business-units')
@ApiBearerAuth()
@Controller('business-units')
export class BusinessUnitsController {
  constructor(private readonly businessUnitsService: BusinessUnitsService) {}

  @Get()
  findAll() {
    return this.businessUnitsService.findAll();
  }

  @Post()
  @RequirePermission('business-units:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_BUSINESS_UNIT',
    details: `Created business unit "${req.body.id}" (${req.body.name})`,
  }))
  create(@Body() dto: CreateBusinessUnitDto) {
    return this.businessUnitsService.create(
      dto.id,
      dto.name,
      dto.description ?? '',
    );
  }

  @Patch(':id')
  @RequirePermission('business-units:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_BUSINESS_UNIT',
    details: `Updated business unit "${req.params.id}" (${req.body.name})`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateBusinessUnitDto) {
    return this.businessUnitsService.update(
      id,
      dto.name,
      dto.description ?? '',
    );
  }

  @Delete(':id')
  @RequirePermission('business-units:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_BUSINESS_UNIT',
    details: `Deleted business unit "${req.params.id}"`,
  }))
  remove(@Param('id') id: string) {
    return this.businessUnitsService.remove(id);
  }
}
