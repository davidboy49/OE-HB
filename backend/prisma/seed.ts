import "dotenv/config";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PERMISSIONS, DEFAULT_PERMISSIONS_BY_ROLE } from "../src/common/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Bootstrap password for the seeded admin account only - every other seeded user
// starts with no password (passwordHash: null) and must have one set by an admin
// via PATCH /users/:id/password. Never hardcode this; it must come from the env.
if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error(
    "SEED_ADMIN_PASSWORD is not set. Set it in backend/.env before seeding - " +
      "it becomes the bootstrap admin's login password (no other seeded user gets one)."
  );
}
const seedAdminPassword: string = process.env.SEED_ADMIN_PASSWORD;


async function main() {
  // Clear existing records
  await prisma.documentSequence.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.executionSchedule.deleteMany();
  await prisma.document.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditProject.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.userGroup.deleteMany();
  await prisma.smtpConfig.deleteMany();
  await prisma.emailTemplate.deleteMany();

  console.log("Cleared existing database records.");

  // Seed Document Sequences (starts from 0 so first generated code is AP-2026-0001)
  await prisma.documentSequence.create({
    data: { key: "AP-2026", currentVal: 0 }
  });
  await prisma.documentSequence.create({
    data: { key: "AP-2025", currentVal: 0 }
  });

  // 1. Seed Departments
  const dept1 = await prisma.department.create({
    data: { id: "dept-1", name: "Information Technology", description: "Core IT infrastructure and software development" }
  });
  const dept2 = await prisma.department.create({
    data: { id: "dept-2", name: "Finance & Accounting", description: "Financial reporting, billing, and ledger management" }
  });
  const dept3 = await prisma.department.create({
    data: { id: "dept-3", name: "Information Security", description: "Cybersecurity, risk management, and compliance" }
  });
  const dept4 = await prisma.department.create({
    data: { id: "dept-4", name: "Operations & HR", description: "Day-to-day facilities, staffing, and onboarding" }
  });

  console.log("Departments seeded.");

  // 2. Seed User Groups
  const group1 = await prisma.userGroup.create({
    data: { id: "group-1", name: "Internal Audit Team", description: "Certified internal auditors and leads", role: "AUDITOR" }
  });
  const group2 = await prisma.userGroup.create({
    data: { id: "group-2", name: "Risk Management Committee", description: "Executive oversight for enterprise risks", role: "LEAD_AUDITOR" }
  });
  const group3 = await prisma.userGroup.create({
    data: { id: "group-3", name: "External Auditing Partner", description: "Contracted external compliance specialists", role: "AUDITOR" }
  });

  console.log("User Groups seeded.");

  // Seed every known permission key, then grant each existing group the set
  // matching its `role` - this reproduces pre-permissions-system behavior
  // exactly, so migrating this in doesn't lock anyone out. Admins narrow
  // access per group from here via PATCH /user-groups/:id/permissions.
  await prisma.permission.deleteMany();
  await prisma.permission.createMany({ data: PERMISSIONS });

  await prisma.userGroup.update({
    where: { id: group1.id },
    data: { permissions: { connect: DEFAULT_PERMISSIONS_BY_ROLE.AUDITOR.map((key) => ({ key })) } }
  });
  await prisma.userGroup.update({
    where: { id: group2.id },
    data: { permissions: { connect: DEFAULT_PERMISSIONS_BY_ROLE.LEAD_AUDITOR.map((key) => ({ key })) } }
  });
  await prisma.userGroup.update({
    where: { id: group3.id },
    data: { permissions: { connect: DEFAULT_PERMISSIONS_BY_ROLE.AUDITOR.map((key) => ({ key })) } }
  });

  console.log("Permissions seeded and granted to existing groups.");

  // 3. Seed Users
  const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 10);
  const user1 = await prisma.user.create({
    data: { id: "user-1", email: "admin@auditdesk.com", name: "Alex Admin", role: "ADMIN", passwordHash: adminPasswordHash }
  });
  const user2 = await prisma.user.create({
    data: { id: "user-2", email: "sarah.lead@auditdesk.com", name: "Sarah Lead", role: "LEAD_AUDITOR", departmentId: dept3.id, groupId: group1.id }
  });
  const user3 = await prisma.user.create({
    data: { id: "user-3", email: "david.auditor@auditdesk.com", name: "David Auditor", role: "AUDITOR", departmentId: dept3.id, groupId: group1.id }
  });
  const user4 = await prisma.user.create({
    data: { id: "user-4", email: "alice.auditee@auditdesk.com", name: "Alice Auditee", role: "AUDITEE", departmentId: dept2.id, groupId: group2.id }
  });
  const user5 = await prisma.user.create({
    data: { id: "user-5", email: "bob.developer@auditdesk.com", name: "Bob Developer", role: "AUDITEE", departmentId: dept1.id }
  });

  console.log("Users seeded.");


  // 6. Seed SMTP Config
  await prisma.smtpConfig.create({
    data: {
      id: "default",
      host: "smtp.mailtrap.io",
      port: 2525,
      username: "",
      password: "",
      secure: false,
      fromEmail: "alerts@auditdesk.com"
    }
  });

  // 7. Seed Email Templates
  await prisma.emailTemplate.create({
    data: {
      id: "planning",
      subject: "Audit Planning Scoping Update - {{projectCode}}",
      body: "<p>Hello {{recipientName}},</p><p>An update has occurred on the scoping document for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Current Status: <strong>{{status}}</strong></p><p>Details: {{details}}</p><p>Best regards,<br/>Audit Management System</p>"
    }
  });
  await prisma.emailTemplate.create({
    data: {
      id: "meetings",
      subject: "Open Meeting Schedule Invitation - {{projectName}}",
      body: "<p>Hello {{recipientName}},</p><p>A new open alignment meeting has been scheduled for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Organization: {{organization}}</p><p>Visit Date: {{visitDate}}</p><p>Owner: {{ownerName}}</p><p>Please review and join the meeting ledger.</p>"
    }
  });
  await prisma.emailTemplate.create({
    data: {
      id: "schedule",
      subject: "Execution Schedule Released - {{projectCode}}",
      body: "<p>Hello {{recipientName}},</p><p>An execution schedule and document request list has been updated for <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Audit Period: {{auditPeriod}}</p><p>Lead Execution: {{leadExecution}}</p><p>Standards: {{standards}}</p><p>Please upload the requested files as soon as possible.</p>"
    }
  });
  await prisma.emailTemplate.create({
    data: {
      id: "findings",
      subject: "New Audit Finding Registered - {{projectCode}}",
      body: "<p>Hello {{recipientName}},</p><p>A new compliance nonconformity has been logged under <strong>{{projectName}}</strong> ({{projectCode}}).</p><p>Finding: <strong>{{findingTitle}}</strong></p><p>Severity: <strong>{{severity}}</strong></p><p>Recommendation: {{recommendation}}</p>"
    }
  });

  console.log("SMTP Config and Email Templates seeded.");
  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });