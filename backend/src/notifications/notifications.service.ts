import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto';
import { FindingAlertItemDto } from './dto/send-findings-alert.dto';

export interface SimulatedAlert {
  to: string;
  subject: string;
  body: string;
}

interface MailRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentName?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── SMTP config ──────────────────────────────────────────────────────

  async getSmtpConfig() {
    let config = await this.prisma.smtpConfig.findFirst();
    if (!config) {
      config = await this.prisma.smtpConfig.create({
        data: {
          id: 'default',
          host: 'smtp.mailtrap.io',
          port: 2525,
          username: '',
          password: '',
          secure: false,
          fromEmail: 'alerts@auditdesk.com',
        },
      });
    }
    return config;
  }

  async updateSmtpConfig(data: UpdateSmtpConfigDto) {
    return this.prisma.smtpConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
  }

  // ── Email templates ──────────────────────────────────────────────────

  async getEmailTemplates() {
    return this.prisma.emailTemplate.findMany({ orderBy: { id: 'asc' } });
  }

  async getEmailTemplate(id: string) {
    return this.prisma.emailTemplate.findUnique({ where: { id } });
  }

  async updateEmailTemplate(id: string, subject: string, body: string) {
    return this.prisma.emailTemplate.update({
      where: { id },
      data: { subject, body },
    });
  }

  /** Seeds the default SMTP config + the 4 standard templates the first time no templates exist. */
  async seedDefaults(): Promise<void> {
    const count = await this.prisma.emailTemplate.count();
    if (count === 0) {
      await this.updateSmtpConfig({
        host: 'smtp.mailtrap.io',
        port: 2525,
        username: '',
        password: '',
        secure: false,
        fromEmail: 'alerts@auditdesk.com',
      });

      await this.updateEmailTemplate(
        'planning',
        'Audit Planning Scoping Update - {{projectCode}}',
        '<p>Hello {{recipientName}},</p><p>An update has occurred on the scoping document for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Current Status: <strong>{{status}}</strong></p><p>Details: {{details}}</p><p>Best regards,<br/>Audit Management System</p>',
      );
      await this.updateEmailTemplate(
        'meetings',
        'Open Meeting Schedule Invitation - {{projectName}}',
        '<p>Hello {{recipientName}},</p><p>A new open alignment meeting has been scheduled for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Department(s): {{departments}}</p><p>Visit Date: {{visitDate}}</p><p>Owner: {{ownerName}}</p><p>Please review and join the meeting ledger.</p>',
      );
      await this.updateEmailTemplate(
        'schedule',
        'Execution Schedule Released - {{projectCode}}',
        '<p>Hello {{recipientName}},</p><p>An execution schedule and document request list has been updated for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Audit Period: {{auditPeriod}}</p><p>Lead Execution: {{leadExecution}}</p><p>Standards: {{standards}}</p><p>Please upload the requested files as soon as possible.</p>',
      );
      await this.updateEmailTemplate(
        'findings',
        'New Audit Finding Registered - {{projectCode}}',
        '<p>Hello {{recipientName}},</p><p>A new compliance nonconformity has been logged under <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Finding: <strong>{{findingTitle}}</strong></p><p>Severity: <strong>{{severity}}</strong></p><p>Recommendation: {{recommendation}}</p>',
      );
    }
  }

  // ── Sending ──────────────────────────────────────────────────────────

  async sendTestEmail(
    toEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const smtp = await this.getSmtpConfig();
    if (!smtp.host || !smtp.username || !smtp.password) {
      return {
        success: false,
        message:
          'SMTP is not fully configured (host, username, and password are required).',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
      });

      await transporter.sendMail({
        from: smtp.fromEmail || 'alerts@auditdesk.com',
        to: toEmail,
        subject: 'AuditDesk SMTP Test Email',
        text: 'If you receive this email, your SMTP configuration on AuditDesk is set up correctly!',
        html: '<p>If you receive this email, your SMTP configuration on AuditDesk is set up correctly!</p>',
      });

      return { success: true, message: 'Test email sent successfully!' };
    } catch (error: any) {
      console.error('Test email failed:', error);
      let userMessage = error.message || 'Failed to send email.';
      if (error.code === 'ENETUNREACH' || userMessage.includes('ENETUNREACH')) {
        userMessage = `Network unreachable (${userMessage}). Please verify your internet connection or check if your SMTP host/port parameters are blocked by a firewall (e.g. standard IPv6 routing is unavailable or Port 587 is blocked).`;
      } else if (
        error.code === 'ETIMEDOUT' ||
        userMessage.includes('timeout')
      ) {
        userMessage =
          'SMTP connection timed out. Check your server hostname, port, and security (SSL/TLS) toggle.';
      } else if (
        userMessage.includes('auth') ||
        userMessage.includes('Authentication') ||
        userMessage.includes('credentials')
      ) {
        userMessage =
          'SMTP Authentication failed. Please verify your SMTP Username and Password credentials.';
      }
      return { success: false, message: userMessage };
    }
  }

  async sendMeetingReleaseNotification(
    scheduleId: string,
  ): Promise<{ success: boolean; simulatedAlerts: SimulatedAlert[] }> {
    try {
      const schedule = await this.prisma.executionSchedule.findUnique({
        where: { id: scheduleId },
        include: { project: true },
      });
      if (!schedule) {
        return { success: false, simulatedAlerts: [] };
      }

      const allUsers = await this.prisma.user.findMany();
      const recipientMap = new Map<string, (typeof allUsers)[number]>();
      const attendeeNames = [
        schedule.leadExecution,
        schedule.teamMembers,
        schedule.additionalAttendees,
      ]
        .flatMap((value) => (value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean);

      for (const attendeeName of attendeeNames) {
        const match = allUsers.find((user) => user.name === attendeeName);
        if (match?.email) {
          recipientMap.set(match.email, match);
        }
      }

      const recipients = Array.from(recipientMap.values());
      if (recipients.length === 0) {
        return { success: true, simulatedAlerts: [] };
      }

      const smtp = await this.getSmtpConfig();
      const simulatedAlerts: SimulatedAlert[] = [];
      const projectName = schedule.project?.name || 'Open Meeting Report';
      const projectCode = schedule.project?.code || 'N/A';
      const subject = `Open Meeting Report Released - ${projectCode}`;
      const body = `
        <p>Hello {{recipientName}},</p>
        <p>The open meeting report for <strong>${projectName}</strong> (${projectCode}) has been released and is now locked.</p>
        <p>Meeting Date: <strong>${schedule.actualVisitDate || 'N/A'}</strong></p>
        <p>Facilitator: <strong>${schedule.leadExecution || 'N/A'}</strong></p>
        <p>Status: <strong>Released</strong></p>
        <p>Please review the finalized record.</p>
      `;

      const hasSmtpConfig = smtp.host && smtp.username && smtp.password;
      let transporter: ReturnType<typeof nodemailer.createTransport> | null =
        null;
      if (hasSmtpConfig) {
        transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: { user: smtp.username, pass: smtp.password },
        });
      }

      for (const recipient of recipients) {
        const finalBody = body.replace('{{recipientName}}', recipient.name);
        simulatedAlerts.push({ to: recipient.email, subject, body: finalBody });
        if (transporter) {
          transporter
            .sendMail({
              from: smtp.fromEmail || 'alerts@auditdesk.com',
              to: recipient.email,
              subject,
              html: finalBody,
            })
            .catch((err: any) => {
              console.error(
                `Failed to send meeting release email to ${recipient.email}:`,
                err,
              );
            });
        }
      }

      return { success: true, simulatedAlerts };
    } catch (error) {
      console.error('sendMeetingReleaseNotification error:', error);
      return { success: false, simulatedAlerts: [] };
    }
  }

  async sendEmailNotification(
    templateId: string,
    projectId: string,
    variables: Record<string, string>,
  ): Promise<{ success: boolean; simulatedAlerts: SimulatedAlert[] }> {
    try {
      const project = await this.prisma.auditProject.findUnique({
        where: { id: projectId },
        include: { auditors: true },
      });
      if (!project) {
        return { success: false, simulatedAlerts: [] };
      }

      const allUsers = await this.prisma.user.findMany();
      const recipientsMap = new Map<string, (typeof allUsers)[number]>();

      if (project.leadAuditorId) {
        const lead = allUsers.find(
          (u) =>
            u.id === project.leadAuditorId || u.name === project.leadAuditorId,
        );
        if (lead) recipientsMap.set(lead.email, lead);
      }

      for (const auditor of project.auditors) {
        recipientsMap.set(auditor.email, auditor);
      }

      if (project.deptPicIds) {
        const picIds = project.deptPicIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
        for (const picId of picIds) {
          const pic = allUsers.find((u) => u.id === picId || u.name === picId);
          if (pic) recipientsMap.set(pic.email, pic);
        }
      }

      const recipients = Array.from(recipientsMap.values());
      if (recipients.length === 0) {
        return { success: true, simulatedAlerts: [] };
      }

      const smtp = await this.getSmtpConfig();
      const template = await this.getEmailTemplate(templateId);
      if (!template) {
        return { success: false, simulatedAlerts: [] };
      }

      const simulatedAlerts: SimulatedAlert[] = [];
      const baseVars: Record<string, string> = {
        projectName: project.name,
        projectCode: project.code,
        ...variables,
      };

      const hasSmtpConfig = smtp.host && smtp.username && smtp.password;
      let transporter: ReturnType<typeof nodemailer.createTransport> | null =
        null;
      if (hasSmtpConfig) {
        transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: {
            user: smtp.username,
            pass: smtp.password,
          },
        });
      }

      for (const recipient of recipients) {
        const recipientVars: Record<string, string> = {
          ...baseVars,
          recipientName: recipient.name,
        };

        const finalSubject = this.interpolateTemplate(
          template.subject,
          recipientVars,
        );
        const finalBody = this.interpolateTemplate(
          template.body,
          recipientVars,
        );

        simulatedAlerts.push({
          to: recipient.email,
          subject: finalSubject,
          body: finalBody,
        });

        if (transporter) {
          transporter
            .sendMail({
              from: smtp.fromEmail || 'alerts@auditdesk.com',
              to: recipient.email,
              subject: finalSubject,
              html: finalBody,
            })
            .catch((err: any) => {
              console.error(
                `Failed to send real email to ${recipient.email}:`,
                err,
              );
            });
        }
      }

      return { success: true, simulatedAlerts };
    } catch (error) {
      console.error('sendEmailNotification error:', error);
      return { success: false, simulatedAlerts: [] };
    }
  }

  /**
   * Ported from sendFindingsAlertEmailAction. Notably this does NOT create a nodemailer
   * transporter or send anything - it only builds subject/body previews (and, in the
   * original, logged one activity-log entry per recipient). The frontend pre-computes
   * `alertItems` via the shared parseFindingAlerts/groupFindingAlerts helpers and passes
   * them straight in, so no parsing happens on this side.
   */
  async sendFindingsAlertEmail(
    alertItems: FindingAlertItemDto[],
    customNote?: string,
  ): Promise<{ success: boolean; simulatedAlerts: SimulatedAlert[] }> {
    try {
      const projects = await this.prisma.auditProject.findMany({
        include: { auditors: true },
      });
      const allUsers = await this.getUsersWithDepartment();
      const simulatedAlerts: SimulatedAlert[] = [];

      for (const item of alertItems) {
        const project = projects.find(
          (p) => p.id === item.projectId || p.name === item.projectName,
        );
        const recipientsMap = new Map<string, MailRecipient>();

        if (project) {
          if (project.leadAuditorId) {
            const lead = allUsers.find(
              (u) =>
                u.id === project.leadAuditorId ||
                u.name === project.leadAuditorId,
            );
            if (lead) recipientsMap.set(lead.email, lead);
          }
          for (const auditorId of project.auditors.map((a) => a.id)) {
            const auditor = allUsers.find((u) => u.id === auditorId);
            if (auditor) recipientsMap.set(auditor.email, auditor);
          }
          if (project.deptPicIds) {
            const picIds = project.deptPicIds
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean);
            for (const picId of picIds) {
              const pic = allUsers.find(
                (u) => u.id === picId || u.name === picId,
              );
              if (pic) recipientsMap.set(pic.email, pic);
            }
          }
        }

        // Fallback to department matching users if no specific project recipients found
        if (recipientsMap.size === 0 && item.departments) {
          const deptUsers = allUsers.filter((u) =>
            item.departments
              ?.toLowerCase()
              .includes(u.departmentName?.toLowerCase() || ''),
          );
          deptUsers.forEach((u) => recipientsMap.set(u.email, u));
        }

        // Final fallback to admins
        if (recipientsMap.size === 0) {
          const admins = allUsers.filter((u) => u.role === 'ADMIN');
          admins.forEach((u) => recipientsMap.set(u.email, u));
        }

        const issueText =
          item.alertType === 'MISSING_FINAL_DATE'
            ? 'Corrective Final Date has NOT been input yet.'
            : 'Corrective Final Date has been input, but item is pending resolution sign-off.';

        const subject = `[Audit Desk Alert] Action Required: NCN ${item.documentCode || 'Finding'} Reminder`;

        for (const recipient of Array.from(recipientsMap.values())) {
          const body = `
            <p>Dear <strong>${recipient.name}</strong>,</p>
            <p>This is an official notification from the <strong>Internal Audit Team</strong> regarding pending Nonconformity Notice (NCN) action items requiring your attention:</p>
            <ul>
              <li><strong>Document Code:</strong> ${item.documentCode || 'N/A'}</li>
              <li><strong>Audit Project:</strong> ${item.projectName || 'N/A'}</li>
              <li><strong>Department:</strong> ${item.departments || 'N/A'}</li>
              <li><strong>Finding Activity:</strong> ${item.activity}</li>
              <li><strong>Alert Condition:</strong> <span style="color: #dc2626; font-weight: bold;">${issueText}</span></li>
              <li><strong>Target Action Date:</strong> ${item.correctiveActionDate || 'Not set'}</li>
              ${item.correctiveFinalDate ? `<li><strong>Corrective Final Date:</strong> ${item.correctiveFinalDate}</li>` : ''}
            </ul>
            ${customNote ? `<div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0;"><strong>Audit Team Note:</strong> ${customNote}</div>` : ''}
            <p>Please log in to AuditDesk Findings Portal to complete the input or mark the item as resolved.</p>
          `;

          simulatedAlerts.push({
            to: recipient.email,
            subject,
            body,
          });
        }
      }

      return { success: true, simulatedAlerts };
    } catch (error) {
      console.error('sendFindingsAlertEmail error:', error);
      return { success: false, simulatedAlerts: [] };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async getUsersWithDepartment(): Promise<MailRecipient[]> {
    const users = await this.prisma.user.findMany({
      include: { department: true },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentName: u.department?.name ?? null,
    }));
  }

  /** `{{var}}` interpolation against an EmailTemplate's subject/body, ported from actions.ts. */
  private interpolateTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }
}
