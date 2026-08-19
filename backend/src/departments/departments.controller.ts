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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  @RequirePermission('departments:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_DEPARTMENT',
    details: `Created department "${req.body.id}" (${req.body.name})`,
  }))
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(
      dto.id,
      dto.name,
      dto.description ?? '',
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
    return this.departmentsService.update(id, dto.name, dto.description ?? '');
  }

  @Delete(':id')
  @RequirePermission('departments:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_DEPARTMENT',
    details: `Deleted department "${req.params.id}"`,
  }))
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
