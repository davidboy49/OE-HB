"use client";

import { useState } from "react";
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User as UserIcon, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  Send, 
  Sparkles, 
  Lock, 
  ChevronRight, 
  ArrowLeft,
  MessageSquare,
  BadgeCheck
} from "lucide-react";
import Link from "next/link";
import { clientApi } from "@/lib/apiClient";
import { formatPlanItemsAsText } from "@auditdesk/shared";

interface ScanClientProps {
  schedule: any;
  departmentsList: any[];
  qrToken: string;
  projectMeetingsList?: any[];
}

export default function ScanClient({
  schedule: initialSchedule,
  departmentsList,
  qrToken,
  projectMeetingsList = []
}: ScanClientProps) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [consentStatus, setConsentStatus] = useState<"ACCEPTED" | "REVISION_REQUESTED">("ACCEPTED");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // No JWT for an anonymous QR scanner - the consenting person's identity is collected
  // as plain form fields and sent directly in the consent request body.
  const [consentName, setConsentName] = useState("");
  const [consentEmail, setConsentEmail] = useState("");

  const meetingsToUse = projectMeetingsList && projectMeetingsList.length > 0 ? projectMeetingsList : [schedule];

  // Parse Schedule Rows & Departments
  let scheduleRows: any[] = [];
  try {
    scheduleRows = typeof schedule.scheduleRows === "string" ? JSON.parse(schedule.scheduleRows) : schedule.scheduleRows || [];
  } catch {
    scheduleRows = [];
  }

  let consents: Record<string, any> = {};
  try {
    consents = typeof schedule.departmentConsents === "string" ? JSON.parse(schedule.departmentConsents) : schedule.departmentConsents || {};
  } catch {
    consents = {};
  }

  const allConsents: Record<string, any> = {};
  meetingsToUse.forEach(m => {
    try {
      const c = typeof m.departmentConsents === "string" ? JSON.parse(m.departmentConsents) : m.departmentConsents || {};
      Object.assign(allConsents, c);
    } catch (e) {}
  });

  // Determine Available Departments for this schedule
  const availableDeptsRaw: string[] = meetingsToUse
    .map((m: any) => m.departments)
    .filter(Boolean);

  // Anonymous public visitor - no session, so there is no user department to derive.
  // Default to the first available department for the scanned meeting/schedule.
  const defaultSelectedDept = availableDeptsRaw[0] || "General";

  const [selectedDept, setSelectedDept] = useState<string>(defaultSelectedDept);

  const selectDepartment = (dept: string) => {
    setSelectedDept(dept);
    const matchingMeeting = meetingsToUse.find(m => m.departments === dept);
    if (matchingMeeting) {
      setSchedule(matchingMeeting);
    }
  };

  // Filter schedule rows matching selected department (or show all if matches conductBy / pIncharge)
  const scopedScheduleRows = scheduleRows.filter((row: any) => {
    if (!selectedDept || selectedDept === "General") return true;
    const searchTarget = `${row.activity || ""} ${row.pIncharge || ""} ${row.conductBy || ""}`.toLowerCase();
    return searchTarget.includes(selectedDept.toLowerCase()) || scheduleRows.length <= 2;
  });

  const currentDeptConsent = consents[selectedDept] || null;

  const handleConsentSubmit = async (statusToSet: "ACCEPTED" | "REVISION_REQUESTED") => {
    if (!consentName.trim() || !consentEmail.trim()) {
      alert("Please enter your name and email before submitting.");
      return;
    }
    try {
      setIsSubmitting(true);
      const updatedSchedule = await clientApi(`/meetings/qr/${qrToken}/consent`, {
        method: "POST",
        body: JSON.stringify({
          departmentId: selectedDept,
          status: statusToSet,
          acceptedByUserName: consentName,
          acceptedByUserEmail: consentEmail,
          comments: remarks,
        }),
      });
      setSchedule(updatedSchedule);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      alert("Failed to record consent: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Banner Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/meetings" 
              className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Return to Audit Desk"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {schedule.projectCode || "OPEN MEETING"}
                </span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Visit {schedule.visitNumber}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1">
                {schedule.projectName || "Audit Open Meeting Agenda & Scope"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-slate-200">External Visitor</p>
              <p className="text-[11px] text-slate-400 font-mono">Public QR Access</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
              V
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Dynamic Context Header Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 shadow-xl">
          <div className="absolute top-0 right-0 p-8 text-indigo-500/10 pointer-events-none">
            <Building2 className="w-48 h-48 -mr-10 -mt-10" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Visit Date: <strong className="text-white">{schedule.actualVisitDate || "Scheduled"}</strong></span>
                <span className="text-slate-600">•</span>
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Audit Period: <strong className="text-white">{schedule.auditPeriod || "N/A"}</strong></span>
              </div>
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Official Scope Verification Portal
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Lead Execution Auditor</span>
                <p className="font-semibold text-slate-200 mt-1">{schedule.leadExecution || "Lead Auditor"}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Target Audit Location</span>
                <p className="font-semibold text-slate-200 mt-1 truncate">{schedule.address || "HQ Offices"}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Involved Departments</span>
                <p className="font-semibold text-indigo-300 mt-1 truncate">{schedule.departments || "All Departments"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Department Switcher & Consent Status Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Department Scope Selector
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableDeptsRaw.length > 0 ? (
              availableDeptsRaw.map((deptName) => {
                const isSelected = selectedDept.toLowerCase() === deptName.toLowerCase();
                const deptConsent = allConsents[deptName];
                const isAccepted = deptConsent?.status === "ACCEPTED";
                const isRevision = deptConsent?.status === "REVISION_REQUESTED";

                return (
                  <button
                    key={deptName}
                    onClick={() => selectDepartment(deptName)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    }`}
                  >
                    <span>{deptName}</span>
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Accepted
                      </span>
                    )}
                    {isRevision && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                        <AlertCircle className="w-3 h-3" /> Revision
                      </span>
                    )}
                    {!deptConsent && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                        Pending
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <button
                onClick={() => selectDepartment("General")}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium"
              >
                General Department Scope
              </button>
            )}
          </div>
        </div>

        {/* Scoped Agenda & Audit Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Columns: Agenda & Scope */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Scoped Objectives & Scope Text */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-indigo-400" />
                Audit Scope & Objectives for <span className="text-indigo-400">{selectedDept}</span>
              </h3>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1 text-xs">Audit Objectives:</h4>
                  <p className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-slate-300 whitespace-pre-wrap">
                    {formatPlanItemsAsText(schedule.objectives) || `Evaluate internal controls, compliance with procedures, operational efficiency, and risk mitigation across ${selectedDept} workflows.`}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-200 mb-1 text-xs">Defined Audit Scope:</h4>
                  <p className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-slate-300 whitespace-pre-wrap">
                    {formatPlanItemsAsText(schedule.scope) || `Covers operational procedures, execution logs, document trails, system permissions, and sample verification for the target period.`}
                  </p>
                </div>

                {schedule.departmentConcern && (
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-1 text-xs">The Concern of the Department Owner:</h4>
                    <div 
                      className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-slate-300 rich-text-content"
                      dangerouslySetInnerHTML={{ __html: schedule.departmentConcern }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Scoped Agenda Rows Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Meeting Agenda & Timeline
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {scopedScheduleRows.length} Scheduled Activities
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Activity Description</th>
                      <th className="py-2.5 px-3">Conducted By</th>
                      <th className="py-2.5 px-3">Person In Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {scopedScheduleRows.length > 0 ? (
                      scopedScheduleRows.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono text-indigo-300 whitespace-nowrap">
                            <div>{row.date || schedule.actualVisitDate}</div>
                            <div className="text-[11px] text-slate-400">{row.time || "TBD"}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-200 font-medium">
                            {row.activity}
                          </td>
                          <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                            {row.conductBy || schedule.leadExecution}
                          </td>
                          <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                              {row.pIncharge || selectedDept}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No specific schedule rows filtered for {selectedDept}. Full agenda applies.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Consent Sign-off & Audit Log */}
          <div className="space-y-6">
            
            {/* Consent Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-emerald-400" />
                  Department Scope Consent
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedDept}
                </span>
              </div>

              {/* Status Display if already submitted */}
              {currentDeptConsent ? (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    {currentDeptConsent.status === "ACCEPTED" ? (
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {currentDeptConsent.status === "ACCEPTED" ? "Scope Approved & Confirmed" : "Revision Requested"}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {new Date(currentDeptConsent.timestamp).toLocaleString("en-GB")}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 border-t border-slate-800/80 pt-2 space-y-1">
                    <p><span className="text-slate-400">Signed By:</span> <strong className="text-white">{currentDeptConsent.acceptedByUserName}</strong></p>
                    <p><span className="text-slate-400">Email:</span> <span className="font-mono text-slate-300">{currentDeptConsent.acceptedByUserEmail}</span></p>
                    {currentDeptConsent.comments && (
                      <p className="mt-2 text-slate-400 italic bg-slate-900 p-2 rounded border border-slate-800/60">
                        "{currentDeptConsent.comments}"
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Pending scope acknowledgment for {selectedDept}.</span>
                </div>
              )}

              {/* Interactive Form for Auditee or Auditor */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300">Your Name</label>
                    <input
                      type="text"
                      required
                      value={consentName}
                      onChange={(e) => setConsentName(e.target.value)}
                      placeholder="Full name"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300">Your Email</label>
                    <input
                      type="email"
                      required
                      value={consentEmail}
                      onChange={(e) => setConsentEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <label className="block text-xs font-medium text-slate-300">
                  Optional Remarks / Scope Notes:
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter any notes, clarification requests, or confirmation remarks..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                />

                {submitSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Consent sign-off successfully recorded!</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleConsentSubmit("ACCEPTED")}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting ? "Saving..." : "Accept Scope"}
                  </button>

                  <button
                    onClick={() => handleConsentSubmit("REVISION_REQUESTED")}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Request Revision
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 text-center pt-1 font-mono">
                  Sign-off is timestamped and recorded in the audit trail.
                </p>
              </div>

            </div>

            {/* Audit Trail Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-md">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Overall Meeting Consent Status
              </h3>
              <div className="space-y-2">
                {availableDeptsRaw.map((d) => {
                  const c = consents[d];
                  return (
                    <div key={d} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                      <span className="font-medium text-slate-300">{d}</span>
                      {c?.status === "ACCEPTED" ? (
                        <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accepted ({new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      ) : c?.status === "REVISION_REQUESTED" ? (
                        <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Revision
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-400">
        AuditDesk Corporate Governance Platform • ISO 19011 Compliant Audit Management System
      </footer>

    </div>
  );
}
