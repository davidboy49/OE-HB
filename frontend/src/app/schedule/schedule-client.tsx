"use client";

import { useState, useEffect } from "react";
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
  BookOpen,
  Lock,
  Unlock,
  BadgeCheck,
  CheckCircle2,
  Layers
} from "lucide-react";
import type {
  ExecutionSchedule,
  OpenMeeting,
  AuditProject,
  User,
  Department,
  ScheduleRow
} from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import RichEditor from "@/components/ui/rich-editor";
import MultiSelect from "@/components/ui/multi-select";
import OpenMeetingSelect from "@/components/ui/open-meeting-select";
import PlanItemEditor from "@/components/ui/plan-item-editor";
import { parsePlanItems, serializePlanItems } from "@auditdesk/shared";

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

// Helpers to parse and format HTML5 time picker values
const parseTimeRange = (timeStr: string) => {
  if (!timeStr) return { from: "09:00", to: "10:00" };
  const parts = timeStr.split(/[-–]/);
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

interface ScheduleClientProps {
  initialSchedules: ExecutionSchedule[];
  projects: AuditProject[];
  users: User[];
  departments: Department[];
  currentUser: User | null;
}

export default function ScheduleClient({ 
  initialSchedules, 
  projects, 
  users, 
  departments,
  currentUser 
}: ScheduleClientProps) {
  const [schedules, setSchedules] = useState<ExecutionSchedule[]>(initialSchedules.filter(s => s.language !== "finding" && s.language !== "meeting"));
  
  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");

  // Selection & Modal
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  
  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [departmentsStr, setDepartmentsStr] = useState("");
  const [address, setAddress] = useState("HB-HQ");
  const [visitNumber, setVisitNumber] = useState("1");
  const [deptVersionInfo, setDeptVersionInfo] = useState<{ version: string; processedCount: number; isProcessed: boolean; nextVersion: string } | null>(null);
  const [actualVisitDate, setActualVisitDate] = useState("");
  const [auditPeriod, setAuditPeriod] = useState("");

  useEffect(() => {
    if (selectedProjectId && departmentsStr) {
      const params = new URLSearchParams({ projectId: selectedProjectId, department: departmentsStr });
      if (selectedScheduleId) params.set("excludeScheduleId", selectedScheduleId);
      clientApi<{ version: string; processedCount: number; isProcessed: boolean; nextVersion: string }>(
        `/audit-plans/department-version?${params.toString()}`
      )
        .then((info) => {
          setDeptVersionInfo(info);
          if (modalMode === "create") {
            setVisitNumber(info.isProcessed ? String(info.processedCount + 1) : "1");
          }
        })
        .catch(console.error);
    } else {
      setDeptVersionInfo(null);
    }
  }, [selectedProjectId, departmentsStr, modalMode, selectedScheduleId]);
  const [auditPeriodStart, setAuditPeriodStart] = useState("");
  const [auditPeriodEnd, setAuditPeriodEnd] = useState("");

  const handleAuditPeriodStartChange = (val: string) => {
    setAuditPeriodStart(val);
    setAuditPeriod(val && auditPeriodEnd ? `${val} to ${auditPeriodEnd}` : val || auditPeriodEnd || "");
  };

  const handleAuditPeriodEndChange = (val: string) => {
    setAuditPeriodEnd(val);
    setAuditPeriod(auditPeriodStart && val ? `${auditPeriodStart} to ${val}` : auditPeriodStart || val || "");
  };

  const [leadExecution, setLeadExecution] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [additionalAttendees, setAdditionalAttendees] = useState("");
  const [standards, setStandards] = useState("Work Procedure, work instruction, and policy");
  const [language, setLanguage] = useState("English");
  const [objectives, setObjectives] = useState("");
  const [scope, setScope] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<"DRAFT" | "RELEASED">("DRAFT");
  // Active row index for card editing
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  // Draft state for unsaved edits in configuring slot
  const [draftRow, setDraftRow] = useState<ScheduleRow | null>(null);
  // Expand/collapse parameters panel in Configure Slot popup
  const [isParamsExpanded, setIsParamsExpanded] = useState(true);

  const isLocked = scheduleStatus === "RELEASED";

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
    subLabel: `${u.role.replace("_", " ")}${u.email ? ` • ${u.email}` : ""}`
  }));

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);
  const availableDataRequests = parsePlanItems(selectedProjectObj?.dataRequestType || "", "AP-DRQ");
  const dataRequestOptions = availableDataRequests.map(d => ({
    value: d.id,
    label: d.id,
    subLabel: d.text
  }));

  const isProjectMember = (proj: any) => {
    if (!proj) return false;
    if (currentUser?.role === "ADMIN") return true;
    if (proj.leadAuditorId === currentUser?.id || proj.leadAuditorId === currentUser?.name) return true;
    const auditorsList = proj.auditorNames ? proj.auditorNames.split(",").map((s: string) => s.trim()) : [];
    if (auditorsList.includes(currentUser?.name)) return true;
    if (proj.auditorIds?.includes(currentUser?.id)) return true;
    const picList = proj.deptPicIds ? proj.deptPicIds.split(",") : [];
    if (picList.includes(currentUser?.id) || picList.includes(currentUser?.name)) return true;
    return false;
  };

  const isScheduleOrMeetingAllowed = (sched: any) => {
    if (!sched) return false;
    if (currentUser?.role === "ADMIN") return true;
    if (sched.ownerName === currentUser?.name || sched.lastModifiedBy === currentUser?.name) return true;
    const proj = projects.find(p => p.id === sched.projectId);
    return isProjectMember(proj);
  };

  const canManage = RBAC.can(currentUser, "execution-schedules:create") || RBAC.can(currentUser, "execution-schedules:update") || RBAC.can(currentUser, "execution-schedules:delete");

  const showFeedback = (msg: string, type: "success" | "error" = "success") => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Prepopulate schedule fields when project is selected in Create mode
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (!projectId) return;

    const project = projects.find(s => s.id === projectId);
    if (!project) return;

    setDepartmentsStr(project.departments || "");
    setAddress("HB-HQ");

    // Calculate OE# (integer sequence for this project)
    const existingForProject = schedules.filter(s => s.projectId === projectId);
    const nextOeInt = String(existingForProject.length + 1);
    setVisitNumber(nextOeInt);

    // "Allow to manually but auto-fill"
    const parsedStart = project.startDate ? project.startDate.split("T")[0] : "";
    setActualVisitDate(parsedStart);
    
    const parsedEnd = project.endDate ? project.endDate.split("T")[0] : "";
    const period = parsedStart && parsedEnd ? `${parsedStart} to ${parsedEnd}` : parsedStart || parsedEnd || "";
    setAuditPeriod(period);
    setAuditPeriodStart(parsedStart);
    setAuditPeriodEnd(parsedEnd);
    
    // Auto-derive Lead Auditor from project
    const leadUser = users.find(u => u.id === project.leadAuditorId || u.name === project.leadAuditorId);
    const leadName = leadUser ? leadUser.name : (project.leadAuditorId || "");

    // Auto-derive Auditors from project
    const auditorNamesClean = project.auditorNames
      ? project.auditorNames.split(",").map(s => {
          const clean = s.trim();
          const u = users.find(user => user.name === clean || user.id === clean);
          return u ? u.name : clean;
        }).join(", ")
      : "";

    // Auto-derive Attendees from project deptPicIds
    const attendeesClean = project.deptPicIds
      ? project.deptPicIds.split(",").map(s => {
          const clean = s.trim();
          const u = users.find(user => user.name === clean || user.id === clean);
          return u ? u.name : clean;
        }).join(", ")
      : "";

    setLeadExecution(leadName);
    setTeamMembers(auditorNamesClean);
    setAdditionalAttendees(attendeesClean);
    setStandards("Work Procedure, work instruction, and policy");
    setObjectives(project.objectives || "");
    setScope(project.scope || "");

    // Prepopulate empty rows
    setRows([]);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedScheduleId(null);
    setSelectedProjectId("");
    setDepartmentsStr("");
    setAddress("HB-HQ");
    setVisitNumber("1");
    setDeptVersionInfo(null);
    setActualVisitDate("");
    setAuditPeriod("");
    setAuditPeriodStart("");
    setAuditPeriodEnd("");
    setLeadExecution("");
    setTeamMembers("");
    setAdditionalAttendees("");
    setStandards("Work Procedure, work instruction, and policy");
    setLanguage("English");
    setObjectives("");
    setScope("");
    setRows([]);
    setScheduleStatus("DRAFT");
    setIsModalOpen(true);
  };

  const openEditModal = (sched: ExecutionSchedule) => {
    setSelectedScheduleId(sched.id);
    setModalMode("edit");
    setSelectedProjectId(sched.projectId);
    setDepartmentsStr(sched.departments);
    setAddress(sched.address);
    setVisitNumber(sched.visitNumber);
    setActualVisitDate(sched.actualVisitDate);
    setAuditPeriod(sched.auditPeriod);
    const parts = (sched.auditPeriod || "").split(" to ");
    if (parts.length === 2) {
      setAuditPeriodStart(parts[0]);
      setAuditPeriodEnd(parts[1]);
    } else {
      setAuditPeriodStart("");
      setAuditPeriodEnd("");
    }
    setLeadExecution(sched.leadExecution);
    setTeamMembers(sched.teamMembers);
    setAdditionalAttendees(sched.additionalAttendees);
    setStandards(sched.standards);
    setLanguage(sched.language);
    setObjectives(sched.objectives);
    setScope(sched.scope);
    
    try {
      setRows(JSON.parse(sched.scheduleRows));
    } catch {
      setRows([]);
    }

    setScheduleStatus((sched.status as any) || "DRAFT");
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

  const persistSchedule = async (
    targetStatus: "DRAFT" | "RELEASED",
    options: { closeAfterSave?: boolean } = {}
  ) => {
    if (scheduleStatus === "RELEASED" && targetStatus !== "DRAFT") {
      showFeedback("This schedule is already released. Reopen it before making edits.");
      return false;
    }

    if (!selectedProjectId || !departmentsStr || !actualVisitDate) {
      showFeedback("Please select a project, department, and actual visit date before saving.");
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
      language,
      status: targetStatus,
      objectives,
      scope,
      scheduleRows: JSON.stringify(rows)
    };

    try {
      let savedId = selectedScheduleId;
      const shouldClose = options.closeAfterSave ?? false;

      if (modalMode === "create") {
        const result = await clientApi<ExecutionSchedule>("/execution-schedules", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (!result) return false;
        savedId = result.id || savedId;
        setSelectedScheduleId(savedId || null);
        setModalMode("edit");
        setScheduleStatus(targetStatus);
      } else {
        if (!selectedScheduleId) return false;
        const result = await clientApi<ExecutionSchedule>(`/execution-schedules/${selectedScheduleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        if (!result) return false;
        setScheduleStatus(targetStatus);
      }

      const fresh = await clientApi<ExecutionSchedule[]>("/execution-schedules");
      setSchedules(fresh.filter((s: any) => s.language !== "finding" && s.language !== "meeting"));

      if (targetStatus === "RELEASED") {
        const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>(
          "/notifications/send-email",
          {
            method: "POST",
            body: JSON.stringify({
              templateId: "schedule",
              projectId: payload.projectId,
              variables: {
                auditPeriod: payload.auditPeriod,
                leadExecution: payload.leadExecution,
                standards: payload.standards
              }
            })
          }
        );
        if (emailResult.success) {
          for (const alert of emailResult.simulatedAlerts) {
            window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
          }
        }
      }

      showFeedback(
        targetStatus === "RELEASED"
          ? "Execution schedule released and locked."
          : modalMode === "create"
            ? "Execution schedule generated successfully."
            : "Execution schedule changes saved."
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
    await persistSchedule("DRAFT", { closeAfterSave: false });
  };

  const handleReleaseSchedule = async () => {
    await persistSchedule("RELEASED", { closeAfterSave: false });
  };

  const handleReopenSchedule = async () => {
    if (!selectedScheduleId) return;
    try {
      const result = await clientApi<ExecutionSchedule>(`/execution-schedules/${selectedScheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "DRAFT",
          lastModifiedBy: currentUser?.name
        })
      });
      if (result) {
        setScheduleStatus("DRAFT");
        const fresh = await clientApi<ExecutionSchedule[]>("/execution-schedules");
        setSchedules(fresh.filter((s: any) => s.language !== "finding" && s.language !== "meeting"));
        showFeedback("Schedule reopened for editing.");
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
      "Delete Execution Schedule",
      `Are you sure you want to delete the execution schedule for "${s.projectName}"? This action cannot be undone.`,
      async () => {
        try {
          const success = await clientApi<boolean>(`/execution-schedules/${selectedScheduleId}`, { method: "DELETE" });
          if (success) {
            showFeedback("Schedule removed from ledger.");
            setSelectedScheduleId(null);
            const fresh = await clientApi<ExecutionSchedule[]>("/execution-schedules");
            setSchedules(fresh.filter((s: any) => s.language !== "finding" && s.language !== "meeting"));
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
    setDraftRow({ ...rows[index] });
  };

  const addRow = () => {
    const newRow = { day: "", date: new Date().toISOString().split('T')[0], time: "09:00 AM - 10:00 AM", auditScope: "", activity: "", conductBy: "", pIncharge: "", dataRequest: "" };
    setRows([...rows, newRow]);
    setActiveRowIndex(rows.length);
    setDraftRow({ ...newRow });
  };

  const removeRow = (index: number) => {
    showConfirm(
      "Delete Execution Slot",
      "Are you sure you want to delete this execution slot? This action cannot be undone.",
      () => {
        setRows(rows.filter((_, idx) => idx !== index));
        if (activeRowIndex === index) {
          setActiveRowIndex(null);
          setDraftRow(null);
        }
      }
    );
  };

  const updateDraftField = (field: keyof ScheduleRow, value: string) => {
    if (draftRow) {
      setDraftRow({ ...draftRow, [field]: value });
    }
  };

  const saveDraftRow = () => {
    if (activeRowIndex !== null && draftRow) {
      if (!draftRow.auditScope || draftRow.auditScope.trim() === "") {
        showFeedback("Please select at least one Audit Scope for this slot.", "error");
        return;
      }
      
      setRows(rows.map((r, idx) => idx === activeRowIndex ? draftRow : r));
      setActiveRowIndex(null);
      setDraftRow(null);
    }
  };

  const cancelDraftRow = () => {
    if (activeRowIndex !== null && draftRow) {
      const original = rows[activeRowIndex];
      const hasChanges = 
        original.day !== draftRow.day ||
        original.date !== draftRow.date ||
        original.time !== draftRow.time ||
        original.auditScope !== draftRow.auditScope ||
        original.activity !== draftRow.activity ||
        original.conductBy !== draftRow.conductBy ||
        original.pIncharge !== draftRow.pIncharge ||
        original.dataRequest !== draftRow.dataRequest;

      if (hasChanges) {
        showConfirm(
          "Discard Changes",
          "You have unsaved changes in this slot. Are you sure you want to discard them?",
          () => {
            setActiveRowIndex(null);
            setDraftRow(null);
          }
        );
      } else {
        setActiveRowIndex(null);
        setDraftRow(null);
      }
    } else {
      setActiveRowIndex(null);
      setDraftRow(null);
    }
  };

  // Filter & Search
  const filteredSchedules = schedules.filter(s => {
    const matchesSearch = s.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.projectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.leadExecution?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "ALL" || s.projectId === projectFilter;
    return matchesSearch && matchesProject;
  });

  const projectFilterOptions = projects.map(p => ({
    label: `ID: ${p.code} - ${p.name}`,
    value: p.id
  }));

  const activeSchedule = schedules.find(x => x.id === selectedScheduleId);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print border-b border-slate-200 dark:border-slate-850 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Execution Schedule & Document Request</h1>
          <p className="text-xs text-muted-foreground">
            Outline physical visit dates, interview sequences, and files requested from departments.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded-md shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Schedule
          </button>
        )}
      </div>

      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Main layout */}
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
            searchPlaceholder="Search schedules..."
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
                  <th className="px-6 py-4">OE Plan Code</th>
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4">OE#</th>
                  <th className="px-6 py-4">Department(s)</th>
                  <th className="px-6 py-4">Visit Date</th>
                  <th className="px-6 py-4">Lead Auditor</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">
                      No schedules matched filters or none have been created. Click "+" above to link an OE Plan.
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
                      <td className="px-6 py-4.5 font-semibold text-slate-700 dark:text-slate-300">
                        {s.visitNumber ? s.visitNumber.replace(/^V/i, "") : "1"}
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

      {/* Edit/Create Popup Modal Styled Like "2. Schedule.doc" Document */}
      {isModalOpen && (
        <div id="scoping-modal-root" className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center z-50 overflow-y-auto p-4 md:p-8 animate-fade-in no-print-backdrop">
          <div className="bg-white dark:bg-slate-950 w-full max-w-[98vw] xl:max-w-[98vw] rounded-lg shadow-2xl flex flex-col overflow-hidden h-fit border border-slate-200 dark:border-slate-850 scoping-modal-container">
            
            {/* Modal Header */}
            <div className="px-8 py-5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-sans text-slate-400 font-bold uppercase">
                  Document 2. Schedule
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {modalMode === "create" ? "Link New OE Schedule" : "Edit Execution Schedule"}
                </h2>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-[10px] font-roboto text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" /> Status: {scheduleStatus === "RELEASED" ? "Released" : "Draft"}
                  </span>
                </div>
              </div>

              {/* Actions Header Bar */}
              <div className="flex items-center gap-2.5 shrink-0 no-print">
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
                    onClick={handleReopenSchedule}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 text-xs font-bold rounded cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Reopen
                  </button>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleReleaseSchedule}
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
              
              {/* Audit Plan selection */}
              <div className="flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">OE Plan</label>
                  <select
                    disabled={isLocked || modalMode === "edit"}
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
                  >
                    <option value="">Select OE Plan...</option>
                    {projects
                      .filter(p => p.status === "RELEASED" && !schedules.some(s => s.projectId === p.id && s.id !== selectedScheduleId))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Document Summary Info Grid styled like a Word Document table */}
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-350 dark:border-slate-800 rounded-md">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {/* Row 1: Departments */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Department:
                        </td>
                        <td colSpan={3} className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950">
                          {departmentsStr || <span className="text-slate-400 font-normal italic">Select an Audit Plan to auto-derive department</span>}
                        </td>
                      </tr>

                      {/* Row 2: Address */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Address:
                        </td>
                        <td colSpan={3} className="px-4 py-2">
                          <input 
                            type="text" 
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="HB-HQ"
                            className="w-full bg-transparent border-none p-0 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>

                      {/* Row 3: Visit Number + Actual Visit Date */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          OE#:
                        </td>
                        <td className="w-1/4 px-4 py-2 border-r border-slate-300 dark:border-slate-800/80">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input 
                              type="number"
                              min="1"
                              value={visitNumber ? visitNumber.replace(/^V/i, "") : "1"}
                              onChange={(e) => setVisitNumber(e.target.value)}
                              placeholder="1"
                              className="w-16 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </td>
                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Actual Visit Date:
                        </td>
                        <td className="w-1/4 px-4 py-2">
                          <input 
                            type="date"
                            value={actualVisitDate}
                            onChange={(e) => setActualVisitDate(e.target.value)}
                            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                          />
                        </td>
                      </tr>

                      {/* Row 4: Audit Period */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Audit Period:
                        </td>
                        <td colSpan={3} className="px-4 py-2">
                          <div className="flex items-center gap-2 max-w-sm">
                            <input 
                              type="date"
                              value={auditPeriodStart}
                              onChange={(e) => handleAuditPeriodStartChange(e.target.value)}
                              className="w-1/2 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                            />
                            <span className="text-slate-400 font-bold text-xs">to</span>
                            <input 
                              type="date"
                              value={auditPeriodEnd}
                              onChange={(e) => handleAuditPeriodEndChange(e.target.value)}
                              className="w-1/2 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 5: Lead Execution */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Lead Auditor(s):
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={leadExecutionArray}
                            onChange={(values) => setLeadExecution(values.join(", "))}
                            options={userOptions}
                            placeholder="Type to search system users or press Enter for custom names..."
                            singleSelect={true}
                          />
                        </td>
                      </tr>

                      {/* Row 6: Team Member(s) */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Auditor(s):
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={teamMembersArray}
                            onChange={(values) => setTeamMembers(values.join(", "))}
                            options={userOptions}
                            placeholder="Type to search system users or press Enter for custom names..."
                            singleSelect={false}
                          />
                        </td>
                      </tr>

                      {/* Row 7: Additional Attendees and Roles */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 leading-normal">
                          Additional Attendees and Roles:
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={additionalAttendeesArray}
                            onChange={(values) => setAdditionalAttendees(values.join(", "))}
                            options={userOptions}
                            placeholder="Type to search system users or press Enter for custom names..."
                            singleSelect={false}
                          />
                        </td>
                      </tr>

                      {/* Row 8: Standard(s) */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Standard(s):
                        </td>
                        <td colSpan={3} className="px-4 py-2">
                          <input 
                            type="text" 
                            value={standards}
                            onChange={(e) => setStandards(e.target.value)}
                            className="w-full bg-transparent border-none p-0 text-xs focus:outline-none text-slate-800 dark:text-slate-100 font-semibold"
                          />
                        </td>
                      </tr>

                      {/* Row 9: OE Language */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          OE Language:
                        </td>
                        <td colSpan={3} className="px-4 py-2">
                          <MultiSelect
                            options={[
                              { value: "Khmer", label: "Khmer" },
                              { value: "English", label: "English" },
                              { value: "Chinese", label: "Chinese" },
                              { value: "Thai", label: "Thai" },
                              { value: "Vietnamese", label: "Vietnamese" }
                            ]}
                            selectedValues={language ? language.split(",").map(s => s.trim()).filter(Boolean) : []}
                            onChange={(selected) => setLanguage(selected.join(", "))}
                            placeholder="Select language(s)..."
                            singleSelect={false}
                          />
                        </td>
                      </tr>

                      {/* Row 10: OE Objectives */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          OE Objectives:
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <PlanItemEditor 
                            sectionTitle="OE Objectives"
                            items={parsePlanItems(objectives, "IAP-OBJ")}
                            onChange={() => {}}
                            prefix="IAP-OBJ"
                            editable={false}
                            hideHeader={true}
                          />
                        </td>
                      </tr>

                      {/* Row 11: OE Scope */}
                      <tr>
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          OE Scope:
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <PlanItemEditor 
                            sectionTitle="OPE Scope"
                            items={parsePlanItems(scope, "IAP-ISCP")}
                            onChange={() => {}}
                            prefix="IAP-ISCP"
                            editable={false}
                            hideHeader={true}
                          />
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

              {/* Schedule Table Editor */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#05375c] dark:text-accent">
                    Execution Schedule Rows
                  </h3>
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/20 text-[#0066cc] dark:text-sky-400 text-xs font-semibold rounded cursor-pointer no-print"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Day/Slot
                  </button>
                </div>

                {/* 1. Interactive Table Editor View (Screen only) */}
                <div className="no-print overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3 w-16 border-r border-slate-200 dark:border-slate-800">Day</th>
                        <th className="px-4 py-3 w-28 border-r border-slate-200 dark:border-slate-800">Date</th>
                        <th className="px-4 py-3 w-36 border-r border-slate-200 dark:border-slate-800">Time</th>
                        <th className="px-4 py-3 w-36 border-r border-slate-200 dark:border-slate-800">Audit Scope</th>
                        <th className="px-4 py-3 w-40 border-r border-slate-200 dark:border-slate-800">Type of data to request</th>
                        <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-800">Functional Units/Activities/ Document request</th>
                        <th className="px-4 py-3 w-40 border-r border-slate-200 dark:border-slate-800">Conduct by</th>
                        <th className="px-4 py-3 w-40 border-r border-slate-200 dark:border-slate-800">P-Incharge</th>
                        <th className="px-4 py-3 w-24 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-950">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                            No slots created yet. Click "+ Add Day/Slot" above.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, index) => (
                          <tr 
                            key={index}
                            onClick={() => startEditingRow(index)}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-900/35 transition-colors cursor-pointer align-top border-b border-slate-200 dark:border-slate-800 last:border-0"
                          >
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                              {row.day || ""}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {formatDateString(row.date)}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-sans text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {row.time || "Time not selected"}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                              {(() => {
                                const available = parsePlanItems(scope, "IAP-ISCP");
                                if (!row.auditScope) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                                const ids = row.auditScope.split(",").map(s => s.trim()).filter(Boolean);
                                if (ids.length === 0) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                                return (
                                  <div className="flex flex-col gap-3">
                                    {ids.map(id => {
                                      const matched = available.find(o => o.id === id);
                                      return (
                                        <div key={id} className="flex flex-col gap-1">
                                          <div>
                                            <span className="bg-slate-200/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold tracking-tight inline-block">
                                              {id}
                                            </span>
                                          </div>
                                          <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                                            {matched ? matched.text : <span className="text-slate-400 italic font-normal">Audit Scope text not found</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                              {row.dataRequest || "None"}
                            </td>
                            <td 
                              className="p-3 border-r border-slate-200 dark:border-slate-800 leading-relaxed text-slate-700 dark:text-slate-355 rich-text-content"
                              dangerouslySetInnerHTML={{ __html: row.activity || "<i>No activities set. Click to configure.</i>" }}
                            />
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-[#05375c] dark:text-sky-400 whitespace-pre-wrap">
                              {row.conductBy || "Unassigned"}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {row.pIncharge || "Unassigned"}
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditingRow(index)}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 cursor-pointer"
                                  title="Edit Slot"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRow(index)}
                                  className="p-1.5 hover:bg-red-500/10 rounded text-red-500 cursor-pointer"
                                  title="Delete Slot"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Nested Schedule Slot Editor Modal (Screen only) */}
                {activeRowIndex !== null && draftRow !== null && (() => {
                  const timeVals = parseTimeRange(draftRow.time);
                  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(draftRow.date) 
                    ? draftRow.date 
                    : "";
                  const conductByArray = draftRow.conductBy
                    ? draftRow.conductBy.split(",").map(name => name.trim()).filter(Boolean)
                    : [];
                  const pInchargeArray = draftRow.pIncharge
                    ? draftRow.pIncharge.split(",").map(name => name.trim()).filter(Boolean)
                    : [];

                  const auditorOptions = users
                    .filter(u => u.role === "ADMIN" || u.role === "LEAD_AUDITOR" || u.role === "AUDITOR")
                    .map(u => ({
                      value: u.name,
                      label: u.name,
                      subLabel: `${u.role.replace("_", " ")}${u.email ? ` • ${u.email}` : ""}`
                    }));

                  const picOptions = users.map(u => ({
                    value: u.name,
                    label: u.name,
                    subLabel: `${u.role.replace("_", " ")}${u.email ? ` • ${u.email}` : ""}`
                  }));

                  const availableAuditScopes = parsePlanItems(scope, "IAP-ISCP");
                  const auditScopeOptions = availableAuditScopes.map(o => ({
                    value: o.id,
                    label: o.id,
                    subLabel: (o.text || "").substring(0, 50) + ((o.text || "").length > 50 ? "..." : "")
                  }));

                  return (
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 flex justify-center items-center z-[60] p-4 animate-fade-in no-print">
                      <div className="bg-white dark:bg-slate-950 w-full max-w-4xl md:max-w-5xl h-[90vh] max-h-[850px] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-250 dark:border-slate-800 animate-slide-up">
                        
                        {/* Slot Modal Header (Fixed at top) */}
                        <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-855 flex justify-between items-center shrink-0">
                          <div>
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[9px] font-sans font-bold text-slate-555 dark:text-slate-400">
                              SLOT #{activeRowIndex + 1}
                            </span>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                              Configure Execution Slot
                            </h3>
                          </div>
                          <button 
                            type="button"
                            onClick={cancelDraftRow}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Slot Modal Body (Scrolls internally, keeping header/footer intact) */}
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                          
                          {/* Collapsible Parameters Section */}
                          <div className="border border-slate-200 dark:border-slate-800 rounded-lg shrink-0 relative z-30">
                            <button
                              type="button"
                              onClick={() => setIsParamsExpanded(!isParamsExpanded)}
                              className="w-full bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-350 hover:bg-slate-100/80 dark:hover:bg-slate-850 transition-colors border-b border-slate-200 dark:border-slate-800 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-[#0066cc]" />
                                <span>Execution Parameters (Date, Time, Auditors, PIC)</span>
                              </span>
                              <ChevronRight className={`w-4 h-4 transition-transform duration-205 text-slate-400 ${isParamsExpanded ? "rotate-90" : ""}`} />
                            </button>
                            
                            {isParamsExpanded && (
                              <div className="p-4 bg-white dark:bg-slate-950/40 animate-fade-in border-t border-slate-100 dark:border-slate-800 space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                  {/* Day Input */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                                      Day
                                    </label>
                                    <input 
                                      type="text"
                                      value={draftRow.day || ""}
                                      onChange={(e) => updateDraftField("day", e.target.value)}
                                      placeholder="e.g. 1-8 or empty"
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                                    />
                                  </div>

                                  {/* Date Selector */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                                      Execution Date
                                    </label>
                                    <input 
                                      type="date"
                                      value={validDate}
                                      onChange={(e) => updateDraftField("date", e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                    />
                                  </div>

                                  {/* Time Selector */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Time Range</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-slate-400 font-sans uppercase">From</span>
                                        <input 
                                          type="time" 
                                          value={timeVals.from} 
                                          onChange={(e) => {
                                            const newTime = formatTimeRange(e.target.value, timeVals.to);
                                            updateDraftField("time", newTime);
                                          }}
                                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-slate-400 font-sans uppercase">To</span>
                                        <input 
                                          type="time" 
                                          value={timeVals.to} 
                                          onChange={(e) => {
                                            const newTime = formatTimeRange(timeVals.from, e.target.value);
                                            updateDraftField("time", newTime);
                                          }}
                                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {/* Conduct By Dropdown */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Conducted By (Auditors)</label>
                                    <MultiSelect
                                      selectedValues={conductByArray}
                                      onChange={(values) => updateDraftField("conductBy", values.join(", "))}
                                      options={auditorOptions}
                                      placeholder="Select auditors or type custom name..."
                                    />
                                  </div>

                                  {/* PIC Dropdown */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Person in Charge (PIC)</label>
                                    <MultiSelect
                                      selectedValues={pInchargeArray}
                                      onChange={(values) => updateDraftField("pIncharge", values.join(", "))}
                                      options={picOptions}
                                      placeholder="Select PICs or type custom name..."
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Audit Scope and Data Request */}
                          <div className="space-y-6 flex-1 overflow-y-auto px-2 pb-2">
                            {/* Audit Scope Selection */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Audit Scope</label>
                              <MultiSelect
                                selectedValues={draftRow.auditScope ? draftRow.auditScope.split(",").map(s => s.trim()).filter(Boolean) : []}
                                onChange={(values) => updateDraftField("auditScope", values.join(", "))}
                                options={auditScopeOptions}
                                placeholder="Select audit scope..."
                              />
                              <div className="mt-2 min-h-[120px] p-3 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {(() => {
                                  const ids = (draftRow.auditScope || "").split(",").map(s => s.trim()).filter(Boolean);
                                  if (ids.length === 0) return <span className="text-slate-400 italic font-sans text-xs">No scope selected.</span>;
                                  return ids.map(id => {
                                    const match = availableAuditScopes.find(o => o.id === id);
                                    return match ? match.text : id;
                                  }).join("\n\n");
                                })()}
                              </div>
                            </div>

                            {/* Data Request Selection */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Type of data to request</label>
                              <MultiSelect
                                selectedValues={draftRow.dataRequest ? [draftRow.dataRequest] : []}
                                onChange={(selected) => updateDraftField("dataRequest", selected.length > 0 ? selected[0] : "")}
                                options={dataRequestOptions}
                                placeholder="Select data to request..."
                                singleSelect={true}
                              />
                              <div className="mt-2 min-h-[120px] p-3 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {(() => {
                                  const id = draftRow.dataRequest;
                                  if (!id) return <span className="text-slate-400 italic font-sans text-xs">No data request selected.</span>;
                                  const match = dataRequestOptions.find(o => o.value === id);
                                  return match ? match.subLabel : id;
                                })()}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Slot Modal Footer (Fixed at bottom) */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-850 flex justify-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={cancelDraftRow}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={saveDraftRow}
                            className="px-5 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded cursor-pointer"
                          >
                            Save
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })()}

                {/* 3. Flat Printout Table View (Print only - hidden on screen) */}
                <div className="hidden print:block overflow-x-auto border border-slate-350 dark:border-slate-800 rounded-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-300 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3 w-16 border-r border-slate-300 dark:border-slate-800">Day</th>
                        <th className="px-4 py-3 w-28 border-r border-slate-300 dark:border-slate-800">Date</th>
                        <th className="px-4 py-3 w-36 border-r border-slate-300 dark:border-slate-800">Time</th>
                        <th className="px-4 py-3 w-36 border-r border-slate-300 dark:border-slate-800">Audit Scope</th>
                        <th className="px-4 py-3 w-40 border-r border-slate-300 dark:border-slate-800">Type of data to request</th>
                        <th className="px-4 py-3 border-r border-slate-300 dark:border-slate-800">Functional Units/Activities/ Document request</th>
                        <th className="px-4 py-3 w-40 border-r border-slate-300 dark:border-slate-800">Conduct by</th>
                        <th className="px-4 py-3 w-40">P-Incharge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {rows.map((row, index) => (
                        <tr key={index} className="align-top border-b border-slate-300 dark:border-slate-800">
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-medium whitespace-pre-wrap">{row.day || ""}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-bold whitespace-pre-wrap">{formatDateString(row.date)}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-sans text-[10px] whitespace-pre-wrap">{row.time || "Time not selected"}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800">
                            {(() => {
                              const available = parsePlanItems(scope, "IAP-ISCP");
                              if (!row.auditScope) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                              const ids = row.auditScope.split(",").map(s => s.trim()).filter(Boolean);
                              if (ids.length === 0) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                              return (
                                <div className="flex flex-col gap-3">
                                  {ids.map(id => {
                                    const matched = available.find(o => o.id === id);
                                    return (
                                      <div key={id} className="flex flex-col gap-1">
                                        <div>
                                          <span className="bg-slate-200/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold tracking-tight inline-block">
                                            {id}
                                          </span>
                                        </div>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                                          {matched ? matched.text : <span className="text-slate-400 italic font-normal">Audit Scope text not found</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-medium whitespace-pre-wrap">
                            {row.dataRequest || "None"}
                          </td>
                          <td 
                            className="p-3 border-r border-slate-300 dark:border-slate-800 leading-relaxed rich-text-content"
                            dangerouslySetInnerHTML={{ __html: row.activity }}
                          />
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-medium whitespace-pre-wrap">{row.conductBy}</td>
                          <td className="p-3 font-medium whitespace-pre-wrap">{row.pIncharge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PDF Print Footer Note (conditional on print) */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-[10px] font-sans text-slate-400 leading-relaxed italic">
                Note: The operational excellence execution schedule is subject to refinement based on real-time field risk discoveries.
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Confirmation Alert Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 flex justify-center items-center z-[1000] p-4 animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-lg shadow-2xl overflow-hidden border border-slate-250 dark:border-slate-800 animate-slide-up">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-500">
                <Info className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {confirmDialog.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-755 text-white text-xs font-bold rounded cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
