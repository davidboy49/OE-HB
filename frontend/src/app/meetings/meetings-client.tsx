"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  User as UserIcon,
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
  QrCode
} from "lucide-react";
import type {
  User,
  AuditProject,
  OpenMeeting,
  ScheduleRow,
  Department,
  AuditPlan
} from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import RichEditor from "@/components/ui/rich-editor";
import MultiSelect from "@/components/ui/multi-select";
import PlanItemEditor from "@/components/ui/plan-item-editor";
import { parsePlanItems } from "@auditdesk/shared";
import QRCodeModal from "@/components/ui/qr-code-modal";
import AuditPlanSelect from "@/components/ui/audit-plan-select";
import QRCode from "qrcode";

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

type AttendeeConfirmation = {
  confirmedAt: string;
  confirmedBy: string;
};

const parseAttendeeConfirmations = (raw?: string): Record<string, AttendeeConfirmation> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const pruneConfirmations = (attendeeNames: string[], confirmations: Record<string, AttendeeConfirmation>) => {
  return attendeeNames.reduce<Record<string, AttendeeConfirmation>>((next, name) => {
    if (confirmations[name]) next[name] = confirmations[name];
    return next;
  }, {});
};

interface MeetingsClientProps {
  initialSchedules: OpenMeeting[];
  projects: AuditProject[];
  users: User[];
  departments: Department[];
  auditPlans?: AuditPlan[];
  currentUser: User;
}

