"use client";

import { useEffect, useState } from "react";
import { 
  Save, 
  Mail, 
  Settings, 
  FileCode, 
  Info, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send 
} from "lucide-react";
import type { User } from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";

interface SettingsClientProps {
  currentUser: User;
  initialSmtpConfig: any;
  initialTemplates: any[];
}

export default function SettingsClient({ 
  currentUser, 
  initialSmtpConfig, 
  initialTemplates 
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"smtp" | "templates">("smtp");
  const [smtp, setSmtp] = useState(initialSmtpConfig);
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("planning");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Test connection states
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Auto-seed templates if db is empty
  useEffect(() => {
    clientApi("/notifications/seed-defaults", { method: "POST" }).then(() => {
      // Reload templates if seeded
      if (initialTemplates.length === 0) {
        window.location.reload();
      }
    });
  }, [initialTemplates]);

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || {
    id: selectedTemplateId,
    subject: "",
    body: ""
  };

  const [subject, setSubject] = useState(activeTemplate.subject);
  const [body, setBody] = useState(activeTemplate.body);

  useEffect(() => {
    if (activeTemplate) {
      setSubject(activeTemplate.subject);
      setBody(activeTemplate.body);
    }
  }, [selectedTemplateId, templates]);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await clientApi("/notifications/smtp-config", {
        method: "PATCH",
        body: JSON.stringify({
          host: smtp.host,
          port: parseInt(smtp.port) || 2525,
          username: smtp.username,
          password: smtp.password,
          secure: smtp.secure,
          fromEmail: smtp.fromEmail
        }),
      });
      showFeedback("success", "SMTP Server configuration saved successfully.");
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to save SMTP configuration.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const updated = await clientApi<any>(`/notifications/email-templates/${selectedTemplateId}`, {
        method: "PATCH",
        body: JSON.stringify({ subject, body }),
      });
      setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? updated : t));
      showFeedback("success", `Custom template for "${selectedTemplateId}" saved successfully.`);
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to save template.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      showFeedback("error", "Please provide a valid recipient email address.");
      return;
    }
    setTesting(true);
    try {
      const result = await clientApi<{ success: boolean; message: string }>("/notifications/send-test-email", {
        method: "POST",
        body: JSON.stringify({ toEmail: testEmail }),
      });
      if (result.success) {
        showFeedback("success", result.message);
      } else {
        showFeedback("error", result.message);
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Failed to send test email.");
    } finally {
      setTesting(false);
    }
  };

  const templateVariables: Record<string, string[]> = {
    planning: ["recipientName", "projectName", "projectCode", "status", "details"],
    meetings: ["recipientName", "projectName", "projectCode", "departments", "visitDate", "ownerName"],
    schedule: ["recipientName", "projectName", "projectCode", "auditPeriod", "leadExecution", "standards"],
    findings: ["recipientName", "projectName", "projectCode", "findingTitle", "severity", "recommendation"]
  };

  return (
    <div className="space-y-6">
      
      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center no-print">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">System Settings</h1>
          <p className="text-xs text-muted-foreground">Configure SMTP mail server parameters and customize notification templates.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-850 gap-4 no-print">
        <button
          onClick={() => setActiveTab("smtp")}
          className={`pb-2.5 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "smtp"
              ? "border-[#05375c] text-[#05375c] dark:border-accent dark:text-accent"
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
          }`}
        >
          <Settings className="w-4 h-4" /> SMTP Configuration
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-2.5 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "templates"
              ? "border-[#05375c] text-[#05375c] dark:border-accent dark:text-accent"
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
          }`}
        >
          <FileCode className="w-4 h-4" /> Email Notification Templates
        </button>
      </div>

      {/* Tabs Content */}
      <div className="grid grid-cols-1 gap-6 no-print">
        {activeTab === "smtp" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SMTP config form */}
            <form onSubmit={handleSaveSmtp} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-6 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Mail className="w-4.5 h-4.5 text-[#05375c] dark:text-accent" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Outbound Mail Server settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">SMTP Hostname</label>
                  <input
                    type="text"
                    required
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    placeholder="e.g. smtp.mailtrap.io"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">SMTP Port</label>
                  <input
                    type="number"
                    required
                    value={smtp.port}
                    onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                    placeholder="e.g. 587 or 2525"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Username</label>
                  <input
                    type="text"
                    value={smtp.username}
                    onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                    placeholder="e.g. your_smtp_user"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Password</label>
                  <input
                    type="password"
                    value={smtp.password}
                    onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                    placeholder="••••••••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Sender Email Address</label>
                  <input
                    type="email"
                    required
                    value={smtp.fromEmail}
                    onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                    placeholder="e.g. alerts@auditdesk.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="secure-toggle"
                    checked={smtp.secure}
                    onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                    className="w-4 h-4 rounded text-accent accent-accent bg-slate-100 border-slate-300 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="secure-toggle" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Use Secure SSL/TLS (Port 465 recommended)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer transition-colors"
              >
                {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save SMTP Settings
              </button>
            </form>

            {/* Test Connection module */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Send className="w-4.5 h-4.5 text-[#05375c] dark:text-accent" />
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Test SMTP Credentials</h2>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Send a fast diagnostic verification email using your saved SMTP configurations to ensure notifications reach users.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Recipient Email</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="e.g. test@yourdomain.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <button
                onClick={handleTestSmtp}
                disabled={testing || !testEmail}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750 text-xs font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Diagnostic Email
              </button>
            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Template edit form */}
            <form onSubmit={handleSaveTemplate} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4.5 h-4.5 text-[#05375c] dark:text-accent" />
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-sans">Template Customization</h2>
                </div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-850 rounded-md px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                >
                  <option value="planning">Audit Planning Scoping Alerts</option>
                  <option value="meetings">Open Meetings Invitations</option>
                  <option value="schedule">Execution Schedules Release</option>
                  <option value="findings">Audit Findings Ledger Alerts</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Subject Template</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Audit Planning Update - {{projectCode}}"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Body Template (HTML)</label>
                  <span className="text-[9px] font-sans text-slate-400 italic">Supports HTML & raw text</span>
                </div>
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="<p>Enter template body...</p>"
                  className="w-full h-80 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saveLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer transition-colors"
              >
                {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Custom Template
              </button>
            </form>

            {/* Template Variables Helper Guide */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Info className="w-4.5 h-4.5 text-[#05375c] dark:text-accent" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Merge Variables</h2>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Use the following placeholder tokens. The system automatically interpolates them before sending notifications to involved project members.
              </p>

              <div className="space-y-3 pt-2">
                {templateVariables[selectedTemplateId]?.map((variable) => (
                  <div key={variable} className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/40 rounded flex flex-col gap-1">
                    <span className="font-sans text-xs text-[#05375c] dark:text-accent font-bold">
                      {"{{"}
                      {variable}
                      {"}}"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {variable === "recipientName" && "The full name of the email recipient."}
                      {variable === "projectName" && "The descriptive name of the linked Audit Plan."}
                      {variable === "projectCode" && "The standard audit plan registration identifier (e.g. AUD-2026-001)."}
                      {variable === "status" && "The current workspace status of the plan or finding record."}
                      {variable === "details" && "Context details, remarks, or revision feedback."}
                      {variable === "departments" && "The auditee's corporate/department governance name."}
                      {variable === "visitDate" && "Scheduled execution visit dates."}
                      {variable === "ownerName" && "The creator or chairperson of the meeting."}
                      {variable === "auditPeriod" && "Dates representing the scoping timeframe."}
                      {variable === "leadExecution" && "Lead internal auditor assigned for execution."}
                      {variable === "standards" && "Compliance standard tags (e.g. ISO 27001)."}
                      {variable === "findingTitle" && "The brief title outlining the nonconformity."}
                      {variable === "severity" && "Severity classifications: LOW, MEDIUM, HIGH, CRITICAL."}
                      {variable === "recommendation" && "The Auditor's recommended mitigation actions."}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
