"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Users, 
  Building, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  FileDown, 
  X, 
  Calendar, 
  Clock, 
  Info,
  ChevronRight,
  AlertTriangle,
  Lock,
  Unlock,
  BadgeCheck,
  CheckCircle2,
  CheckCircle
} from "lucide-react";
import type {
  User,
  AuditProject,
  ExecutionSchedule as FindingReport,
  ScheduleRow,
  Department
} from "@auditdesk/shared";

interface FindingRow extends ScheduleRow {
  correctiveActionDate?: string;
  correctiveActionRemarks?: string;
  correctiveFinalDate?: string;
  correctiveFinalRemarks?: string;
  correctiveFinalUser?: string;
  correctiveFinalDatetime?: string;
  attachments?: any[];
}
import { parsePlanItems } from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import RichEditor from "@/components/ui/rich-editor";
import MultiSelect from "@/components/ui/multi-select";
import ExecScheduleSelect from "@/components/ui/exec-schedule-select";

// Helper to format date strings for display
const formatDateString = (dateStr: string) => {
  if (!dateStr) return "Date not selected";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    try {
      const parts = dateStr.split('-');
      const year = parts[0];
      const monthIndex = parseInt(parts[1]) - 1;
      const day = parts[2];
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  }
  return dateStr;
};

// Helper to check if an HTML string is empty or contains only whitespace/empty tags
const isHtmlEmpty = (html?: string) => {
  if (!html) return true;
  const clean = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
  return clean === "";
};

