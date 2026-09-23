"use client";

import { useState, useEffect, useMemo } from "react";
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
  OePlan,
  Project,
  User,
  Department,
  ScheduleRow
} from "@oeportal/shared";
import { clientApi, ApiError } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import RichEditor from "@/components/ui/rich-editor";
import MultiSelect from "@/components/ui/multi-select";
import OpenMeetingSelect from "@/components/ui/open-meeting-select";
import OePlanSelect from "@/components/ui/oe-plan-select";
import PlanItemEditor from "@/components/ui/plan-item-editor";
import { parsePlanItems, serializePlanItems, resolveInheritedPlanContent } from "@oeportal/shared";

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

// Formats a row's date (and, when it spans more than one day, its end date) for display
const formatDateRange = (row: ScheduleRow) => {
  const from = formatDateString(row.date);
  if (!row.dateTo || row.dateTo === row.date) return from;
  return `${from} - ${formatDateString(row.dateTo)}`;
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
  projects: OePlan[];
  users: User[];
  departments: Department[];
  plannedEngagements?: Project[];
  currentUser: User | null;
}

export default function ScheduleClient({
  initialSchedules,
  projects,
  users,
  departments,
  plannedEngagements = [],
  currentUser
}: ScheduleClientProps) {
  const [schedules, setSchedules] = useState<ExecutionSchedule[]>(initialSchedules.filter(s => s.language !== "finding" && s.language !== "meeting"));
  
  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");

  // Selection & Modal
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  // The updatedAt of the schedule as last loaded/saved; sent back as expectedUpdatedAt so the
  // server can refuse a save if someone else changed the schedule in the meantime, instead of
  // silently overwriting their edit (see ExecutionSchedulesService.update).
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  
  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [departmentsStr, setDepartmentsStr] = useState("");
  const [address, setAddress] = useState("HB-HQ");
  const [visitNumber, setVisitNumber] = useState("1");
  const [actualVisitDate, setActualVisitDate] = useState("");
  const [oePeriod, setOePeriod] = useState("");

  // "Version #" is the Planned Engagement's own department version (e.g. the
  // "V2" already shown as the OE Plan Department's version elsewhere) - not a
  // count recomputed from this project's own released execution schedules.
  // Same department-resolution fallback as meetings-client.tsx's
  // getDepartmentWithVersion: explicit projectId match, then annualPlanId +
  // topic match, then a topic-only match across all Planned Engagements.
  const resolveDepartmentVersion = (dept: string, proj: OePlan | null | undefined): string => {
    if (!dept) return "V1";
    const cleanDept = dept.trim().toLowerCase();

    if (proj?.projectId) {
      const ap = plannedEngagements.find(a => a.id === proj.projectId);
      if (ap && ap.topic.toLowerCase() === cleanDept) return ap.version || "V1";
    }
    if (proj?.annualPlanId) {
      const ap = plannedEngagements.find(a => a.annualPlanId === proj.annualPlanId && a.topic.toLowerCase() === cleanDept);
      if (ap) return ap.version || "V1";
    }
    const ap = plannedEngagements.find(a => a.topic.toLowerCase() === cleanDept);
    return ap?.version || "V1";
  };

  useEffect(() => {
    if (modalMode !== "create") return;
    if (!selectedProjectId || !departmentsStr) return;
    const proj = projects.find(p => p.id === selectedProjectId);
    const firstDept = departmentsStr.split(",").map(d => d.trim()).filter(Boolean)[0] || "";
    const version = resolveDepartmentVersion(firstDept, proj);
    setVisitNumber(version.replace(/^V/i, "") || "1");
  }, [selectedProjectId, departmentsStr, modalMode, projects, plannedEngagements]);
  const [oePeriodStart, setOePeriodStart] = useState("");
  const [oePeriodEnd, setOePeriodEnd] = useState("");

  const handleOePeriodStartChange = (val: string) => {
    setOePeriodStart(val);
    setOePeriod(val && oePeriodEnd ? `${val} to ${oePeriodEnd}` : val || oePeriodEnd || "");
  };

  const handleOePeriodEndChange = (val: string) => {
    setOePeriodEnd(val);
    setOePeriod(oePeriodStart && val ? `${oePeriodStart} to ${val}` : oePeriodStart || val || "");
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

  // Options derived from users in system
  const userOptions = users.map(u => ({
    value: u.name,
    label: u.name,
    subLabel: u.email ?? "",
  }));

  // Lookups used to resolve each OE Plan's linked Project (and its Business Unit's short ID,
  // e.g. "HB") for the BU-Department-Version pill / Project name text shown by OePlanSelect
  // (see formatOePlanOption).
  const linkedProjectsById = useMemo(
    () => Object.fromEntries(plannedEngagements.map(p => [p.id, p])),
    [plannedEngagements]
  );
  const departmentsById = useMemo(
    () => Object.fromEntries(departments.map(d => [d.id, d])),
    [departments]
  );

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);
  const availableDataRequests = parsePlanItems(selectedProjectObj?.dataRequestType || "", "OE-DRQ");
  const dataRequestOptions = availableDataRequests.map(d => ({
    value: d.id,
    label: d.text || d.id,
    subLabel: d.id
  }));

  const isProjectMember = (proj: any) => {
    if (!proj) return false;
    if (currentUser?.grants?.["oe-plans:view"] === "ALL") return true;
    if (proj.leaderId === currentUser?.id || proj.leaderId === currentUser?.name) return true;
    const membersList = proj.memberNames ? proj.memberNames.split(",").map((s: string) => s.trim()) : [];
    if (membersList.includes(currentUser?.name)) return true;
    if (proj.memberIds?.includes(currentUser?.id)) return true;
    const picList = proj.deptPicIds ? proj.deptPicIds.split(",") : [];
    if (picList.includes(currentUser?.id) || picList.includes(currentUser?.name)) return true;
    return false;
  };

  const isScheduleOrMeetingAllowed = (sched: any) => {
    if (!sched) return false;
    if (currentUser?.grants?.["execution-schedules:view"] === "ALL") return true;
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

    // Version # is resolved by the useEffect above from the linked Planned
    // Engagement's department version, once departmentsStr updates.

    // "Allow to manually but auto-fill"
    const parsedStart = project.startDate ? project.startDate.split("T")[0] : "";
    setActualVisitDate(parsedStart);
    
    const parsedEnd = project.endDate ? project.endDate.split("T")[0] : "";
    const period = parsedStart && parsedEnd ? `${parsedStart} to ${parsedEnd}` : parsedStart || parsedEnd || "";
    setOePeriod(period);
    setOePeriodStart(parsedStart);
    setOePeriodEnd(parsedEnd);
    
    // Auto-derive Execution Leader from project
    const leadUser = users.find(u => u.id === project.leaderId || u.name === project.leaderId);
    const leadName = leadUser ? leadUser.name : (project.leaderId || "");

    // Auto-derive OE Members from project
    const memberNamesClean = project.memberNames
      ? project.memberNames.split(",").map(s => {
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
    setTeamMembers(memberNamesClean);
    setAdditionalAttendees(attendeesClean);
    setStandards("Work Procedure, work instruction, and policy");

    // Resolve inherited objectives/scope from the linked Planned Engagement -
    // OePlan.objectives/scope alone can be empty or stale.
    const linkedPlannedEngagement = project.projectId
      ? plannedEngagements.find(ap => ap.id === project.projectId)
      : null;
    const inherited = resolveInheritedPlanContent(project, linkedPlannedEngagement);
    setObjectives(inherited.objectives);
    setScope(inherited.scope);

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
    setActualVisitDate("");
    setOePeriod("");
    setOePeriodStart("");
    setOePeriodEnd("");
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
    setOePeriod(sched.oePeriod);
    const parts = (sched.oePeriod || "").split(" to ");
    if (parts.length === 2) {
      setOePeriodStart(parts[0]);
      setOePeriodEnd(parts[1]);
    } else {
      setOePeriodStart("");
      setOePeriodEnd("");
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
    setLoadedUpdatedAt(sched.updatedAt || null);
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

    if (!additionalAttendees.trim()) {
      showFeedback("Please add at least one additional attendee before saving.");
      return false;
    }

    const payload = {
      projectId: selectedProjectId,
      departments: departmentsStr,
      address,
      visitNumber,
      actualVisitDate,
      oePeriod,
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
          body: JSON.stringify({ ...payload, expectedUpdatedAt: loadedUpdatedAt || undefined })
        });
        if (!result) return false;
        setScheduleStatus(targetStatus);
        setLoadedUpdatedAt(result.updatedAt || null);
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
                oePeriod: payload.oePeriod,
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
      if (err instanceof ApiError && err.status === 409) {
        showFeedback("Someone else saved changes to this schedule first. Reload it and re-apply your edit.");
      } else {
        showFeedback(`Save failed: ${err.message || err.toString()}`);
      }
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
      "Delete Execution Schedule & Document Request",
      `Are you sure you want to delete the execution schedule & document request for "${s.projectName}"? This action cannot be undone.`,
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
    const newRow = { day: "", date: new Date().toISOString().split('T')[0], dateTo: "", time: "09:00 AM - 10:00 AM", oeScope: "", activity: "", conductBy: "", pIncharge: "", dataRequest: "" };
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
      if (!draftRow.oeScope || draftRow.oeScope.trim() === "") {
        showFeedback("Please select at least one OE Scope for this slot.", "error");
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
        original.dateTo !== draftRow.dateTo ||
        original.time !== draftRow.time ||
        original.oeScope !== draftRow.oeScope ||
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
                  <th className="px-6 py-4">Version #</th>
                  <th className="px-6 py-4">Department(s)</th>
                  <th className="px-6 py-4">Visit Date</th>
                  <th className="px-6 py-4">Execution Leader</th>
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
                  {modalMode === "create" ? "Link New OE Schedule" : "Edit Execution Schedule & Document Request"}
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
              
              {/* OE Plan selection */}
              <div className="flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">OE Plan</label>
                  <div className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-md">
                    <OePlanSelect
                      disabled={isLocked || modalMode === "edit"}
                      projects={projects.filter(p => p.status === "RELEASED" && !schedules.some(s => s.projectId === p.id && s.id !== selectedScheduleId))}
                      selectedProjectId={selectedProjectId}
                      onSelect={handleProjectSelect}
                      placeholder="Select OE Plan..."
                      linkedProjectsById={linkedProjectsById}
                      departmentsById={departmentsById}
                    />
                  </div>
                </div>
              </div>

              {/* Document Summary Info Grid styled like a Word Document table */}
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-350 dark:border-slate-800 rounded-md">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {/* Row 1: Project name */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Project name:
                        </td>
                        <td colSpan={3} className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950">
                          {selectedProjectObj?.name || <span className="text-slate-400 font-normal italic">Select an OE Plan to auto-derive project name</span>}
                        </td>
                      </tr>

                      {/* Row: Department(s) - derived from the linked OE Plan, read-only */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Department(s):
                        </td>
                        <td colSpan={3} className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950">
                          {departmentsStr || <span className="text-slate-400 font-normal italic">Select an OE Plan to auto-derive department(s)</span>}
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
                          Version #:
                        </td>
                        <td className="w-1/4 px-4 py-2 border-r border-slate-300 dark:border-slate-800/80">
                          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700">
                            {visitNumber ? `V${visitNumber.replace(/^V/i, "")}` : "V1"}
                          </span>
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

                      {/* Row 4: Review Period */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Review Period:
                        </td>
                        <td colSpan={3} className="px-4 py-2">
                          <div className="flex items-center gap-2 max-w-sm">
                            <input 
                              type="date"
                              value={oePeriodStart}
                              onChange={(e) => handleOePeriodStartChange(e.target.value)}
                              className="w-1/2 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                            />
                            <span className="text-slate-400 font-bold text-xs">to</span>
                            <input 
                              type="date"
                              value={oePeriodEnd}
                              onChange={(e) => handleOePeriodEndChange(e.target.value)}
                              className="w-1/2 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Row 5: Execution Leader */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Execution Leader(s):
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={leadExecutionArray}
                            onChange={(values) => setLeadExecution(values.join(", "))}
                            options={userOptions}
                            placeholder="Search system users..."
                            singleSelect={true}
                          />
                        </td>
                      </tr>

                      {/* Row 6: Team Member(s) */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Team Member(s):
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={teamMembersArray}
                            onChange={(values) => setTeamMembers(values.join(", "))}
                            options={userOptions}
                            placeholder="Search system users..."
                            singleSelect={false}
                          />
                        </td>
                      </tr>

                      {/* Row 7: Additional Attendees and Roles */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 leading-normal">
                          Additional Attendees and Roles *:
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={additionalAttendeesArray}
                            onChange={(values) => setAdditionalAttendees(values.join(", "))}
                            options={userOptions}
                            placeholder="Search system users..."
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

                      {/* Row 9: Report Language */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Report Language:
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
                            items={parsePlanItems(objectives, "IOE-OBJ")}
                            onChange={() => {}}
                            prefix="IOE-OBJ"
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
                            sectionTitle="OE Scope"
                            items={parsePlanItems(scope, "IOE-SCP")}
                            onChange={() => {}}
                            prefix="IOE-SCP"
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
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-555 dark:text-slate-400 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3 w-14 border-r border-slate-200 dark:border-slate-800">Day</th>
                        <th className="px-4 py-3 w-24 border-r border-slate-200 dark:border-slate-800">Date</th>
                        <th className="px-4 py-3 w-28 border-r border-slate-200 dark:border-slate-800">Time</th>
                        <th className="px-4 py-3 w-64 border-r border-slate-200 dark:border-slate-800">OE Scope</th>
                        <th className="px-4 py-3 w-80 border-r border-slate-200 dark:border-slate-800">Activities/Data/Document Request</th>
                        <th className="px-4 py-3 w-32 border-r border-slate-200 dark:border-slate-800">Conduct by</th>
                        <th className="px-4 py-3 w-32 border-r border-slate-200 dark:border-slate-800">P-Incharge</th>
                        <th className="px-4 py-3 w-20 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-950">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-400 italic">
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
                              {formatDateRange(row)}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 font-sans text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {row.time || "Time not selected"}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                              {(() => {
                                const available = parsePlanItems(scope, "IOE-SCP");
                                if (!row.oeScope) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                                const ids = row.oeScope.split(",").map(s => s.trim()).filter(Boolean);
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
                                            {matched ? matched.text : <span className="text-slate-400 italic font-normal">OE Scope text not found</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3 border-r border-slate-200 dark:border-slate-800">
                              <div className="flex flex-col gap-3">
                                {(() => {
                                  const ids = (row.dataRequest || "").split(",").map(s => s.trim()).filter(Boolean);
                                  if (ids.length === 0) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                                  return ids.map(id => {
                                    const matched = availableDataRequests.find(d => d.id === id);
                                    return (
                                      <div key={id} className="flex flex-col gap-1">
                                        <div>
                                          <span className="bg-slate-200/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold tracking-tight inline-block">
                                            {id}
                                          </span>
                                        </div>
                                        <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                                          {matched ? matched.text : <span className="text-slate-400 italic font-normal">Data request text not found</span>}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                                {row.activity && (
                                  <div
                                    className="leading-relaxed text-slate-700 dark:text-slate-355 rich-text-content"
                                    dangerouslySetInnerHTML={{ __html: row.activity }}
                                  />
                                )}
                              </div>
                            </td>
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
                  const validDateTo = draftRow.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(draftRow.dateTo)
                    ? draftRow.dateTo
                    : "";
                  const conductByArray = draftRow.conductBy
                    ? draftRow.conductBy.split(",").map(name => name.trim()).filter(Boolean)
                    : [];
                  const pInchargeArray = draftRow.pIncharge
                    ? draftRow.pIncharge.split(",").map(name => name.trim()).filter(Boolean)
                    : [];

                  const memberOptions = users.map(u => ({
                    value: u.name,
                    label: u.name,
                    subLabel: u.email ?? "",
                  }));

                  const picOptions = users.map(u => ({
                    value: u.name,
                    label: u.name,
                    subLabel: u.email ?? "",
                  }));

                  const availableOeScopes = parsePlanItems(scope, "IOE-SCP");
                  const oeScopeOptions = availableOeScopes.map(o => ({
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
                                <span>Execution Parameters (Date, Time, OE Members, PIC)</span>
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
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-slate-400 font-sans uppercase">From</span>
                                        <input
                                          type="date"
                                          value={validDate}
                                          onChange={(e) => updateDraftField("date", e.target.value)}
                                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-slate-400 font-sans uppercase">To</span>
                                        <input
                                          type="date"
                                          value={validDateTo}
                                          min={validDate || undefined}
                                          onChange={(e) => updateDraftField("dateTo", e.target.value)}
                                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                        />
                                      </div>
                                    </div>
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
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Conducted By (OE Members)</label>
                                    <MultiSelect
                                      selectedValues={conductByArray}
                                      onChange={(values) => updateDraftField("conductBy", values.join(", "))}
                                      options={memberOptions}
                                      placeholder="Select OE members..."
                                    />
                                  </div>

                                  {/* PIC Dropdown */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Person in Charge (PIC)</label>
                                    <MultiSelect
                                      selectedValues={pInchargeArray}
                                      onChange={(values) => updateDraftField("pIncharge", values.join(", "))}
                                      options={picOptions}
                                      placeholder="Select PICs..."
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* OE Scope and Data Request */}
                          <div className="space-y-6 flex-1 overflow-y-auto px-2 pb-2">
                            {/* OE Scope Selection */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">OE Scope</label>
                              <MultiSelect
                                selectedValues={draftRow.oeScope ? draftRow.oeScope.split(",").map(s => s.trim()).filter(Boolean) : []}
                                onChange={(values) => updateDraftField("oeScope", values.join(", "))}
                                options={oeScopeOptions}
                                placeholder="Select OE scope..."
                              />
                              <div className="mt-2">
                                {(() => {
                                  const ids = (draftRow.oeScope || "").split(",").map(s => s.trim()).filter(Boolean);
                                  if (ids.length === 0) {
                                    return (
                                      <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/60 dark:bg-slate-900/50 text-xs text-slate-400 italic font-sans">
                                        No scope selected.
                                      </div>
                                    );
                                  }
                                  const items = ids.map(id => availableOeScopes.find(o => o.id === id) || { id, text: "" });
                                  return (
                                    <PlanItemEditor
                                      sectionTitle="OE Scope"
                                      items={items}
                                      onChange={() => {}}
                                      prefix="IOE-SCP"
                                      editable={false}
                                      hideHeader={true}
                                    />
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Data Request Selection */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Type(s) of data to request</label>
                              <MultiSelect
                                selectedValues={draftRow.dataRequest ? draftRow.dataRequest.split(",").map(s => s.trim()).filter(Boolean) : []}
                                onChange={(values) => updateDraftField("dataRequest", values.join(", "))}
                                options={dataRequestOptions}
                                placeholder="Select type(s) of data to request..."
                              />
                              <div className="mt-2">
                                {(() => {
                                  const ids = (draftRow.dataRequest || "").split(",").map(s => s.trim()).filter(Boolean);
                                  if (ids.length === 0) {
                                    return (
                                      <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/60 dark:bg-slate-900/50 text-xs text-slate-400 italic font-sans">
                                        No data request selected.
                                      </div>
                                    );
                                  }
                                  const items = ids.map(id => availableDataRequests.find(o => o.id === id) || { id, text: "" });
                                  return (
                                    <PlanItemEditor
                                      sectionTitle="Data Request"
                                      items={items}
                                      onChange={() => {}}
                                      prefix="OE-DRQ"
                                      editable={false}
                                      hideHeader={true}
                                    />
                                  );
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
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-300 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3 w-14 border-r border-slate-300 dark:border-slate-800">Day</th>
                        <th className="px-4 py-3 w-24 border-r border-slate-300 dark:border-slate-800">Date</th>
                        <th className="px-4 py-3 w-28 border-r border-slate-300 dark:border-slate-800">Time</th>
                        <th className="px-4 py-3 w-48 border-r border-slate-300 dark:border-slate-800">OE Scope</th>
                        <th className="px-4 py-3 border-r border-slate-300 dark:border-slate-800">Activities/Data/Document Request</th>
                        <th className="px-4 py-3 w-32 border-r border-slate-300 dark:border-slate-800">Conduct by</th>
                        <th className="px-4 py-3 w-32">P-Incharge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {rows.map((row, index) => (
                        <tr key={index} className="align-top border-b border-slate-300 dark:border-slate-800">
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-medium whitespace-pre-wrap">{row.day || ""}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-bold whitespace-pre-wrap">{formatDateRange(row)}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800 font-sans text-[10px] whitespace-pre-wrap">{row.time || "Time not selected"}</td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800">
                            {(() => {
                              const available = parsePlanItems(scope, "IOE-SCP");
                              if (!row.oeScope) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                              const ids = row.oeScope.split(",").map(s => s.trim()).filter(Boolean);
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
                                          {matched ? matched.text : <span className="text-slate-400 italic font-normal">OE Scope text not found</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3 border-r border-slate-300 dark:border-slate-800">
                            <div className="flex flex-col gap-3">
                              {(() => {
                                const ids = (row.dataRequest || "").split(",").map(s => s.trim()).filter(Boolean);
                                if (ids.length === 0) return <span className="text-slate-400 italic font-sans text-[10px]">None</span>;
                                return ids.map(id => {
                                  const matched = availableDataRequests.find(d => d.id === id);
                                  return (
                                    <div key={id} className="flex flex-col gap-1">
                                      <div>
                                        <span className="bg-slate-200/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold tracking-tight inline-block">
                                          {id}
                                        </span>
                                      </div>
                                      <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                                        {matched ? matched.text : <span className="text-slate-400 italic font-normal">Data request text not found</span>}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                              <div
                                className="leading-relaxed rich-text-content"
                                dangerouslySetInnerHTML={{ __html: row.activity }}
                              />
                            </div>
                          </td>
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
