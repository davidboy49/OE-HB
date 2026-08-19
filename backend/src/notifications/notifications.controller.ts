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
import { NotificationsService } from './notifications.service';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { SendEmailNotificationDto } from './dto/send-email-notification.dto';
import { SendFindingsAlertDto } from './dto/send-findings-alert.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('smtp-config')
  @RequirePermission('notifications:configure')
  getSmtpConfig() {
    return this.notificationsService.getSmtpConfig();
  }

  @Patch('smtp-config')
  @RequirePermission('notifications:configure')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity(() => ({
    action: 'UPDATE_SMTP_CONFIG',
    details: 'Updated system SMTP server configuration settings',
  }))
  updateSmtpConfig(@Body() dto: UpdateSmtpConfigDto) {
    return this.notificationsService.updateSmtpConfig(dto);
  }

  @Get('email-templates')
  @RequirePermission('notifications:configure')
  getEmailTemplates() {
    return this.notificationsService.getEmailTemplates();
  }

  @Patch('email-templates/:id')
  @RequirePermission('notifications:configure')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_EMAIL_TEMPLATE',
    details: `Updated email template for "${req.params.id}"`,
  }))
  updateEmailTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.notificationsService.updateEmailTemplate(
      id,
      dto.subject,
      dto.body,
    );
  }

  @Post('seed-defaults')
  @RequirePermission('notifications:configure')
  seedDefaults() {
    return this.notificationsService.seedDefaults();
  }

  @Post('send-test-email')
  @RequirePermission('notifications:send-test')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'SEND_TEST_EMAIL',
    details: result?.success
      ? `Sent SMTP test email to ${req.body.toEmail}`
      : `Attempted to send SMTP test email to ${req.body.toEmail}: ${result?.message}`,
  }))
  sendTestEmail(@Body() dto: SendTestEmailDto) {
    return this.notificationsService.sendTestEmail(dto.toEmail);
  }

  @Post('send-meeting-release/:scheduleId')
  @RequirePermission('notifications:send')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'SEND_MEETING_RELEASE_NOTIFICATION',
    details: `Sent meeting release notification for schedule ID: ${req.params.scheduleId} to ${result?.simulatedAlerts?.length ?? 0} recipient(s)`,
  }))
  sendMeetingReleaseNotification(@Param('scheduleId') scheduleId: string) {
    return this.notificationsService.sendMeetingReleaseNotification(scheduleId);
  }

  @Post('send-email')
  @RequirePermission('notifications:send')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'SEND_EMAIL_NOTIFICATION',
    details: `Sent email notification for template "${req.body.templateId}" to ${result?.simulatedAlerts?.length ?? 0} recipient(s)`,
  }))
  sendEmailNotification(@Body() dto: SendEmailNotificationDto) {
    return this.notificationsService.sendEmailNotification(
      dto.templateId,
      dto.projectId,
      dto.variables ?? {},
    );
  }

  @Post('send-findings-alert')
  @RequirePermission('notifications:send')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'SEND_FINDINGS_ALERT_EMAIL',
    details: `Sent findings alert reminder(s) for ${req.body.alertItems?.length ?? 0} item(s) to ${result?.simulatedAlerts?.length ?? 0} recipient(s)`,
  }))
  sendFindingsAlertEmail(@Body() dto: SendFindingsAlertDto) {
    return this.notificationsService.sendFindingsAlertEmail(
      dto.alertItems,
      dto.customNote,
    );
  }
}
