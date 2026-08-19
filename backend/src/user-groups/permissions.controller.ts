import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserGroupsService } from './user-groups.service';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly userGroupsService: UserGroupsService) {}

  /** All known capability keys + descriptions, for rendering the permission matrix. */
  @Get()
  findAll() {
    return this.userGroupsService.listAllPermissions();
  }
}
