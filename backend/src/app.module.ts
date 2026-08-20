import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PermissionsCommonModule } from './common/permissions-common.module';
import { AuthModule } from './auth/auth.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { UserGroupsModule } from './user-groups/user-groups.module';
import { CodeGeneratorModule } from './code-generator/code-generator.module';
import { AuditProjectsModule } from './audit-projects/audit-projects.module';
import { FindingsModule } from './findings/findings.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { PlanningModule } from './planning/planning.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExecutionSchedulesModule } from './execution-schedules/execution-schedules.module';
import { MeetingsModule } from './meetings/meetings.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PermissionsCommonModule,
    ActivityLogsModule,
    AuthModule,
    DepartmentsModule,
    UsersModule,
    UserGroupsModule,
    CodeGeneratorModule,
    AuditProjectsModule,
    FindingsModule,
    AttachmentsModule,
    PlanningModule,
    NotificationsModule,
    ExecutionSchedulesModule,
    MeetingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: JwtAuthGuard populates req.user before PermissionsGuard reads it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
