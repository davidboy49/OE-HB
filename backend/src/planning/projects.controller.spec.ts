/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import type { ProjectsService } from './projects.service';
import type { AccessScopeService } from '../common/access-scope.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

const user = {
  sub: 'u1',
  email: 'a@b.c',
  name: 'A',
  departmentId: null,
};

const baseCreate: CreateProjectDto = {
  annualPlanId: 'ap-1',
  no: 'PRJ-001',
  projectName: 'Warehouse Efficiency',
  departmentId: 'dept-1',
  revieweeIds: 'n/a',
  conductDate: '2026-10-05',
  endDate: '2026-10-09',
  durationDay: 5,
  purpose: 'Improve picking',
  scope: JSON.stringify([{ id: 'OE-SCP-01', text: 'Receiving' }]),
};

function makeController() {
  const service = {
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
  } as unknown as ProjectsService;
  const accessScope = {
    assertVisible: jest.fn().mockResolvedValue(undefined),
    assertDepartmentInScope: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessScopeService;
  return {
    controller: new ProjectsController(service, accessScope),
    service,
  };
}

describe('ProjectsController - date range validation', () => {
  it('rejects creating a Project whose end date is before its conduct date', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.create(
        { ...baseCreate, conductDate: '2026-10-09', endDate: '2026-10-05' },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('accepts a valid create where the end date is on or after the conduct date', async () => {
    const { controller, service } = makeController();
    await expect(controller.create(baseCreate, user)).resolves.toBeDefined();
    expect(service.create).toHaveBeenCalled();
  });

  it('rejects updating a Project into an invalid date range', async () => {
    const { controller, service } = makeController();
    const dto: UpdateProjectDto = {
      projectName: 'Warehouse Efficiency',
      departmentId: 'dept-1',
      type: 'OE',
      revieweeIds: 'n/a',
      conductDate: '2026-10-09',
      endDate: '2026-10-05',
      durationDay: 5,
      purpose: 'Improve picking',
    };
    await expect(controller.update('p1', dto, user)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.update).not.toHaveBeenCalled();
  });
});
