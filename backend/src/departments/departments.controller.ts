import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { SetDepartmentActiveDto } from './dto/set-department-active.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermission('departments:view')
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  @RequirePermission('departments:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_DEPARTMENT',
    details: `Created department "${req.body.code}" (${req.body.name})`,
  }))
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(
      dto.code,
      dto.name,
      dto.description ?? '',
      dto.businessUnitId,
    );
  }

  @Patch(':id')
  @RequirePermission('departments:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_DEPARTMENT',
    details: `Updated department "${req.params.id}" (${req.body.name})`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(
      id,
      dto.name,
      dto.description ?? '',
      dto.businessUnitId,
    );
  }

  @Patch(':id/active')
  @RequirePermission('departments:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: req.body.isActive ? 'ACTIVATE_DEPARTMENT' : 'DEACTIVATE_DEPARTMENT',
    details: `${req.body.isActive ? 'Reactivated' : 'Deactivated'} department ID: ${req.params.id}`,
  }))
  setActive(@Param('id') id: string, @Body() dto: SetDepartmentActiveDto) {
    return this.departmentsService.setActive(id, dto.isActive);
  }
}