export default function MeetingsClient({ 
  initialSchedules, 
  projects, 
  users, 
  departments,
  auditPlans = [],
  currentUser 
}: MeetingsClientProps) {
  const [schedules, setSchedules] = useState<OpenMeeting[]>(initialSchedules);
  
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
  const [visitNumber, setVisitNumber] = useState("01");
  const [actualVisitDate, setActualVisitDate] = useState("");
  const [auditPeriod, setAuditPeriod] = useState("");
  const [leadExecution, setLeadExecution] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [additionalAttendees, setAdditionalAttendees] = useState("");
  const [standards, setStandards] = useState("Meeting Alignment Agenda");
  const [objectives, setObjectives] = useState("");
  const [scope, setScope] = useState("");
  const [departmentConcern, setDepartmentConcern] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<"DRAFT" | "RELEASED">("DRAFT");
  const [attendeeConfirmations, setAttendeeConfirmations] = useState<Record<string, AttendeeConfirmation>>({});
  // Active row index for card editing
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  // Draft state for unsaved edits in configuring slot
  const [draftRow, setDraftRow] = useState<ScheduleRow | null>(null);
  // Expand/collapse parameters panel in Configure Slot popup
  const [isParamsExpanded, setIsParamsExpanded] = useState(true);

  // Feedback notifier
  const [feedback, setFeedback] = useState<string | null>(null);

  // QR Code Modal State
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrModalData, setQrModalData] = useState<{
    qrToken: string;
    projectTitle: string;
    projectCode: string;
    departments: string;
  } | null>(null);

  // Mini QR State
  const [miniQrDataUrl, setMiniQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (isModalOpen && modalMode === "edit" && selectedScheduleId) {
      const activeSch = schedules.find(s => s.id === selectedScheduleId);
      if (activeSch?.qrToken) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const url = `${origin}/meetings/scan/${activeSch.qrToken}`;
        QRCode.toDataURL(url, {
          width: 120,
          margin: 1,
          color: {
            dark: "#05375c",
            light: "#FFFFFF"
          }
        })
        .then(urlData => setMiniQrDataUrl(urlData))
        .catch(err => console.error("Failed to generate mini QR", err));
        return;
      }
    }
    setMiniQrDataUrl("");
  }, [isModalOpen, modalMode, selectedScheduleId, schedules]);

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

  // Helper to format Department with its Version (just like Annual Plan > Audit Plan)
  const getDepartmentWithVersion = (deptStr: string, projId?: string): string => {
    if (!deptStr) return "";
    const proj = projId ? projects.find(p => p.id === projId) : null;
    const depts = deptStr.split(",").map(d => d.trim()).filter(Boolean);
    
    return depts.map(dept => {
      // If dept already has a version pattern like "Finance - V1", return as-is
      if (/\s*-\s*V\d+/i.test(dept)) return dept;

      // 1. Check if linked project has an explicit auditPlanId
      if (proj?.auditPlanId) {
        const ap = auditPlans.find(a => a.id === proj.auditPlanId);
        if (ap && (ap.topic.toLowerCase() === dept.toLowerCase() || depts.length === 1)) {
          return `${dept} - ${ap.version || "V1"}${ap.isApproved ? "" : " (Draft)"}`;
        }
      }

      // 2. Check if linked project has an annualPlanId with matching audit plan topic
      if (proj?.annualPlanId) {
        const ap = auditPlans.find(a => a.annualPlanId === proj.annualPlanId && a.topic.toLowerCase() === dept.toLowerCase());
        if (ap) {
          return `${dept} - ${ap.version || "V1"}${ap.isApproved ? "" : " (Draft)"}`;
        }
      }

      // 3. Match by topic across all audit plans
      const ap = auditPlans.find(a => a.topic.toLowerCase() === dept.toLowerCase());
      if (ap) {
        return `${dept} - ${ap.version || "V1"}${ap.isApproved ? "" : " (Draft)"}`;
      }

      // Fallback to V1
      return `${dept} - V1`;
    }).join(", ");
  };

  const confirmedAttendeeCount = additionalAttendeesArray.filter(name => attendeeConfirmations[name]).length;
  const normalizeAttendeeName = (name: string) => name.trim().toLowerCase();
  const canConfirmAttendee = (attendeeName: string) => currentUser.role === "ADMIN" || normalizeAttendeeName(attendeeName) === normalizeAttendeeName(currentUser.name);

  // Options derived from users in system
  const userOptions = users.map(u => ({
    value: u.name,
    label: u.name,
    subLabel: `${u.role.replace("_", " ")}${u.email ? ` - ${u.email}` : ""}`
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

  const canManage = RBAC.can(currentUser, "meetings:create") || RBAC.can(currentUser, "meetings:update") || RBAC.can(currentUser, "meetings:delete");

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Prepopulate schedule fields when project is selected in Create mode
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj) {
      setObjectives(proj.objectives || "");
      setScope(proj.scope || "");
      if (proj.departments) {
        setDepartmentsStr(proj.departments);
      }
      // Auto-fill dates
      const parsedStart = proj.startDate ? proj.startDate.split("T")[0] : "";
      setActualVisitDate(parsedStart);
      
      const parsedEnd = proj.endDate ? proj.endDate.split("T")[0] : "";
      const period = parsedStart && parsedEnd ? `${parsedStart} to ${parsedEnd}` : parsedStart || parsedEnd || "";
      setAuditPeriod(period);
      
      // Auto-derive Lead Auditor from project
      const leadUser = users.find(u => u.id === proj.leadAuditorId || u.name === proj.leadAuditorId);
      const leadName = leadUser ? leadUser.name : (proj.leadAuditorId || "");

      // Auto-derive Auditors from project
      const auditorNamesClean = proj.auditorNames
        ? proj.auditorNames.split(",").map(s => {
            const clean = s.trim();
            const u = users.find(user => user.name === clean || user.id === clean);
            return u ? u.name : clean;
          }).join(", ")
        : "";

      // Auto-derive Attendees from project deptPicIds
      const attendeesClean = proj.deptPicIds
        ? proj.deptPicIds.split(",").map(s => {
            const clean = s.trim();
            const u = users.find(user => user.name === clean || user.id === clean);
            return u ? u.name : clean;
          }).join(", ")
        : "";

      setLeadExecution(leadName);
      setTeamMembers(auditorNamesClean);
      setAdditionalAttendees(attendeesClean);
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedScheduleId(null);
    setSelectedProjectId("");
    setDepartmentsStr("");
    setAddress("");
    setVisitNumber("");
    setActualVisitDate("");
    setAuditPeriod("");
    setLeadExecution("");
    setTeamMembers("");
    setAdditionalAttendees("");
    setStandards("");
    setObjectives("");
    setScope("");
    setDepartmentConcern("");
    setRows([]);
    setAttachments([]);
    setMeetingStatus("DRAFT");
    setAttendeeConfirmations({});
    setIsModalOpen(true);
  };

  const openEditModal = (sched: OpenMeeting) => {
    setModalMode("edit");
    setSelectedProjectId(sched.projectId);
    setDepartmentsStr(sched.departments);
    setAddress(sched.address);
    setVisitNumber(sched.visitNumber);
    setActualVisitDate(sched.actualVisitDate);
    setAuditPeriod(sched.auditPeriod);
    setLeadExecution(sched.leadExecution);
    setTeamMembers(sched.teamMembers);
    setAdditionalAttendees(sched.additionalAttendees);
    setStandards(sched.standards);
    setMeetingStatus((sched.status as any) || "DRAFT");
    setAttendeeConfirmations(parseAttendeeConfirmations(sched.attendeeConfirmations));
    setObjectives(sched.objectives);
    setScope(sched.scope);
    setDepartmentConcern((sched as any).departmentConcern || "");
    setAttachments(sched.attachments ? JSON.parse(sched.attachments) : []);
    
    try {
      setRows(JSON.parse(sched.scheduleRows));
    } catch {
      setRows([]);
    }
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
          setTimeout(() => {
            openEditModal(sched);
          }, 100);
        }
      }
    }
  }, [schedules]);

  const persistMeetingSchedule = async (targetStatus: "DRAFT" | "RELEASED", options: { closeAfterSave?: boolean; sendReleaseNotification?: boolean } = {}) => {
    if (meetingStatus === "RELEASED" && targetStatus !== "DRAFT") {
      showFeedback("This meeting record is already released. Reopen it before making edits.");
      return false;
    }

    if (!selectedProjectId || !departmentsStr || !actualVisitDate) {
      showFeedback("Please fill in the required fields (Project, Departments, Date).");
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
      attendeeConfirmations: JSON.stringify(pruneConfirmations(additionalAttendeesArray, attendeeConfirmations)),
      standards,
      status: targetStatus,
      objectives,
      scope,
      departmentConcern,
      scheduleRows: JSON.stringify(rows),
      attachments: JSON.stringify(attachments),
      ownerName: modalMode === "create" ? currentUser.name : (schedules.find(x => x.id === selectedScheduleId)?.ownerName || currentUser.name),
      lastModifiedBy: currentUser.name
    };

    try {
      let savedId = selectedScheduleId;
      const shouldClose = options.closeAfterSave ?? false;
      const notifyRelease = options.sendReleaseNotification ?? false;

      if (modalMode === "create") {
        const result = await clientApi<OpenMeeting>("/meetings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!result) return false;
        savedId = result.id || savedId;
        setSelectedScheduleId(savedId || null);
        setMeetingStatus(targetStatus);
      } else {
        if (!selectedScheduleId) return false;
        const result = await clientApi<OpenMeeting>(`/meetings/${selectedScheduleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (!result) return false;
        savedId = result.id || savedId;
        setMeetingStatus(targetStatus);
      }

      const fresh = await clientApi<OpenMeeting[]>("/meetings");
      setSchedules(fresh);

      if (targetStatus === "RELEASED" && savedId && notifyRelease) {
        await clientApi(`/notifications/send-meeting-release/${savedId}`, { method: "POST" });
      }

      showFeedback(targetStatus === "RELEASED"
        ? "Open meeting report released and locked."
        : (modalMode === "create" ? "Open meeting record generated successfully." : "Open meeting changes saved."));

      if (shouldClose) {
        setIsModalOpen(false);
      }

      return true;
    } catch (err: any) {
      console.error(err);
      showFeedback(`Save failed: ${err.message || err.toString()}`);
      return false;
    }
  };

  const handleSaveSchedule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await persistMeetingSchedule("DRAFT", { closeAfterSave: false, sendReleaseNotification: false });
  };

  const handleReleaseSchedule = async () => {
    await persistMeetingSchedule("RELEASED", { closeAfterSave: false, sendReleaseNotification: true });
  };

  const handleConfirmAttendee = async (attendeeName: string) => {
    if (!selectedScheduleId) {
      showFeedback("Save and release the meeting before confirming attendance.");
      return;
    }

    if (meetingStatus !== "RELEASED") {
      showFeedback("Attendance can only be confirmed after the meeting is released.");
      return;
    }

    if (!canConfirmAttendee(attendeeName)) {
      showFeedback("Only the attendee or an Admin can confirm this attendance.");
      return;
    }

    if (attendeeConfirmations[attendeeName]) {
      showFeedback(`${attendeeName} is already confirmed.`);
      return;
    }

    const nextConfirmations = pruneConfirmations(additionalAttendeesArray, {
      ...attendeeConfirmations,
      [attendeeName]: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: currentUser.name
      }
    });

    try {
      const result = await clientApi<OpenMeeting>(`/meetings/${selectedScheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          attendeeConfirmations: JSON.stringify(nextConfirmations),
          lastModifiedBy: currentUser.name
        }),
      });

      if (result) {
        setAttendeeConfirmations(nextConfirmations);
        const fresh = await clientApi<OpenMeeting[]>("/meetings");
        setSchedules(fresh);
        showFeedback(`${attendeeName} confirmed attendance.`);
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Confirmation failed: ${err.message || err.toString()}`);
    }
  };

  const handleReopenSchedule = async () => {
    if (!selectedScheduleId) return;
    try {
      const result = await clientApi<OpenMeeting>(`/meetings/${selectedScheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "DRAFT",
          lastModifiedBy: currentUser.name
        }),
      });
      if (result) {
        setMeetingStatus("DRAFT");
        const fresh = await clientApi<OpenMeeting[]>("/meetings");
        setSchedules(fresh);
        showFeedback("Meeting record reopened for editing.");
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
      "Delete Meeting Record",
      `Are you sure you want to delete the meeting record for "${s.projectName}"? This action cannot be undone.`,
      async () => {
        try {
          const success = await clientApi<boolean>(`/meetings/${selectedScheduleId}`, { method: "DELETE" });
          if (success) {
            showFeedback("Meeting record removed from ledger.");
            setSelectedScheduleId(null);
            const fresh = await clientApi<OpenMeeting[]>("/meetings");
            setSchedules(fresh);
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
    const newRow = { day: "", date: new Date().toISOString().split('T')[0], time: "09:00 AM - 10:00 AM", activity: "", conductBy: "", pIncharge: "" };
    setRows([...rows, newRow]);
    setActiveRowIndex(rows.length);
    setDraftRow({ ...newRow });
  };

  const removeRow = (index: number) => {
    showConfirm(
      "Delete Agenda Item",
      "Are you sure you want to delete this agenda item? This action cannot be undone.",
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
        original.activity !== draftRow.activity ||
        original.conductBy !== draftRow.conductBy ||
        original.pIncharge !== draftRow.pIncharge;

      if (hasChanges) {
        showConfirm(
          "Discard Changes",
          "You have unsaved changes in this item. Are you sure you want to discard them?",
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
    const deptWithVer = getDepartmentWithVersion(s.departments, s.projectId);
    const matchesSearch = s.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.projectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.leadExecution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.departments?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          deptWithVer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === "ALL" || s.projectId === projectFilter;
    return matchesSearch && matchesProject;
  });

  const projectFilterOptions = projects.map(p => ({
    label: `ID: ${p.code} - ${p.name}`,
    value: p.id
  }));

  const activeSchedule = schedules.find(x => x.id === selectedScheduleId);
  const isLocked = meetingStatus === "RELEASED";

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print border-b border-slate-200 dark:border-slate-850 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Open Meetings & Minutes</h1>
          <p className="text-xs text-muted-foreground">
            Log alignment sessions, cross-department governance agendas, and minutes of meetings.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded-md shadow transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Meeting Ledger
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
            searchPlaceholder="Search meetings..."
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
                  <th className="px-6 py-4">Department(s)</th>
                  <th className="px-6 py-4">Meeting Date</th>
                  <th className="px-6 py-4">Facilitator</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">
                      No meetings matched filters or none have been created. Click "+" above to create a meeting alignment record.
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
                      <td className="px-6 py-4.5 font-roboto text-slate-777 dark:text-slate-300">
                        {s.projectCode}
                      </td>
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScheduleId(s.id);
                          openEditModal(s);
                        }}
                        className="px-6 py-4.5 text-[#0066cc] font-roboto font-medium hover:underline cursor-pointer"
                      >
                        {s.projectName}
                      </td>
                      <td className="px-6 py-4.5 text-slate-700 dark:text-slate-300 font-medium">
                        {getDepartmentWithVersion(s.departments, s.projectId)}
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

      {/* Edit/Create Popup Modal Styled Like Word Document */}
      {isModalOpen && (
        <div id="scoping-modal-root" className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center z-50 overflow-y-auto p-4 md:p-8 animate-fade-in no-print-backdrop">
          <div className="bg-white dark:bg-slate-955 w-full max-w-[98vw] xl:max-w-[98vw] rounded-lg shadow-2xl flex flex-col overflow-hidden h-fit border border-slate-200 dark:border-slate-850 scoping-modal-container">
            
            {/* Modal Header */}
            <div className="px-8 py-5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-roboto text-slate-400 font-bold uppercase tracking-wider">
                  DOCUMENT 2. OPEN MEETINGS
                </div>
                <h2 className="text-lg font-roboto font-bold text-slate-800 dark:text-slate-100">
                  Open Meeting Report
                </h2>
                {/* Meta details row under header */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] font-roboto text-slate-400 mt-1">
                  {modalMode === "edit" && activeSchedule ? (
                    <>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5" /> Owner: {activeSchedule.ownerName || "System"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Edit className="w-3.5 h-3.5" /> Last Modified By: {activeSchedule.lastModifiedBy || "System"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Last Modified: {activeSchedule.updatedAt ? new Date(activeSchedule.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {meetingStatus === "RELEASED" ? (
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
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5" /> Owner: {currentUser.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions Header Bar */}
              <div className="flex items-center gap-2.5 shrink-0 no-print">
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
                {!isLocked ? (
                  <button
                    type="button"
                    onClick={handleReleaseSchedule}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold rounded cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" /> Release
                  </button>
                ) : null}
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
              
              {/* Linked Audit Plan Card */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-5 shadow-sm">
                
                {/* Linked Audit Plan Left section */}
                <div className="w-full">
                  <div className="flex border border-slate-250 dark:border-slate-800 rounded-lg h-12 items-center">
                    <div className="bg-slate-50 dark:bg-slate-900/60 px-4 h-full flex items-center font-roboto font-bold text-xs text-slate-700 dark:text-slate-355 border-r border-slate-250 dark:border-slate-800 shrink-0 w-36 rounded-l-lg">
                      Linked OE Plan
                    </div>
                    <div className="px-4 h-full flex items-center flex-1 bg-white dark:bg-slate-950">
                      {modalMode === "create" ? (
                        <AuditPlanSelect
                          projects={projects.filter(p => isProjectMember(p) && p.status === "RELEASED")}
                          selectedProjectId={selectedProjectId}
                          onSelect={handleProjectSelect}
                          placeholder="Choose OE Plan..."
                        />
                      ) : (
                        <div className="flex items-center gap-2 overflow-hidden">
                          {(() => {
                            const p = projects.find(proj => proj.id === selectedProjectId);
                            if (!p) return <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Unknown OE Plan</span>;
                            return (
                              <>
                                <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                                  {p.code}
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {p.name}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Summary Info Grid */}
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-350 dark:border-slate-800 rounded-md">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {/* Row 1: Department */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Department:
                        </td>
                        <td colSpan={3} className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950">
                          {departmentsStr ? (
                            getDepartmentWithVersion(departmentsStr, selectedProjectId)
                          ) : (
                            <span className="text-slate-400 font-normal italic">
                              Select an OE Plan to auto-derive department
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Row 3: Visit Number + Actual Visit Date */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">

                        <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Meeting Date:
                        </td>
                        <td className="px-4 py-2 bg-white-100 dark:bg-slate-900/20 font-bold text-slate-900 dark:text-white-100">
                          <input 
                            type="date" 
                            required
                            value={actualVisitDate}
                            onChange={(e) => setActualVisitDate(e.target.value)}
                            placeholder="20 July 2026"
                            className="w-full bg-transparent border-none p-0 text-xs focus:outline-none font-bold text-slate-900 dark:text-slate-100"
                          />
                        </td>
                      </tr>
                      {/* Row 5: Facilitator */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                          Facilitator / Organizer:
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={leadExecutionArray}
                            onChange={(values) => setLeadExecution(values.join(", "))}
                            options={userOptions}
                            placeholder="Select facilitators..."
                            disabled={isLocked}
                          />
                        </td>
                      </tr>


                      {/* Row 7: Attendees */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 leading-normal">
                          Attendees:
                        </td>
                        <td colSpan={3} className="px-4 py-2.5">
                          <MultiSelect
                            selectedValues={additionalAttendeesArray}
                            onChange={(values) => {
                              setAdditionalAttendees(values.join(", "));
                              setAttendeeConfirmations(prev => pruneConfirmations(values, prev));
                            }}
                            options={userOptions}
                            placeholder="Select attendees..."
                            disabled={isLocked}
                          />
                          {additionalAttendeesArray.length > 0 && (
                            <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Attendance Confirmation</span>
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{confirmedAttendeeCount}/{additionalAttendeesArray.length} confirmed</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {additionalAttendeesArray.map((attendeeName) => {
                                  const confirmation = attendeeConfirmations[attendeeName];
                                  const canConfirm = canConfirmAttendee(attendeeName);
                                  const confirmedAt = confirmation?.confirmedAt
                                    ? new Date(confirmation.confirmedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : "";

                                  return (
                                    <div key={attendeeName} className="flex items-center justify-between gap-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                                      <div className="min-w-0">
                                        <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{attendeeName}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                          {confirmation ? `Confirmed by ${confirmation.confirmedBy} on ${confirmedAt}` : "Pending confirmation"}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmAttendee(attendeeName)}
                                        disabled={Boolean(confirmation) || !canConfirm || !selectedScheduleId || !isLocked}
                                        className={`shrink-0 inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-bold transition-colors ${confirmation
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                          : canConfirm && selectedScheduleId && isLocked
                                            ? "bg-[#05375c] text-white hover:bg-[#074776] cursor-pointer"
                                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                                        }`}
                                      >
                                        {confirmation && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {confirmation ? "Confirmed" : !selectedScheduleId ? "Save First" : !isLocked ? "Release First" : canConfirm ? "Confirm" : "Waiting"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Row 10: OPE Objectives */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Objective:
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <PlanItemEditor 
                            sectionTitle="Objectives"
                            items={parsePlanItems(objectives, "IAP-OBJ")}
                            onChange={() => {}}
                            prefix="IAP-OBJ"
                            editable={false}
                            hideHeader={true}
                          />
                        </td>
                      </tr>

                      {/* Row 11: OPE Scope */}
                      <tr className="border-b border-slate-300 dark:border-slate-800/80">
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          Audit Scope:
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <PlanItemEditor 
                            sectionTitle="Audit Scope"
                            items={parsePlanItems(scope, "IAP-ISCP")}
                            onChange={() => {}}
                            prefix="IAP-ISCP"
                            editable={false}
                            hideHeader={true}
                          />
                        </td>
                      </tr>

                      {/* Row 12: Department Concern */}
                      <tr>
                        <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 align-top">
                          The Concern of the Department Owner:
                        </td>
                        <td colSpan={3} className="px-4 py-3">
                          <RichEditor 
                            value={departmentConcern}
                            onChange={setDepartmentConcern}
                            placeholder="Add concerns of the department owner..."
                            editorClassName="min-h-[120px] max-h-[250px]"
                            editable={!isLocked}
                          />
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Attachments
                </h3>
                <div className="space-y-3">
                  <input
                    type="file"
                    disabled={isLocked}
                    className="block w-full text-xs text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-xs file:font-semibold
                      file:bg-[#0066cc]/10 file:text-[#0066cc]
                      hover:file:bg-[#0066cc]/20
                      disabled:opacity-50 disabled:cursor-not-allowed
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
                          {!isLocked && canManage && (
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

              {/* PDF Print Footer Note */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-[12px] font-roboto text-slate-400 leading-relaxed italic">
                Note: Alignment agendas and decision minutes represent binding milestones of coordinated department.
                {isLocked && <span className="not-italic text-amber-600 dark:text-amber-300">This record is released and locked. Use Reopen to edit.</span>}
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

      {/* Universal QR Code Modal */}
      {qrModalData && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          qrToken={qrModalData.qrToken}
          projectTitle={qrModalData.projectTitle}
          projectCode={qrModalData.projectCode}
          departments={qrModalData.departments}
        />
      )}

    </div>
  );
}