const escapeHtml = (value?: string) =>
  (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const plainTextToHtml = (value?: string) => {
  const escaped = escapeHtml(value).trim();
  if (!escaped) return "";
  return `<p>${escaped.replace(/\r?\n/g, "<br />")}</p>`;
};
// Helpers to parse and format HTML5 time picker values
const parseTimeRange = (timeStr: string) => {
  if (!timeStr) return { from: "09:00", to: "10:00" };
  const parts = timeStr.split(/-|\u2013/);
  const fromPart = parts[0]?.trim() || "09:00";
  const toPart = parts[1]?.trim() || "10:00";

  const to24h = (s: string) => {
    const clean = s.toLowerCase().replace(/\s+/g, "");
    const match = clean.match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
    if (!match) {
      const numbersOnly = clean.replace(/[^0-9:]/g, "");
      if (numbersOnly.includes(":")) {
        const [h, m] = numbersOnly.split(":");
        return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      }
      return "09:00";
    }
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3];
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  return { from: to24h(fromPart), to: to24h(toPart) };
};

const formatTimeRange = (from: string, to: string) => {
  const to12h = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    let hours = parseInt(h);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${m} ${ampm}`;
  };
  return `${to12h(from)} - ${to12h(to)}`;
};

interface FindingsClientProps {
  initialSchedules: FindingReport[];
  releasedExecSchedules: FindingReport[];
  projects: AuditProject[];
  users: User[];
  departments: Department[];
  currentUser: User;
}

export default function FindingsClient({ 
  initialSchedules, 
  releasedExecSchedules,
  projects, 
  users, 
  departments,
  currentUser 
}: FindingsClientProps) {
  const [schedules, setSchedules] = useState<FindingReport[]>(initialSchedules);
  
  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");

  // Selection & Modal
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  
  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedExecScheduleId, setSelectedExecScheduleId] = useState("");
  const [departmentsStr, setDepartmentsStr] = useState("");
  const [address, setAddress] = useState("HB-HQ");
  const [visitNumber, setVisitNumber] = useState("NCN #001/26");
  const [actualVisitDate, setActualVisitDate] = useState("");
  const [auditPeriod, setAuditPeriod] = useState("");
  const [leadExecution, setLeadExecution] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [additionalAttendees, setAdditionalAttendees] = useState("");
  const [standards, setStandards] = useState("Operational and Compliance Gaps in Sales Operation Execution");
  const [language, setLanguage] = useState("finding"); // Hidden type flag
  const [objectives, setObjectives] = useState("");
  const [scope, setScope] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [rows, setRows] = useState<FindingRow[]>([]);
  const [findingStatus, setFindingStatus] = useState<"DRAFT" | "RELEASED">("DRAFT");
  // Active row index for card editing
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  // Draft state for unsaved edits in configuring slot
  const [draftRow, setDraftRow] = useState<FindingRow | null>(null);

  const isLocked = findingStatus === "RELEASED";

  const linkedExecSched = releasedExecSchedules.find(s => s.id === selectedExecScheduleId);
  const linkedRows = useMemo(() => {
    if (!linkedExecSched?.scheduleRows) return [];
    try {
      return JSON.parse(linkedExecSched.scheduleRows);
    } catch {
      return [];
    }
  }, [linkedExecSched]);

  // Feedback notifier
  const [feedback, setFeedback] = useState<string | null>(null);

  // Custom dialog alert states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  // Convert teamMembers string to array for MultiSelect component
  const teamMembersArray = teamMembers
    ? teamMembers.split(",").map(name => name.trim()).filter(Boolean)
    : [];

  // Convert leadExecution string to array for MultiSelect component
  const leadExecutionArray = leadExecution
    ? leadExecution.split(",").map(name => name.trim()).filter(Boolean)
    : [];

  // Convert additionalAttendees string to array for MultiSelect component
  const additionalAttendeesArray = additionalAttendees ? additionalAttendees.split(",").map(s => s.trim()).filter(Boolean) : [];
  const setAdditionalAttendeesArray = (vals: string[]) => setAdditionalAttendees(vals.join(", "));

  // Convert departments string to array for MultiSelect component
  const departmentsArray = departmentsStr ? departmentsStr.split(",").map(s => s.trim()).filter(Boolean) : [];
  const setDepartmentsArray = (vals: string[]) => setDepartmentsStr(vals.join(", "));

  // Options derived from users in system
  const userOptions = users.map(u => ({
    value: u.name,
    label: u.name,
    subLabel: `${u.role.replace("_", " ")}${u.email ? ` - ${u.email}` : ""}`, 
  }));

  const isProjectMember = (proj: any) => {
    if (!proj) return false;
    if (currentUser.role === "ADMIN") return true;
    if (proj.leadAuditorId === currentUser.id || proj.leadAuditorId === currentUser.name) return true;
    const auditorsList = proj.auditorNames ? proj.auditorNames.split(",").map((s: string) => s.trim()) : [];
    if (auditorsList.includes(currentUser.name)) return true;
    if (proj.auditorIds?.includes(currentUser.id)) return true;
    const picList = proj.deptPicIds ? proj.deptPicIds.split(",") : [];
    if (picList.includes(currentUser.id) || picList.includes(currentUser.name)) return true;
    return false;
  };

  const isScheduleOrMeetingAllowed = (sched: any) => {
    if (!sched) return false;
    if (currentUser.role === "ADMIN") return true;
    if (sched.ownerName === currentUser.name || sched.lastModifiedBy === currentUser.name) return true;
    const proj = projects.find(p => p.id === sched.projectId);
    return isProjectMember(proj);
  };

  const canManage = true;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Prepopulate fields when a released Execution Schedule is selected
  const handleExecScheduleSelect = (schedId: string) => {
    setSelectedExecScheduleId(schedId);
    if (!schedId) {
      setSelectedProjectId("");
      setDepartmentsStr("");
      setLeadExecution("");
      setTeamMembers("");
      setAdditionalAttendees("");
      setActualVisitDate("");
      setAuditPeriod("");
      setObjectives("");
      setScope("");
      return;
    }

    const execSched = releasedExecSchedules.find(s => s.id === schedId);
    if (!execSched) return;

    // Carry over the parent project id so the finding stays linked to the plan
    setSelectedProjectId(execSched.projectId);
    setDepartmentsStr(execSched.departments || "");
    setLeadExecution(execSched.leadExecution || "");
    setTeamMembers(execSched.teamMembers || "");
    setAdditionalAttendees(execSched.additionalAttendees || "");
    setActualVisitDate(""); // user fills in finding date separately
    setAuditPeriod(execSched.auditPeriod || "");

    const proj = projects.find(p => p.id === execSched.projectId);
    setObjectives(proj?.objectives || "");
    setScope(proj?.scope || "");
    setRows([]);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedProjectId("");
    setSelectedExecScheduleId("");
    setDepartmentsStr("");
    setAddress("");
    setVisitNumber("");
    setActualVisitDate("");
    setAuditPeriod("");
    setLeadExecution("");
    setTeamMembers("");
    setAdditionalAttendees("");
    setStandards("");
    setLanguage("finding");
    setObjectives("");
    setScope("");
    setRows([]);
    setAttachments([]);
    setFindingStatus("DRAFT");
    setIsModalOpen(true);
  };

  const openEditModal = (sched: FindingReport) => {
    setModalMode("edit");
    setSelectedProjectId(sched.projectId);
    // Try to find the originating exec schedule by projectId + departments match
    const linkedExecSched = releasedExecSchedules.find(
      s => s.projectId === sched.projectId && s.departments === sched.departments
    );
    setSelectedExecScheduleId(linkedExecSched?.id || "");
    setDepartmentsStr(sched.departments);
    setAddress(sched.address);
    setVisitNumber(sched.visitNumber);
    setActualVisitDate(sched.actualVisitDate);
    setAuditPeriod(sched.auditPeriod);
    setLeadExecution(sched.leadExecution);
    setTeamMembers(sched.teamMembers);
    setAdditionalAttendees(sched.additionalAttendees);
    setStandards(sched.standards);
    setLanguage(sched.language || "finding");
    setObjectives(sched.objectives);
    setScope(sched.scope);
    setAttachments(sched.attachments ? JSON.parse(sched.attachments) : []);
    
    try {
      setRows(JSON.parse(sched.scheduleRows));
    } catch {
      setRows([]);
    }
    
    setFindingStatus((sched.status as any) || "DRAFT");
    setSelectedScheduleId(sched.id);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get("id");
      if (idParam) {
        const sched = schedules.find(s => s.id === idParam);
        if (sched) {
          setSelectedScheduleId(sched.id);
          setTimeout(() => {
            openEditModal(sched);
          }, 100);
        }
      }
    }
  }, [schedules]);

  const persistFindingReport = async (
    targetStatus: "DRAFT" | "RELEASED",
    options: { closeAfterSave?: boolean; customRows?: any[] } = {}
  ) => {
    if (findingStatus === "RELEASED" && targetStatus !== "DRAFT") {
      showFeedback("This findings report is already released. Reopen it before making edits.");
      return false;
    }

    if (!selectedExecScheduleId || !departmentsStr || !actualVisitDate) {
      showFeedback("Please select an Execution Schedule, department, and finding date before saving.");
      return false;
    }

    const payload = {
      projectId: selectedProjectId,
      departments: departmentsStr,
      address,
      visitNumber,
      actualVisitDate,
      auditPeriod,
      leadExecution,
      teamMembers,
      additionalAttendees,
      standards,
      language: "finding",
      status: targetStatus,
      objectives,
      scope,
      scheduleRows: JSON.stringify(options.customRows || rows),
      attachments: JSON.stringify(attachments),
      ownerName: modalMode === "create" ? currentUser.name : (schedules.find(x => x.id === selectedScheduleId)?.ownerName || currentUser.name),
      lastModifiedBy: currentUser.name,
    };

    try {
      let savedId = selectedScheduleId;
      const shouldClose = options.closeAfterSave ?? false;

      if (modalMode === "create") {
        const result = await clientApi<FindingReport>("/execution-schedules", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result) return false;
        savedId = result.id || savedId;
        setSelectedScheduleId(savedId || null);
        setModalMode("edit");
        setFindingStatus(targetStatus);
      } else {
        if (!selectedScheduleId) return false;
        const result = await clientApi<FindingReport>(`/execution-schedules/${selectedScheduleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (!result) return false;
        setFindingStatus(targetStatus);
      }

      const fresh = await clientApi<FindingReport[]>("/execution-schedules");
      setSchedules(fresh.filter((s) => s.language === "finding"));

      if (targetStatus === "RELEASED") {
        const emailResult = await clientApi<{ success: boolean; simulatedAlerts: any[] }>("/notifications/send-email", {
          method: "POST",
          body: JSON.stringify({
            templateId: "findings",
            projectId: payload.projectId,
            variables: {
              findingTitle: payload.departments,
              severity: payload.standards,
              recommendation: rows.map(r => r.recommendation).filter(Boolean).join(", ") || "Please review recommendations."
            }
          }),
        });
        if (emailResult.success) {
          for (const alert of emailResult.simulatedAlerts) {
            window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
          }
        }
      }

      showFeedback(
        targetStatus === "RELEASED"
          ? "Audit findings report released and locked."
          : modalMode === "create"
            ? "Audit findings report created successfully."
            : "Audit findings changes saved."
      );

      if (shouldClose) setIsModalOpen(false);
      return true;
    } catch (err: any) {
      console.error(err);
      showFeedback(`Save failed: ${err.message || err.toString()}`);
      return false;
    }
  };

  const handleSaveSchedule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await persistFindingReport("DRAFT", { closeAfterSave: false });
  };

  const handleReleaseFinding = async () => {
    await persistFindingReport("RELEASED", { closeAfterSave: false });
  };

  const handleReopenFinding = async () => {
    if (!selectedScheduleId) return;
    try {
      const result = await clientApi<FindingReport>(`/execution-schedules/${selectedScheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "DRAFT",
          lastModifiedBy: currentUser.name
        }),
      });
      if (result) {
        setFindingStatus("DRAFT");
        const fresh = await clientApi<FindingReport[]>("/execution-schedules");
        setSchedules(fresh.filter((s) => s.language === "finding"));
        showFeedback("Findings report reopened for editing.");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Reopen failed: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedScheduleId) return;
    const s = schedules.find(x => x.id === selectedScheduleId);
    if (!s) return;

    showConfirm(
      "Delete Audit Findings Report",
      `Are you sure you want to delete the findings report for "${s.projectName}"? This action cannot be undone.`,
      async () => {
        try {
          const success = await clientApi<boolean>(`/execution-schedules/${selectedScheduleId}`, {
            method: "DELETE",
          });
          if (success) {
            showFeedback("Report removed from ledger.");
            setSelectedScheduleId(null);
            const fresh = await clientApi<FindingReport[]>("/execution-schedules");
            setSchedules(fresh.filter((s) => s.language === "finding"));
          }
        } catch (err: any) {
          console.error(err);
          showFeedback(`Delete error: ${err.message || err.toString()}`);
        }
      }
    );
  };

  // Interactive Row Editor Handlers
  const startEditingRow = (index: number) => {
    setActiveRowIndex(index);
    const row = { ...rows[index] };
    
    // If structured fields do not exist but pIncharge does, parse them
    if (!row.correctiveActionRemarks && !row.correctiveActionDate && row.pIncharge) {
      if (row.pIncharge.includes("Corrective action:") || row.pIncharge.includes("Corrective Action")) {
        const parts = row.pIncharge.split(/Completed Corrective Action Date:|Corrective Action Date:/i);
        const remarksHtml = parts[0]?.replace(/<strong>Corrective action:<\/strong>/i, '')
                                   .replace(/Corrective action:/i, '')
                                   .trim() || "";
        row.correctiveActionRemarks = remarksHtml;
        if (parts[1]) {
          const cleanHtml = (html: string) => {
            return html
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .trim();
          };
          const dateStr = cleanHtml(parts[1]);
          const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          const shortMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          const dateParts = dateStr.toLowerCase().split(/\s+/);
          if (dateParts.length === 3) {
            const day = dateParts[0].replace(/[^0-9]/g, "").padStart(2, '0');
            const mIndex = months.indexOf(dateParts[1]) !== -1 ? months.indexOf(dateParts[1]) : shortMonths.indexOf(dateParts[1]);
            const year = dateParts[2].replace(/[^0-9]/g, "");
            if (mIndex !== -1 && day && year) {
              row.correctiveActionDate = `${year}-${(mIndex + 1).toString().padStart(2, '0')}-${day}`;
            }
          }
        }
      } else {
        row.correctiveActionRemarks = row.pIncharge;
      }
    }
    
    setDraftRow(row);
  };

  const startCreatingRow = () => {
    if (modalMode === "create" || !selectedScheduleId) {
      showFeedback("Please save changes before adding a Finding Line.");
      return;
    }

    setActiveRowIndex(-1);
    setDraftRow({
      date: "",
      time: "",
      activity: "",
      conductBy: "",
      pIncharge: "",
      implication: "",
      recommendation: "",
      correctiveActionDate: "",
      correctiveActionRemarks: "",
      correctiveFinalDate: "",
      correctiveFinalRemarks: "",
      auditScope: "",
      attachments: []
    });
  };

  const cancelRowEdit = () => {
    setActiveRowIndex(null);
    setDraftRow(null);
  };

  const saveRowEdit = async () => {
    if (!draftRow) return;
    
    // Validation: Linked Audit Scope selection is mandatory!
    if (!draftRow.auditScope || draftRow.auditScope.trim() === "") {
      alert("Please select a Linked Audit Scope first.");
      return;
    }
    
    // Compile structured fields into pIncharge HTML for compatibility
    let compiledHtml = "";
    if (draftRow.correctiveActionDate || !isHtmlEmpty(draftRow.correctiveActionRemarks)) {
      compiledHtml += `<strong>Corrective action:</strong> ${draftRow.correctiveActionRemarks || ""}`;
      if (draftRow.correctiveActionDate) {
        compiledHtml += `<br/><br/><strong>Completed Corrective Action Date:</strong> ${formatDateString(draftRow.correctiveActionDate)}`;
      }
    }
    if (draftRow.correctiveFinalDate || !isHtmlEmpty(draftRow.correctiveFinalRemarks)) {
      if (compiledHtml) compiledHtml += "<br/><br/>";
      compiledHtml += `<strong>Final Verification Remarks:</strong> ${draftRow.correctiveFinalRemarks || ""}`;
      if (draftRow.correctiveFinalDate) {
        compiledHtml += `<br/><br/><strong>Completed Final Verification Date:</strong> ${formatDateString(draftRow.correctiveFinalDate)}`;
      }
    }
    
    const updatedDraft = {
      ...draftRow,
      pIncharge: compiledHtml || draftRow.pIncharge
    };
    
    let updated: any[] = [];
    if (activeRowIndex === -1) {
      updated = [...rows, updatedDraft];
    } else if (activeRowIndex !== null) {
      updated = [...rows];
      updated[activeRowIndex] = updatedDraft;
    }
    
    setRows(updated);
    setActiveRowIndex(null);
    setDraftRow(null);

    // Auto-save the draft immediately
    await persistFindingReport("DRAFT", { customRows: updated });
  };

  const deleteRowItem = (index: number) => {
    showConfirm(
      "Delete Line Item",
      "Are you sure you want to remove this finding line item from the report?",
      async () => {
        const updated = rows.filter((_, idx) => idx !== index);
        setRows(updated);
        await persistFindingReport("DRAFT", { customRows: updated });
      }
    );
  };

  const moveRowUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...rows];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setRows(updated);
    await persistFindingReport("DRAFT", { customRows: updated });
  };

  const completedFinalRowsCount = rows.filter(row => !!row.correctiveFinalUser).length;
  const pendingFinalRowsCount = rows.filter(row => !row.correctiveFinalUser).length;

  const markDraftRowFinalized = () => {
    if (!draftRow) return;
    
    // If it's already completed, we toggle it back to pending
    if (draftRow.correctiveFinalUser) {
      setDraftRow({
        ...draftRow,
        correctiveFinalUser: "",
        correctiveFinalDatetime: ""
      });
      return;
    }
    
    // Otherwise, mark as completed with current user and datetime
    const today = new Date();
    
    setDraftRow({
      ...draftRow,
      correctiveFinalUser: currentUser.name,
      correctiveFinalDatetime: today.toISOString()
    });
  };
  const moveRowDown = async (index: number) => {
    if (index === rows.length - 1) return;
    const updated = [...rows];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setRows(updated);
    await persistFindingReport("DRAFT", { customRows: updated });
  };

  // Filtered schedules for rendering in list
  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.departments?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.standards?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "ALL" || s.projectId === projectFilter;
    return matchesSearch && matchesProject;
  });

  const projectFilterOptions = projects.map(p => ({
    label: `ID: ${p.code} - ${p.name}`,
    value: p.id
  }));

  const activeSchedule = schedules.find(s => s.id === selectedScheduleId);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Feedback Popup Alert */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Confirmation Dialog Box */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-sm p-6 space-y-4 shadow-xl text-left">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-semibold cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="flex justify-between items-center no-print">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">OE Findings</h1>
          <p className="text-xs text-muted-foreground">Outline nonconformities, observations, and corrective actions from departments.</p>
        </div>
      </div>

      {/* Main layout table ledger */}
      <div className="space-y-6 no-print">
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          
          {/* ActionToolbar */}
          <ActionToolbar
            onCreate={openCreateModal}
            onEdit={selectedScheduleId && activeSchedule && isScheduleOrMeetingAllowed(activeSchedule) ? () => openEditModal(activeSchedule) : undefined}
            onDelete={selectedScheduleId && activeSchedule && isScheduleOrMeetingAllowed(activeSchedule) ? handleDeleteSchedule : undefined}
            onRefresh={() => {
              setSearchQuery("");
              setProjectFilter("ALL");
              setSelectedScheduleId(null);
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchPlaceholder="Search findings..."
            filterLabel="Project"
            filterValue={projectFilter}
            setFilterValue={setProjectFilter}
            filterOptions={projectFilterOptions}
            activeFilterCountLabel={projectFilter === "ALL" ? "ALL" : "FILTERED"}
          />

          {/* List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                <tr>
                  <th className="px-6 py-4">Audit Plan Code</th>
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Finding Date</th>
                  <th className="px-6 py-4">Lead Auditors</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                      No findings reports matched filters or none have been created. Click "+" above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((s) => (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedScheduleId(s.id === selectedScheduleId ? null : s.id)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                        s.id === selectedScheduleId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                      }`}
                    >
                      <td className="px-6 py-4.5 font-sans text-slate-700 dark:text-slate-300">
                        {s.projectCode}
                      </td>
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScheduleId(s.id);
                          openEditModal(s);
                        }}
                        className="px-6 py-4.5 text-[#0066cc] font-medium hover:underline cursor-pointer"
                      >
                        {s.projectName}
                      </td>
                      <td className="px-6 py-4.5 text-slate-600 dark:text-slate-400">
                        {s.departments}
                      </td>
                      <td className="px-6 py-4.5 text-slate-600 dark:text-slate-400">
                        {s.actualVisitDate}
                      </td>
                      <td className="px-6 py-4.5 text-slate-700 dark:text-slate-300">
                        {s.leadExecution}
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                          {s.status === "RELEASED" ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              Released
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Draft
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit Findings Report Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 overflow-y-auto p-4 no-print animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-7xl shadow-2xl flex flex-col max-h-[94vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 rounded-t-lg shrink-0">
              <div>
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">DOCUMENT 4. OE FINDINGS</span>
                <h2 className="text-lg font-roboto font-bold text-slate-800 dark:text-slate-100">
                  OE Findings Report
                </h2>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] font-roboto text-slate-400 mt-1">
                  {modalMode === "edit" && activeSchedule ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {findingStatus === "RELEASED" ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                          Released
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-slate-400" />
                          Draft
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Draft
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {modalMode === "edit" && canManage && !isLocked && (
                  <button
                    type="button"
                    onClick={handleDeleteSchedule}
                    className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-900/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export PDF
                </button>
                {!isLocked ? (
                  <button
                    type="button"
                    onClick={handleSaveSchedule}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReopenFinding}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 text-xs font-bold rounded cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Reopen
                  </button>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleReleaseFinding}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold rounded cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" /> Release
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveSchedule} className={`p-8 space-y-8 overflow-y-auto max-h-[86vh] ${isLocked ? "opacity-70" : ""}`}>
              
              {/* Linked Execution Schedule strip */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 no-print">
                <div className="flex border border-slate-250 dark:border-slate-800 rounded-lg h-12 items-center">
                  <div className="bg-slate-50 dark:bg-slate-900/60 px-4 h-full flex items-center font-roboto font-bold text-xs text-slate-700 dark:text-slate-355 border-r border-slate-250 dark:border-slate-800 shrink-0 w-44 rounded-l-lg">
                    Execution Schedule
                  </div>
                  <div className="px-4 h-full flex items-center flex-1 bg-white dark:bg-slate-950">
                    {modalMode === "create" ? (
                      <ExecScheduleSelect
                        schedules={releasedExecSchedules}
                        projects={projects}
                        selectedExecScheduleId={selectedExecScheduleId}
                        onSelect={handleExecScheduleSelect}
                        placeholder="Choose Released Execution Schedule..."
                      />
                    ) : (
                      <div className="flex items-center gap-2 overflow-hidden">
                        {(() => {
                          const es = releasedExecSchedules.find(s => s.id === selectedExecScheduleId);
                          if (es) {
                            const p = projects.find(proj => proj.id === es.projectId);
                            return (
                              <>
                                <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                                  {es.projectCode || p?.code}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {p?.name || "Unknown OE Plan"}
                                </span>
                                <span className="text-slate-550 dark:text-slate-400 shrink-0">
                                  — {es.departments} ({es.actualVisitDate})
                                </span>
                              </>
                            );
                          }
                          const proj = projects.find(p => p.id === selectedProjectId);
                          if (proj) {
                            return (
                              <>
                                <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                                  {proj.code}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {proj.name}
                                </span>
                              </>
                            );
                          }
                          return <span className="text-xs font-bold text-slate-800 dark:text-slate-200">—</span>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Document Summary Info Grid matching the user's blue rounded border 2-column table design */}
              <div className="space-y-4">
                <div className="border border-[#0066cc] rounded-lg relative z-30">
                  <table className="w-full border-collapse text-xs">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {/* Row 1: Department — single value derived from Execution Schedule */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Department
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200">
                            {departmentsStr || "—"}
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: NCN */}
                      <tr className="align-middle">
                        <td className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-[#0066cc]/40 text-slate-700 dark:text-slate-300">
                          NCN
                        </td>
                        <td className="px-6 py-3">
                          <input 
                            type="text" 
                            value={visitNumber}
                            onChange={(e) => setVisitNumber(e.target.value)}
                            placeholder="NCN #001/26"
                            className="w-full bg-transparent border-none p-0 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>

                      {/* Row 3: Execution Date */}
                      <tr className="align-middle">
                        <td className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-[#0066cc]/40 text-slate-700 dark:text-slate-300">
                          Execution Date
                        </td>
                        <td className="px-6 py-3">
                          <input 
                            type="date" 
                            required
                            value={actualVisitDate}
                            onChange={(e) => setActualVisitDate(e.target.value)}
                            placeholder="e.g. 22 April 2026"
                            className="w-full bg-transparent border-none p-0 text-xs focus:outline-none font-bold text-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>

                      {/* Row 4: Lead Auditors */}
                      <tr className="align-middle relative z-30">
                        <td className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-[#0066cc]/40 text-slate-700 dark:text-slate-300">
                          Lead Auditors
                        </td>
                        <td className="px-6 py-2.5">
                          <MultiSelect
                            selectedValues={leadExecutionArray}
                            onChange={(values) => setLeadExecution(values.join(", "))}
                            options={userOptions}
                            placeholder="Select lead auditors..."
                          />
                        </td>
                      </tr>

                      {/* Row 5: Auditors */}
                      <tr className="align-middle relative z-20">
                        <td className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-[#0066cc]/40 text-slate-700 dark:text-slate-300">
                          Auditors
                        </td>
                        <td className="px-6 py-2.5">
                          <MultiSelect
                            selectedValues={teamMembersArray}
                            onChange={(values) => setTeamMembers(values.join(", "))}
                            options={userOptions}
                            placeholder="Select auditors..."
                          />
                        </td>
                      </tr>

                      {/* Row 6: Reviewee */}
                      <tr className="align-middle relative z-10">
                        <td className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-[#0066cc]/40 text-slate-700 dark:text-slate-300">
                          Reviewee
                        </td>
                        <td className="px-6 py-2.5">
                          <MultiSelect
                            selectedValues={additionalAttendeesArray}
                            onChange={(values) => setAdditionalAttendees(values.join(", "))}
                            options={userOptions}
                            placeholder="Select department reviewees..."
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Finding Rows Builder */}
              <div className="space-y-4">
                <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Finding & Nonconformity Line Items
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Final corrections remaining: {pendingFinalRowsCount} pending, {completedFinalRowsCount} completed.
                      </p>
                    </div>
                    {canManage && activeRowIndex === null && (
                      <button
                        type="button"
                        onClick={startCreatingRow}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#0066cc] text-white hover:bg-[#004499] text-[10px] font-bold rounded cursor-pointer transition-colors shadow-xs self-start lg:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Finding Line
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/15">
                      Pending {pendingFinalRowsCount}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/15">
                      Completed {completedFinalRowsCount}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                      Total {rows.length}
                    </span>
                  </div>
                </div>
                {activeRowIndex !== null && draftRow && (
                  <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 flex justify-center items-center z-[60] p-4 animate-fade-in no-print">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl md:max-w-5xl h-[90vh] max-h-[850px] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-slide-up">
                      <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                        <div>
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[9px] font-sans font-bold text-slate-555 dark:text-slate-400">
                            ROW #{activeRowIndex === -1 ? rows.length + 1 : activeRowIndex + 1}
                          </span>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                            {activeRowIndex === -1 ? "Add Finding Line Item" : `Configure Finding Row #${activeRowIndex + 1}`}
                          </h3>
                        </div>
                        <button 
                          type="button"
                          onClick={cancelRowEdit}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-6 space-y-4 flex-1 overflow-y-auto text-left">
                        <div className="space-y-4">
                          {/* Linked Audit Scope Selection */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                              Linked OE Scope <span className="text-red-500">*</span>
                            </label>
                            <MultiSelect
                              singleSelect={true}
                              selectedValues={draftRow.auditScope ? [draftRow.auditScope] : []}
                              onChange={(values) => setDraftRow({ ...draftRow, auditScope: values[0] || "" })}
                              options={parsePlanItems(scope, "IAP-ISCP").map(obj => ({
                                value: obj.id,
                                label: obj.id,
                                subLabel: obj.text
                              }))}
                              placeholder="Select a linked OE scope..."
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase block mb-1">Findings & Observation</label>
                            <RichEditor 
                              value={draftRow.activity} 
                              onChange={(html) => setDraftRow({ ...draftRow, activity: html })} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase block mb-1">Implication</label>
                            <RichEditor 
                              value={draftRow.implication || ""} 
                              onChange={(html) => setDraftRow({ ...draftRow, implication: html })} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase block mb-1">Recommendation</label>
                            <RichEditor 
                              value={draftRow.recommendation || ""} 
                              onChange={(html) => setDraftRow({ ...draftRow, recommendation: html })} 
                            />
                          </div>
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase block">
                                Management 's response & corrective action
                              </label>
                              <div className="border-b border-slate-250 dark:border-slate-800 my-2" />
                            </div>

                            <div className="space-y-4">
                              <div className="border border-slate-200 dark:border-slate-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 rounded-md p-4 bg-white dark:bg-slate-950/20 space-y-4 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  <span className="text-sm  font-bold text-slate-700 dark:text-slate-300 w-40 sm:shrink-0">
                                    Corrective Action Date:
                                  </span>
                                  <input 
                                    type="date"
                                    required
                                    value={draftRow.correctiveActionDate || ""}
                                    onChange={(e) => setDraftRow({ ...draftRow, correctiveActionDate: e.target.value })}
                                    className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer w-full max-w-[200px]"
                                  />
                                </div>
                                <div className="space-y-3">
                                  <label className="text-sm  font-semibold text-slate-700 dark:text-slate-300 w-40 sm:shrink-0">Remarks</label>
                                  <RichEditor 
                                    value={draftRow.correctiveActionRemarks || ""} 
                                    onChange={(html) => setDraftRow({ ...draftRow, correctiveActionRemarks: html })} 
                                  />
                                </div>
                              </div>

                              <div className="border border-slate-200 dark:border-slate-800 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 rounded-md p-4 bg-white dark:bg-slate-950/20 space-y-4 transition-all">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-40 sm:shrink-0">
                                        Corrective Final Date:
                                      </span>
                                      <input 
                                        type="date"
                                        required
                                        value={draftRow.correctiveFinalDate || ""}
                                        onChange={(e) => setDraftRow({ ...draftRow, correctiveFinalDate: e.target.value })}
                                        className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer w-full max-w-[200px]"
                                      />
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {draftRow.correctiveFinalUser && (
                                        <div className="flex flex-col text-xs text-slate-500 text-right">
                                          <span>Resolved by {draftRow.correctiveFinalUser}</span>
                                          <span>at {draftRow.correctiveFinalDatetime ? new Date(draftRow.correctiveFinalDatetime).toLocaleString() : ""}</span>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={markDraftRowFinalized}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-bold transition-colors ${
                                          draftRow.correctiveFinalUser
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
                                            : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
                                        }`}
                                      >
                                        {draftRow.correctiveFinalUser ? "Resolved" : "Resolve"}
                                      </button>
                                    </div>
                                  </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-40 sm:shrink-0">Remarks</label>
                                  <RichEditor 
                                    value={draftRow.correctiveFinalRemarks || ""} 
                                    onChange={(html) => setDraftRow({ ...draftRow, correctiveFinalRemarks: html })} 
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Row Attachments */}
                          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase block mb-1">
                              Row Attachments
                            </label>
                            <input
                              type="file"
                              className="block w-full text-xs text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-xs file:font-semibold
                                file:bg-[#0066cc]/10 file:text-[#0066cc]
                                hover:file:bg-[#0066cc]/20
                              "
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result;
                                  if (typeof base64 === 'string') {
                                    const currentAttachments = draftRow.attachments || [];
                                    setDraftRow({
                                      ...draftRow,
                                      attachments: [...currentAttachments, {
                                        id: Date.now().toString(),
                                        name: file.name,
                                        size: file.size,
                                        type: file.type,
                                        data: base64
                                      }]
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                                e.target.value = ''; // reset input
                              }}
                            />
                            {draftRow.attachments && draftRow.attachments.length > 0 && (
                              <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                                {draftRow.attachments.map((att: any) => (
                                  <li key={att.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <div className="flex items-center gap-3">
                                      <FileDown className="w-4 h-4 text-slate-400" />
                                      <a href={att.data} download={att.name} className="text-sm font-medium text-[#0066cc] hover:underline">
                                        {att.name}
                                      </a>
                                      <span className="text-xs text-slate-500">({Math.round(att.size / 1024)} KB)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDraftRow({
                                          ...draftRow,
                                          attachments: draftRow.attachments?.filter((a: any) => a.id !== att.id)
                                        });
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 justify-end shrink-0">
                        <button
                          type="button"
                          onClick={cancelRowEdit}
                          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveRowEdit}
                          className="px-3 py-1.5 bg-[#0066cc] text-white rounded text-xs font-bold hover:bg-[#004499] cursor-pointer"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="overflow-hidden border border-[#0066cc] rounded-lg">
                  <table className="w-full border-collapse text-left text-xs bg-white dark:bg-slate-950">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-[#0066cc] font-bold text-slate-700 dark:text-slate-200">
                        <th className="px-4 py-3 w-[5%] text-center border-r border-[#0066cc]/30">No</th>
                        <th className="px-4 py-3 w-[30%] border-r border-[#0066cc]/30">Linked OE Scope</th>
                        <th className="px-4 py-3 w-[25%] border-r border-[#0066cc]/30">Finding & Observations</th>
                        <th className="px-4 py-3 w-[15%] border-r border-[#0066cc]/30">Implication</th>
                        <th className="px-4 py-3 w-[15%] border-r border-[#0066cc]/30">Recommendation</th>
                        <th className="px-4 py-3 w-[10%] text-center">Status</th>
                        {canManage && <th className="px-4 py-3 w-20 text-center border-l border-[#0066cc]/30 no-print">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-slate-400 italic">
                            No finding line items recorded in this report. Click "Add Finding Line" to add one.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={idx} className="align-top hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-3.5 text-center font-sans text-slate-400 border-r border-slate-200 dark:border-slate-800">{idx + 1}</td>
                            
                            <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800 font-sans text-slate-800 dark:text-slate-200 font-semibold">
                              {row.auditScope ? (
                                <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200">
                                  {row.auditScope}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800">
                              <div className="space-y-1.5">
                                <div className="flex gap-1.5 items-center flex-wrap">
                                  {row.date && <span className="font-bold font-sans text-slate-800 dark:text-slate-200">{row.date}</span>}
                                  {row.time && (
                                    <span className={`font-sans text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                      row.time === "CRITICAL" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                      row.time === "HIGH" ? "bg-orange-500/10 border-orange-500/20 text-orange-500" :
                                      row.time === "MEDIUM" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                      "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                                    }`}>
                                      {row.time}
                                    </span>
                                  )}
                                  {row.conductBy && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">by {row.conductBy}</span>}
                                </div>
                                <div className="prose dark:prose-invert text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: row.activity }} />
                                {row.attachments && row.attachments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {row.attachments.map((att: any) => (
                                      <a key={att.id} href={att.data} download={att.name} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[9px]">
                                        <FileDown className="w-3 h-3" />
                                        <span className="truncate max-w-[100px]">{att.name}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800">
                              <div className="prose dark:prose-invert text-[11px] leading-relaxed text-slate-600 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: !isHtmlEmpty(row.implication) ? row.implication || "" : "" }} />
                            </td>
                            <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800">
                              <div className="prose dark:prose-invert text-[11px] leading-relaxed text-slate-600 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: !isHtmlEmpty(row.recommendation) ? row.recommendation || "" : "" }} />
                            </td>
                            <td className="px-4 pt-4 pb-3 align-top text-center">
                              {row.correctiveFinalUser ? (
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/15 w-24">
                                  Completed
                                </span>
                              ) : row.correctiveFinalDate && row.correctiveFinalDate.trim() !== "" ? (
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/15 w-24">
                                  In Progress
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/15 w-24">
                                  Pending
                                </span>
                              )}
                            </td>
                            {canManage && (
                              <td className="px-4 py-3.5 text-center space-x-1 whitespace-nowrap border-l border-slate-200 dark:border-slate-800 no-print">
                                <button
                                  type="button"
                                  onClick={() => startEditingRow(idx)}
                                  className="p-1 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Edit Line"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRowItem(idx)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Remove Line"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
              </div>

              {/* Attachments Section */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Attachments
                </h3>
                <div className="space-y-3">
                  <input
                    type="file"
                    className="block w-full text-xs text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-xs file:font-semibold
                      file:bg-[#0066cc]/10 file:text-[#0066cc]
                      hover:file:bg-[#0066cc]/20
                    "
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result;
                        if (typeof base64 === 'string') {
                          setAttachments([...attachments, {
                            id: Date.now().toString(),
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            data: base64
                          }]);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = ''; // reset input
                    }}
                  />
                  {attachments.length > 0 && (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {attachments.map((att) => (
                        <li key={att.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <div className="flex items-center gap-3">
                            <FileDown className="w-4 h-4 text-slate-400" />
                            <a href={att.data} download={att.name} className="text-sm font-medium text-[#0066cc] hover:underline">
                              {att.name}
                            </a>
                            <span className="text-xs text-slate-500">({Math.round(att.size / 1024)} KB)</span>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))}
                              className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

