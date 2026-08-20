"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  FileText, 
  ClipboardList, 
  User as UserIcon, 
  Clock, 
  Save, 
  CalendarDays,
  X,
  FileDown,
  Send,
  UserPlus,
  Users,
  ShieldAlert,
  History,
  HelpCircle,
  Activity,
  ArrowUpRight,
  Import,
  Download,
  Copy,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  RotateCcw,
  Mail,
  BookOpen,
  CheckCircle2,
  QrCode,
  Maximize2,
  Check,
  Lock,
  Unlock,
  Link
} from "lucide-react";
import type { AuditProject, User, Attachment, ScheduleRow, Department, AnnualPlan, AuditPlan, AuditPlanItem } from "@auditdesk/shared";
import { parsePlanItems, serializePlanItems } from "@auditdesk/shared";
import { RBAC } from "@/lib/auth";
import RichEditor from "@/components/ui/rich-editor";
import ActionToolbar from "@/components/ui/action-toolbar";
import MultiSelect from "@/components/ui/multi-select";
import PlanItemEditor from "@/components/ui/plan-item-editor";
import QRCode from "qrcode";
import { clientApi } from "@/lib/apiClient";

interface PlanningClientProps {
  initialProjects: AuditProject[];
  users: User[];
  departments: Department[];
  annualPlans: AnnualPlan[];
  auditPlans: AuditPlan[];
  currentUser: User;
}

export default function PlanningClient({ initialProjects, users, departments, annualPlans, auditPlans, currentUser }: PlanningClientProps) {
  const [projects, setProjects] = useState<AuditProject[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjects[0]?.id || "");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [showTimeline, setShowTimeline] = useState(true);
  
  // Popup modal state
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [scanQrDataUrl, setScanQrDataUrl] = useState<string>("");
  const [planningQrDataUrl, setPlanningQrDataUrl] = useState<string>("");


  // Auto-open project if URL contains ?id=... (e.g. from scanning QR code)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("id");
      if (urlId) {
        const found = projects.find(p => p.id === urlId);
        if (found) {
          openProjectEditor(found);
        }
      }
    }
  }, []);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selected project details edit state
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Generate local QR Codes when project changes
  useEffect(() => {
    if (selectedProject?.id) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const scanUrl = `${origin}/meetings/scan/${selectedProject.id}`;
      const planningUrl = `${origin}/planning?id=${selectedProject.id}`;

      QRCode.toDataURL(scanUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      })
        .then((url) => setScanQrDataUrl(url))
        .catch((err) => console.error("Failed to generate scan QR", err));

      QRCode.toDataURL(planningUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      })
        .then((url) => setPlanningQrDataUrl(url))
        .catch((err) => console.error("Failed to generate planning QR", err));
    } else {
      setScanQrDataUrl("");
      setPlanningQrDataUrl("");
    }
  }, [selectedProject?.id]);

  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<any>("PLANNING");

  const [editPlanning, setEditPlanning] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLead, setEditLead] = useState("");

  // Additional fields state
  const [editWorkflowStage, setEditWorkflowStage] = useState<any>("DRAFTING");
  const [editAuditorIds, setEditAuditorIds] = useState<string[]>([]);
  const [editDeptPicIds, setEditDeptPicIds] = useState<string[]>([]);
  const [editDepartments, setEditDepartments] = useState<string[]>([]);
  const [editAnnualPlanId, setEditAnnualPlanId] = useState("");
  const [editAuditPlanId, setEditAuditPlanId] = useState("");
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);

  // Selection Dropdown states
  const [isAuditorDropdownOpen, setIsAuditorDropdownOpen] = useState(false);
  const [isPicDropdownOpen, setIsPicDropdownOpen] = useState(false);

  // Additional screen-matching properties (session local persistence)
  const [editObjectivesItems, setEditObjectivesItems] = useState<AuditPlanItem[]>([]);
  const [editScopeItems, setEditScopeItems] = useState<AuditPlanItem[]>([]);
  const [editRiskProcess, setEditRiskProcess] = useState("");
  const [editRiskClass, setEditRiskClass] = useState("");
  const [editOpEx, setEditOpEx] = useState("");
  const [editFieldwork, setEditFieldwork] = useState("");
  const [editOutcome, setEditOutcome] = useState("");
  const [editDataRequestItems, setEditDataRequestItems] = useState<AuditPlanItem[]>([]);
  const [editFocusAreaItems, setEditFocusAreaItems] = useState<AuditPlanItem[]>([]);
  
  // Timeline states
  const [editTimelinePresDate, setEditTimelinePresDate] = useState("");
  const [editTimelineNotificationDate, setEditTimelineNotificationDate] = useState("");
  const [editTimelineFieldWorkStart, setEditTimelineFieldWorkStart] = useState("");
  const [editTimelineFieldWorkEnd, setEditTimelineFieldWorkEnd] = useState("");
  const [editTimelineFindingReportOffset, setEditTimelineFindingReportOffset] = useState(0);
  const [editTimelineFinalReportOffset, setEditTimelineFinalReportOffset] = useState(0);

  // Approvals states
  const [editPreparedByName, setEditPreparedByName] = useState("");
  const [editPreparedByTitle, setEditPreparedByTitle] = useState("");
  const [editPreparedDate, setEditPreparedDate] = useState("");
  const [editApprovedByName, setEditApprovedByName] = useState("");
  const [editApprovedByTitle, setEditApprovedByTitle] = useState("");
  const [editApprovedDate, setEditApprovedDate] = useState("");

  // Attendance Confirmations state
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

  const [attendeeConfirmations, setAttendeeConfirmations] = useState<Record<string, AttendeeConfirmation>>({});

  const normalizeAttendeeName = (name: string) => name.trim().toLowerCase();
  const canConfirmAttendee = (attendeeName: string) => currentUser.role === "ADMIN" || normalizeAttendeeName(attendeeName) === normalizeAttendeeName(currentUser.name);

  const handleConfirmAttendee = async (attendeeName: string) => {
    if (!selectedProject) return;

    // Find linked meeting schedule if any
    const linkedMeeting = selectedProject.executionSchedules?.find(e => e.language === "meeting");

    if (!canConfirmAttendee(attendeeName)) {
      showFeedback("Only the attendee or an Admin can confirm this attendance.");
      return;
    }

    if (attendeeConfirmations[attendeeName]) {
      showFeedback(`${attendeeName} is already confirmed.`);
      return;
    }

    const deptPicArray = editDeptPicIds;
    const nextConfirmations = pruneConfirmations(deptPicArray, {
      ...attendeeConfirmations,
      [attendeeName]: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: currentUser.name
      }
    });

    try {
      if (linkedMeeting) {
        await clientApi(`/execution-schedules/${linkedMeeting.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            attendeeConfirmations: JSON.stringify(nextConfirmations),
            lastModifiedBy: currentUser.name
          })
        });
      }

      const updatedProj = await clientApi<AuditProject>(`/audit-projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          deptPicConfirmations: JSON.stringify(nextConfirmations)
        })
      });

      if (updatedProj) {
        setAttendeeConfirmations(nextConfirmations);
        setProjects(projects.map(p => (p.id === selectedProject.id ? updatedProj : p)));
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Confirmation failed: ${err.message || err.toString()}`);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "………………. (TBD)";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getCalculatedDate = (baseDateStr: string, offsetDays: number) => {
    if (!baseDateStr) return null;
    try {
      const d = new Date(baseDateStr);
      if (isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };
  
  const [riskLevel, setRiskLevel] = useState("High Impact");
  const [completionStatus, setCompletionStatus] = useState("45% Planned");

  // New Project Form state
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLeads, setNewLeads] = useState<string[]>([]);
  const [newDepartments, setNewDepartments] = useState<string[]>([]);
  const [newAnnualPlanId, setNewAnnualPlanId] = useState("");
  const [newAuditPlanId, setNewAuditPlanId] = useState("");

  const closeNewProjectModal = () => {
    setIsCreating(false);
    setIsCopying(false);
  };

  const openNewProjectModal = async () => {
    setIsCopying(false);
    setIsCreating(true);
    setNewName("");
    setNewStart(new Date().toISOString().split("T")[0]);
    const endDateObj = new Date();
    endDateObj.setDate(endDateObj.getDate() + 90);
    setNewEnd(endDateObj.toISOString().split("T")[0]);
    setNewLeads([]);
    setNewDepartments([]);
    setNewAnnualPlanId("");
    setNewAuditPlanId("");
    
    try {
      const nextCode = await clientApi<string>("/audit-projects/next-code?prefix=AP");
      setNewCode(nextCode);
    } catch (e) {
      setNewCode("AUTO");
    }
  };

  const openCopyProjectModal = async (proj: AuditProject) => {
    setIsCopying(true);
    setIsCreating(true);
    setSelectedProjectId(proj.id);
    setNewName(""); // Keep blank as requested
    setNewStart(proj.startDate);
    setNewEnd(proj.endDate);
    
    const initialLeads: string[] = [];
    if (proj.leadAuditorId) {
      const matchedUser = users.find(u => u.id === proj.leadAuditorId || u.name === proj.leadAuditorId);
      if (matchedUser && !initialLeads.includes(matchedUser.id)) initialLeads.push(matchedUser.id);
    }
    if (proj.auditorNames) {
      proj.auditorNames.split(",").forEach(n => {
        const clean = n.trim();
        const matched = users.find(u => u.name === clean || u.id === clean);
        if (matched && !initialLeads.includes(matched.id)) initialLeads.push(matched.id);
      });
    }
    setNewLeads(initialLeads);
    setNewDepartments([]);

    try {
      const nextCode = await clientApi<string>("/audit-projects/next-code?prefix=AP");
      setNewCode(nextCode);
    } catch (e) {
      setNewCode("AUTO");
    }
  };

  const [feedback, setFeedback] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Helper to check if any edits are unsaved compared to database state
  const checkIfDirty = () => {
    if (!selectedProject) return false;
    
    if (editName !== selectedProject.name) return true;
    if (editStatus !== selectedProject.status) return true;
    if (editAnnualPlanId !== (selectedProject.annualPlanId || "")) return true;
    if (editAuditPlanId !== (selectedProject.auditPlanId || "")) return true;
    
    const prevDepartments = selectedProject.departments ? selectedProject.departments.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (editDepartments.length !== prevDepartments.length || !editDepartments.every(d => prevDepartments.includes(d))) return true;

    if (editPlanning !== selectedProject.planningDetails) return true;
    if (editStart !== selectedProject.startDate) return true;
    if (editEnd !== selectedProject.endDate) return true;
    if (editLead !== (selectedProject.leadAuditorId || "")) return true;
    
    if (editWorkflowStage !== (selectedProject.workflowStage || "DRAFTING")) return true;
    
    if (JSON.stringify(editObjectivesItems) !== JSON.stringify(parsePlanItems(selectedProject.objectives, "AP-OBJ"))) return true;
    if (JSON.stringify(editScopeItems) !== JSON.stringify(parsePlanItems(selectedProject.scope, "AP-ISCP"))) return true;
    
    const dbRiskProcess = selectedProject.riskProcess || "";
    if (editRiskProcess !== dbRiskProcess) return true;

    const dbRiskClass = selectedProject.riskClass || "";
    if (editRiskClass !== dbRiskClass) return true;

    const dbOpEx = selectedProject.opEx || "";
    if (editOpEx !== dbOpEx) return true;

    const dbFieldwork = selectedProject.fieldwork || "";
    if (editFieldwork !== dbFieldwork) return true;

    const dbOutcome = selectedProject.outcome || "";
    if (editOutcome !== dbOutcome) return true;

    if (serializePlanItems(editDataRequestItems) !== (selectedProject.dataRequestType || "")) return true;
    if (serializePlanItems(editFocusAreaItems) !== (selectedProject.focusArea || "")) return true;
    
    const currentTimelineJson = JSON.stringify({
      presentationDate: editTimelinePresDate,
      notificationDate: editTimelineNotificationDate,
      fieldWorkStart: editTimelineFieldWorkStart,
      fieldWorkEnd: editTimelineFieldWorkEnd,
      findingReportOffset: Number(editTimelineFindingReportOffset),
      finalReportOffset: Number(editTimelineFinalReportOffset)
    });
    let dbTimelineJson = selectedProject.opExTimeline || "";
    if (!dbTimelineJson) {
      dbTimelineJson = JSON.stringify({
        presentationDate: "",
        notificationDate: "",
        fieldWorkStart: "",
        fieldWorkEnd: "",
        findingReportOffset: 0,
        finalReportOffset: 0
      });
    } else {
      try {
        dbTimelineJson = JSON.stringify(JSON.parse(dbTimelineJson));
      } catch {}
    }
    if (currentTimelineJson !== dbTimelineJson) return true;
    
    const currentApprovalsJson = JSON.stringify({
      preparedByName: editPreparedByName,
      preparedByTitle: editPreparedByTitle,
      preparedDate: editPreparedDate,
      approvedByName: editApprovedByName,
      approvedByTitle: editApprovedByTitle,
      approvedDate: editApprovedDate
    });
    let dbApprovalsJson = selectedProject.approvals || "";
    if (!dbApprovalsJson) {
      dbApprovalsJson = JSON.stringify({
        preparedByName: "",
        preparedByTitle: "",
        preparedDate: "",
        approvedByName: "",
        approvedByTitle: "",
        approvedDate: ""
      });
    } else {
      try {
        dbApprovalsJson = JSON.stringify(JSON.parse(dbApprovalsJson));
      } catch {}
    }
    if (currentApprovalsJson !== dbApprovalsJson) return true;
    
    const prevAuditors = selectedProject.auditorNames ? selectedProject.auditorNames.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (editAuditorIds.length !== prevAuditors.length || !editAuditorIds.every(name => prevAuditors.includes(name))) return true;
    
    const prevPics = selectedProject.deptPicIds ? selectedProject.deptPicIds.split(",").filter(Boolean) : [];
    if (editDeptPicIds.length !== prevPics.length || !editDeptPicIds.every(name => prevPics.includes(name))) return true;

    return false;
  };

  const handleCloseEditor = () => {
    if (checkIfDirty()) {
      const confirmDiscard = window.confirm("Warning: You have unsaved changes. Discarding will lose all modifications made to this scoping document. Are you sure you want to exit?");
      if (!confirmDiscard) return;
    }
    setIsPopupOpen(false);
  };

  // Open popup and load project for editing
  const openProjectEditor = (proj: AuditProject) => {
    setSelectedProjectId(proj.id);
    setEditName(proj.name);
    setEditStatus(proj.status);

    setEditPlanning(proj.planningDetails);
    setEditStart(proj.startDate);
    setEditEnd(proj.endDate);
    setEditLead(proj.leadAuditorId ? (users.find(u => u.id === proj.leadAuditorId || u.name === proj.leadAuditorId)?.id || proj.leadAuditorId) : "");
    
    // Set custom SQLite integrations
    setEditWorkflowStage(proj.workflowStage || "DRAFTING");
    setEditDepartments(proj.departments ? proj.departments.split(",").map(s => s.trim()).filter(Boolean) : []);
    setEditAuditorIds(proj.auditorNames ? proj.auditorNames.split(",").map(s => s.trim()).filter(Boolean) : []);
    setEditDeptPicIds(proj.deptPicIds ? proj.deptPicIds.split(",").filter(Boolean).map(s => {
      const clean = s.trim();
      const matched = users.find(u => u.name === clean || u.id === clean);
      return matched ? matched.name : clean;
    }) : []);
    setEditAnnualPlanId(proj.annualPlanId || "");
    setEditAuditPlanId(proj.auditPlanId || "");
    setEditAttachments(proj.attachments || []);

    // Load scoping values from database fields, with default fallback templates if null/empty
    setEditObjectivesItems(parsePlanItems(proj.objectives, "AP-OBJ"));
    setEditScopeItems(parsePlanItems(proj.scope, "AP-ISCP"));
    setEditRiskClass(proj.riskClass || "");
    setEditOpEx(proj.opEx || "");
    setEditFieldwork(proj.fieldwork || "");
    setEditOutcome(proj.outcome || "");
    setEditDataRequestItems(parsePlanItems(proj.dataRequestType, "AP-DRQ"));
    setEditFocusAreaItems(parsePlanItems(proj.focusArea, "AP-FCA"));
    
    let timelineObj = {
      presentationDate: "",
      notificationDate: "",
      fieldWorkStart: "",
      fieldWorkEnd: "",
      findingReportOffset: 0,
      finalReportOffset: 0
    };
    if (proj.opExTimeline) {
      try {
        timelineObj = { ...timelineObj, ...JSON.parse(proj.opExTimeline) };
      } catch (e) {
        console.error("Failed to parse timeline JSON:", e);
      }
    }
    setEditTimelinePresDate(timelineObj.presentationDate !== undefined ? timelineObj.presentationDate : "");
    setEditTimelineNotificationDate(timelineObj.notificationDate !== undefined ? timelineObj.notificationDate : "");
    setEditTimelineFieldWorkStart(timelineObj.fieldWorkStart !== undefined ? timelineObj.fieldWorkStart : "");
    setEditTimelineFieldWorkEnd(timelineObj.fieldWorkEnd !== undefined ? timelineObj.fieldWorkEnd : "");
    setEditTimelineFindingReportOffset(timelineObj.findingReportOffset !== undefined ? timelineObj.findingReportOffset : 0);
    setEditTimelineFinalReportOffset(timelineObj.finalReportOffset !== undefined ? timelineObj.finalReportOffset : 0);
    
    let approvalsObj = {
      preparedByName: "",
      preparedByTitle: "",
      preparedDate: "",
      approvedByName: "",
      approvedByTitle: "",
      approvedDate: ""
    };
    if (proj.approvals) {
      try {
        approvalsObj = { ...approvalsObj, ...JSON.parse(proj.approvals) };
      } catch (e) {
        console.error("Failed to parse approvals JSON:", e);
      }
    }
    setEditPreparedByName(approvalsObj.preparedByName || "");
    setEditPreparedByTitle(approvalsObj.preparedByTitle || "");
    setEditPreparedDate(approvalsObj.preparedDate || "");
    setEditApprovedByName(approvalsObj.approvedByName || "");
    setEditApprovedByTitle(approvalsObj.approvedByTitle || "");
    setEditApprovedDate(approvalsObj.approvedDate || "");

    const linkedMeeting = proj.executionSchedules?.find(e => e.language === "meeting");
    const initialConfirmations = parseAttendeeConfirmations(proj.deptPicConfirmations || linkedMeeting?.attendeeConfirmations);
    setAttendeeConfirmations(initialConfirmations);
    
    // Close dropdown panels
    setIsAuditorDropdownOpen(false);
    setIsPicDropdownOpen(false);
    setFeedback(null);

    setIsPopupOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProject) return;
    showFeedback("Submitting scoping details...");

    try {
      const updated = await clientApi<AuditProject>(`/audit-projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          scope: serializePlanItems(editScopeItems),
          planningDetails: editPlanning,
          startDate: editStart,
          endDate: editEnd,
          leadAuditorId: editLead || null,
          workflowStage: editWorkflowStage,
          deptPicIds: editDeptPicIds.join(","),
          departments: editDepartments.join(","),
          auditorIds: editAuditorIds,
          auditorNames: editAuditorIds.map(id => users.find(u => u.id === id)?.name || id).join(","),
          objectives: serializePlanItems(editObjectivesItems),
          riskProcess: editRiskProcess,
          riskClass: editRiskClass,
          opEx: editOpEx,
          fieldwork: editFieldwork,
          outcome: editOutcome,
          dataRequestType: serializePlanItems(editDataRequestItems),
          focusArea: serializePlanItems(editFocusAreaItems),
          opExTimeline: JSON.stringify({
            presentationDate: editTimelinePresDate,
            notificationDate: editTimelineNotificationDate,
            fieldWorkStart: editTimelineFieldWorkStart,
            fieldWorkEnd: editTimelineFieldWorkEnd,
            findingReportOffset: Number(editTimelineFindingReportOffset),
            finalReportOffset: Number(editTimelineFinalReportOffset)
          }),
          approvals: JSON.stringify({
            preparedByName: editPreparedByName,
            preparedByTitle: editPreparedByTitle,
            preparedDate: editPreparedDate,
            approvedByName: editApprovedByName,
            approvedByTitle: editApprovedByTitle,
            approvedDate: editApprovedDate
          }),
          annualPlanId: editAnnualPlanId,
          auditPlanId: editAuditPlanId
        })
      });

      if (updated) {
        setProjects(projects.map(p => (p.id === selectedProject.id ? updated : p)));
        setIsPopupOpen(false);
      } else {
        showFeedback("Submission failed: Project not found.");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Submission Error: ${err.message || err.toString()}`);
    }
  };

  const handleSaveOnly = async () => {
    if (!selectedProject) return;
    showFeedback("Saving draft...");

    try {
      const updated = await clientApi<AuditProject>(`/audit-projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          scope: serializePlanItems(editScopeItems),
          planningDetails: editPlanning,
          startDate: editStart,
          endDate: editEnd,
          leadAuditorId: editLead || null,
          workflowStage: editWorkflowStage,
          deptPicIds: editDeptPicIds.join(","),
          departments: editDepartments.join(","),
          auditorIds: editAuditorIds,
          auditorNames: editAuditorIds.map(id => users.find(u => u.id === id)?.name || id).join(","),
          objectives: serializePlanItems(editObjectivesItems),
          riskProcess: editRiskProcess,
          riskClass: editRiskClass,
          opEx: editOpEx,
          fieldwork: editFieldwork,
          outcome: editOutcome,
          dataRequestType: serializePlanItems(editDataRequestItems),
          focusArea: serializePlanItems(editFocusAreaItems),
          opExTimeline: JSON.stringify({
            presentationDate: editTimelinePresDate,
            notificationDate: editTimelineNotificationDate,
            fieldWorkStart: editTimelineFieldWorkStart,
            fieldWorkEnd: editTimelineFieldWorkEnd,
            findingReportOffset: Number(editTimelineFindingReportOffset),
            finalReportOffset: Number(editTimelineFinalReportOffset)
          }),
          approvals: JSON.stringify({
            preparedByName: editPreparedByName,
            preparedByTitle: editPreparedByTitle,
            preparedDate: editPreparedDate,
            approvedByName: editApprovedByName,
            approvedByTitle: editApprovedByTitle,
            approvedDate: editApprovedDate
          }),
          annualPlanId: editAnnualPlanId,
          auditPlanId: editAuditPlanId
        })
      });

      if (updated) {
        setProjects(projects.map(p => (p.id === selectedProject.id ? updated : p)));
        showFeedback("Scoping plan updates saved successfully.");
        setTimeout(() => setFeedback(null), 4000);
      } else {
        showFeedback("Save failed: Project not found.");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Save Error: ${err.message || err.toString()}`);
    }
  };

  const handleUpdateWorkflowStage = async (newStage: any) => {
    setEditWorkflowStage(newStage);
    if (!selectedProject) return;

    const updated = await clientApi<AuditProject>(`/audit-projects/${selectedProject.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        workflowStage: newStage
      })
    });

    if (updated) {
      setProjects(projects.map(p => (p.id === selectedProject.id ? updated : p)));
    }
  };

  const saveStatusChange = async (newStatus: any) => {
    if (!selectedProject) return;
    setEditStatus(newStatus);
    showFeedback(`Updating status to ${newStatus}...`);
    try {
      const updated = await clientApi<AuditProject>(`/audit-projects/${selectedProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          status: newStatus,
          scope: serializePlanItems(editScopeItems),
          planningDetails: editPlanning,
          startDate: editStart,
          endDate: editEnd,
          leadAuditorId: editLead || null,
          workflowStage: editWorkflowStage,
          deptPicIds: editDeptPicIds.join(","),
          departments: editDepartments.join(","),
          auditorIds: editAuditorIds,
          auditorNames: editAuditorIds.join(","),
          objectives: serializePlanItems(editObjectivesItems),
          riskProcess: editRiskProcess,
          riskClass: editRiskClass,
          opEx: editOpEx,
          fieldwork: editFieldwork,
          outcome: editOutcome,
          dataRequestType: serializePlanItems(editDataRequestItems),
          focusArea: serializePlanItems(editFocusAreaItems),
          opExTimeline: JSON.stringify({
            presentationDate: editTimelinePresDate,
            notificationDate: editTimelineNotificationDate,
            fieldWorkStart: editTimelineFieldWorkStart,
            fieldWorkEnd: editTimelineFieldWorkEnd,
            findingReportOffset: Number(editTimelineFindingReportOffset),
            finalReportOffset: Number(editTimelineFinalReportOffset)
          }),
          approvals: JSON.stringify({
            preparedByName: editPreparedByName,
            preparedByTitle: editPreparedByTitle,
            preparedDate: editPreparedDate,
            approvedByName: editApprovedByName,
            approvedByTitle: editApprovedByTitle,
            approvedDate: editApprovedDate
          }),
          annualPlanId: editAnnualPlanId,
          auditPlanId: editAuditPlanId
        })
      });

      if (updated) {
        setProjects(projects.map(p => (p.id === selectedProject.id ? updated : p)));
        showFeedback(`Status successfully updated to ${newStatus === "PLANNING" ? "Planning" : newStatus === "SUBMITTED_FOR_APPROVAL" ? "Submitted for Approval" : "Released"}.`);
        setTimeout(() => setFeedback(null), 3000);
      } else {
        showFeedback("Status update failed: Project not found.");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Status update Error: ${err.message || err.toString()}`);
    }
  };

  const triggerEmailAlerts = (simulatedAlerts: Array<{ to: string; subject: string; body: string }>) => {
    for (const alert of simulatedAlerts) {
      window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
    }
  };

  const handleSubmitForApproval = async () => {
    if (!selectedProject) return;
    await saveStatusChange("SUBMITTED_FOR_APPROVAL");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "SUBMITTED_FOR_APPROVAL",
          details: "The audit plan scoping and timelines have been submitted for approval review."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };
 
  const handleApprovePlan = async () => {
    if (!selectedProject) return;
    await saveStatusChange("RELEASED");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "RELEASED (APPROVED)",
          details: "The audit plan has been officially approved and released by the Lead Auditor."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };
 
  const handleRejectPlan = async () => {
    if (!selectedProject) return;
    await saveStatusChange("PLANNING");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "REJECTED (REOPENED)",
          details: "The audit plan was rejected by the approver. The status has reverted to Planning. Please revise the scoping documents and timelines."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };
 
  const handleReopenPlan = async () => {
    if (!selectedProject) return;
    await saveStatusChange("PLANNING");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "PLANNING (REOPENED)",
          details: "The approval submission has been cancelled. The plan is now reopened for further editing."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };

  const handleClosePlan = async () => {
    if (!selectedProject) return;
    if (!window.confirm("Are you sure you want to CLOSE this Audit Plan once and for all?\n\nOnce closed, no new or existing Open Meetings, Execution Schedules, or Audit Findings will be allowed to point to this plan.")) return;
    await saveStatusChange("CLOSED");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "CLOSED",
          details: "The audit plan has been officially closed and archived by the Lead Auditor/Admin."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };

  const handleReopenClosedPlan = async () => {
    if (!selectedProject) return;
    if (!window.confirm("Are you sure you want to REOPEN this closed Audit Plan?")) return;
    await saveStatusChange("RELEASED");
    const emailResult = await clientApi<{ success: boolean; simulatedAlerts: Array<{ to: string; subject: string; body: string }> }>("/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        templateId: "planning",
        projectId: selectedProject.id,
        variables: {
          status: "RELEASED (REOPENED)",
          details: "The closed audit plan has been reopened by the Lead Auditor/Admin."
        }
      })
    });
    if (emailResult.success) {
      triggerEmailAlerts(emailResult.simulatedAlerts);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newStart || !newEnd) return;

    const leadAuditorIdParam = newLeads[0] || null;

    const selectedAp = newAuditPlanId ? auditPlans?.find(ap => ap.id === newAuditPlanId) : null;
    const deptVal = selectedAp?.topic || (newDepartments.length > 0 ? newDepartments.join(",") : "");

    const newProj = await clientApi<AuditProject>("/audit-projects", {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        code: "AUTO", // Always auto-generate and increment sequence on the backend
        status: "PLANNING",
        scope: "",
        planningDetails: "",
        startDate: newStart,
        endDate: newEnd,
        leadAuditorId: leadAuditorIdParam,
        departments: deptVal,
        annualPlanId: newAnnualPlanId || null,
        auditPlanId: newAuditPlanId || null
      })
    });

    let finalProj = newProj;

    if (isCopying && selectedProjectId) {
      const originalProj = projects.find(p => p.id === selectedProjectId);
      if (originalProj) {
        const copyPayload = {
          scope: originalProj.scope || "",
          planningDetails: originalProj.planningDetails || "",
          objectives: originalProj.objectives || "",
          riskProcess: originalProj.riskProcess || "",
          riskClass: originalProj.riskClass || "",
          opEx: originalProj.opEx || "",
          fieldwork: originalProj.fieldwork || "",
          outcome: originalProj.outcome || "",
          dataRequestType: originalProj.dataRequestType || "",
          focusArea: originalProj.focusArea || "",
          opExTimeline: originalProj.opExTimeline || "",
          approvals: originalProj.approvals || "",
          deptPicIds: originalProj.deptPicIds || "",
          departments: originalProj.departments || "",
          auditorNames: newLeads.length > 0 ? newLeads.join(",") : (originalProj.auditorNames || ""),
          auditorIds: newLeads.length > 0 
            ? newLeads.map(l => users.find(u => u.name === l || u.id === l)?.id || l) 
            : (originalProj.auditorIds || [])
        };
        const updated = await clientApi<AuditProject>(`/audit-projects/${newProj.id}`, {
          method: "PATCH",
          body: JSON.stringify(copyPayload)
        });
        if (updated) {
          finalProj = updated;
        }
      }
    } else if (newLeads.length > 0) {
      const updated = await clientApi<AuditProject>(`/audit-projects/${newProj.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          auditorNames: newLeads.join(","),
          auditorIds: newLeads.map(l => users.find(u => u.name === l || u.id === l)?.id || l)
        })
      });
      if (updated) {
        finalProj = updated;
      }
    }

    setProjects([...projects, finalProj]);
    closeNewProjectModal();
    openProjectEditor(finalProj);
    
    // Clear form
    setNewName("");
    setNewCode("");
    setNewStart("");
    setNewEnd("");
    setNewLeads([]);
  };

  // Multiple Auditors selection handlers
  const toggleAuditor = (userId: string) => {
    if (editAuditorIds.includes(userId)) {
      setEditAuditorIds(editAuditorIds.filter(id => id !== userId));
    } else {
      setEditAuditorIds([...editAuditorIds, userId]);
    }
  };

  const removeAuditor = (userId: string) => {
    setEditAuditorIds(editAuditorIds.filter(id => id !== userId));
  };

  // Multiple Department PICs selection handlers
  const togglePic = (userId: string) => {
    if (editDeptPicIds.includes(userId)) {
      setEditDeptPicIds(editDeptPicIds.filter(id => id !== userId));
    } else {
      setEditDeptPicIds([...editDeptPicIds, userId]);
    }
  };

  const removePic = (userId: string) => {
    setEditDeptPicIds(editDeptPicIds.filter(id => id !== userId));
  };

  // Attachments handlers
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Read file data as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const newAttachment = await clientApi<Attachment>("/attachments", {
        method: "POST",
        body: JSON.stringify({
          projectId: selectedProject.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileData: base64Data
        })
      });

      if (newAttachment) {
        const freshAttachments = [...editAttachments, newAttachment];
        setEditAttachments(freshAttachments);
        
        // Update project state locally
        setProjects(projects.map(p => (p.id === selectedProject.id ? { ...p, attachments: freshAttachments } : p)));
      }
    };
    reader.readAsDataURL(file);
    
    // Reset uploader
    e.target.value = "";
  };

  const handleDeleteFile = async (attachmentId: string) => {
    if (!selectedProject) return;
    
    const success = await clientApi<boolean>(`/attachments/${attachmentId}`, { method: "DELETE" });
    if (success) {
      const freshAttachments = editAttachments.filter(a => a.id !== attachmentId);
      setEditAttachments(freshAttachments);
      
      // Update project state locally
      setProjects(projects.map(p => (p.id === selectedProject.id ? { ...p, attachments: freshAttachments } : p)));
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Audit Plan? This action cannot be undone and will delete all related findings, reports, schedules, and attachments.")) {
      return;
    }
    const success = await clientApi<boolean>(`/audit-projects/${id}`, { method: "DELETE" });
    if (success) {
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId("");
      }
    } else {
      showFeedback("Failed to delete the Audit Plan.");
    }
  };

  const handleDownloadFile = (attachment: Attachment) => {
    // Reconstruct file data download using Base64 URI anchor tag
    const link = document.createElement("a");
    link.href = attachment.fileData;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter project logic
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isProjectMember = (proj: AuditProject | null) => {
    if (!proj) return false;
    if (currentUser.role === "ADMIN") return true;
    if (proj.leadAuditorId === currentUser.id) return true;
    const auditorsList = proj.auditorNames ? proj.auditorNames.split(",").map(s => s.trim()) : [];
    if (auditorsList.includes(currentUser.name)) return true;
    if (proj.auditorIds?.includes(currentUser.id)) return true;
    const picList = proj.deptPicIds ? proj.deptPicIds.split(",") : [];
    if (picList.includes(currentUser.id) || picList.includes(currentUser.name)) return true;
    return false;
  };

  const canCreateProject = RBAC.can(currentUser, "audit-projects:create");
  const canUpdateProject = RBAC.can(currentUser, "audit-projects:update");
  const canDeleteProject = RBAC.can(currentUser, "audit-projects:delete");
  const canSubmitProject = RBAC.can(currentUser, "audit-projects:submit");
  const canApproveProject = RBAC.can(currentUser, "audit-projects:approve");
  const canCloseProject = RBAC.can(currentUser, "audit-projects:close");
  const canReopenProject = RBAC.can(currentUser, "audit-projects:reopen");
  const isReadOnly = editStatus !== "PLANNING" || !isProjectMember(selectedProject || null);
  const leadAuditors = users.filter(u => u.role === "LEAD_AUDITOR" || u.role === "ADMIN");

  const statusOptions = [
    { label: "Planning", value: "PLANNING" },
    { label: "Submitted for Approval", value: "SUBMITTED_FOR_APPROVAL" },
    { label: "Released", value: "RELEASED" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Header Action */}
      <div className="space-y-6 no-print">
        {/* Title */}
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Individual OE Plans</h1>
      </div>

      {/* New Project Creator Modal */}
      {isCreating && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          onClick={closeNewProjectModal}
        >
          <div 
            className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col overflow-visible h-fit border border-slate-200 dark:border-slate-855 scoping-modal-container transform scale-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-8 py-5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-roboto text-slate-400 font-bold uppercase tracking-wider">
                  Document 1. Individual OE Plan
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {isCopying ? "Copy Individual OE Plan" : "Create Individual OE Plan"}
                </h2>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeNewProjectModal}
                  className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Form with Word Document table styling */}
            <form onSubmit={handleCreateProject} className="p-8 space-y-6">
              <div className="overflow-visible border border-slate-300 dark:border-slate-800 rounded-md">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {/* Row 1: Project Name */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Project Name*:
                      </td>
                      <td colSpan={3} className="px-4 py-2">
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          // placeholder="e.g. SOX Audit 2026"
                          className="w-full bg-transparent border-none p-0 text-xs focus:outline-none font-bold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                    </tr>

                    {/* Row 2: Project Code */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Project Code:
                      </td>
                      <td colSpan={3} className="px-4 py-2">
                        <input
                          type="text"
                          readOnly
                          value={newCode}
                          placeholder="N/A"
                          className="w-full bg-transparent border-none p-0 text-xs focus:outline-none font-sans font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed select-none"
                        />
                      </td>
                    </tr>

                    {/* Row 3: Start Date + End Date */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Start Date*:
                      </td>
                      <td className="w-1/4 px-4 py-2 border-r border-slate-300 dark:border-slate-800/80">
                        <input
                          type="date"
                          required
                          value={newStart}
                          onChange={(e) => setNewStart(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-xs focus:outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                        />
                      </td>
                      <td className="w-1/4 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        End Date*:
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          required
                          value={newEnd}
                          onChange={(e) => setNewEnd(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-xs focus:outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                        />
                      </td>
                    </tr>

                    {/* Row 4: Lead Auditor */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Lead Auditor:
                      </td>
                      <td colSpan={3} className="px-4 py-2">
                        <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                          <MultiSelect
                            selectedValues={newLeads}
                            onChange={setNewLeads}
                            options={users.map((u) => ({
                              value: u.name,
                              label: u.name,
                              subLabel: `${u.role.replace('_', ' ')}${u.departmentName ? ` • ${u.departmentName}` : ''}`
                            }))}
                            placeholder="Select Lead Auditors..."
                          />
                        </div>
                      </td>
                    </tr>


                    {/* Row 6: Annual Plan Master */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Annual Audit Plan:
                      </td>
                      <td colSpan={3} className="px-4 py-2">
                        <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                          <MultiSelect
                            selectedValues={newAnnualPlanId ? [newAnnualPlanId] : []}
                            onChange={(values) => {
                              const chosenVal = values.length > 0 ? values[0] : "";
                              const match = annualPlans?.find(p => p.id === chosenVal || p.planName === chosenVal);
                              setNewAnnualPlanId(match ? match.id : chosenVal);
                              setNewAuditPlanId(""); // Reset audit plan when annual plan changes
                            }}
                            singleSelect={true}
                            options={annualPlans?.filter(plan => plan.status === "APPROVED").map(plan => ({
                              value: plan.id,
                              label: `${plan.planName} (${plan.period})`
                            })) || []}
                            placeholder="Select Annual OE Plan..."
                          />
                        </div>
                      </td>
                    </tr>

                    {/* Row 7: Audit Plan */}
                    <tr className="border-b border-slate-300 dark:border-slate-800/80">
                      <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        Planned Engagement:
                      </td>
                      <td colSpan={3} className="px-4 py-2">
                        <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                          <MultiSelect
                            selectedValues={newAuditPlanId ? [newAuditPlanId] : []}
                            onChange={(values) => {
                              setNewAuditPlanId(values.length > 0 ? values[0] : "");
                            }}
                            singleSelect={true}
                            disabled={!newAnnualPlanId}
                            options={(() => {
                              const filtered = auditPlans?.filter(ap => ap.annualPlanId === newAnnualPlanId) || [];
                              if (newAuditPlanId && !filtered.some(ap => ap.id === newAuditPlanId)) {
                                const target = auditPlans?.find(ap => ap.id === newAuditPlanId);
                                if (target) filtered.push(target);
                              }
                              return filtered.map(ap => ({
                                value: ap.id,
                                label: `${ap.topic} - ${ap.version || "V1"}${ap.isApproved ? "" : " (Draft)"}`
                              }));
                            })()}
                            placeholder={newAnnualPlanId ? "Select Planned Engagement..." : "Please select an Annual Audit Plan first..."}
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeNewProjectModal}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded cursor-pointer text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> {isCopying ? "Create Copy" : "Create Individual Audit Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main projects grid layout */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        
        {/* ActionToolbar */}
        <ActionToolbar
          onCreate={canCreateProject ? openNewProjectModal : undefined}
          onEdit={canUpdateProject && selectedProjectId && projects.find(p => p.id === selectedProjectId) ? () => {
            const proj = projects.find(p => p.id === selectedProjectId);
            if (proj) openProjectEditor(proj);
          } : undefined}
          onCopy={canCreateProject && selectedProjectId && projects.find(p => p.id === selectedProjectId) ? () => {
            const proj = projects.find(p => p.id === selectedProjectId);
            if (proj) openCopyProjectModal(proj);
          } : undefined}
          onDelete={canDeleteProject && selectedProjectId && projects.find(p => p.id === selectedProjectId) ? () => {
            handleDeleteProject(selectedProjectId);
          } : undefined}
          onRefresh={() => {
            setSearchQuery("");
            setStatusFilter("ALL");
            setSelectedProjectId("");
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder="Search projects..."
          filterLabel="Status"
          filterValue={statusFilter}
          setFilterValue={setStatusFilter}
          filterOptions={statusOptions}
          activeFilterCountLabel={statusFilter === "ALL" ? "ALL" : "FILTERED"}
        />

        {/* Table of projects */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Lead Auditor</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">End Date</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredProjects.map((proj) => (
                  <tr 
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id === selectedProjectId ? "" : proj.id)}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                      proj.id === selectedProjectId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-sans text-slate-800 dark:text-slate-200">
                      {proj.code}
                    </td>
                    <td 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectId(proj.id);
                        openProjectEditor(proj);
                      }}
                      className="px-6 py-4 text-[#0066cc] font-medium hover:underline cursor-pointer"
                    >
                      {proj.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {users.find(u => u.id === proj.leadAuditorId || u.name === proj.leadAuditorId)?.name || proj.leadAuditorId || "Unassigned"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {proj.startDate}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {proj.endDate}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                        {proj.status === "RELEASED" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            Released
                          </>
                        ) : proj.status === "CLOSED" ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                            Closed
                          </>
                        ) : proj.status === "SUBMITTED_FOR_APPROVAL" ? (
                          <>
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            Submitted
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Planning
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

      </div>
      </div>

      {/* Screen-matching Modal Editor Overlay */}
      {isPopupOpen && selectedProject && (
        <div id="scoping-modal-root" className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center z-50 overflow-y-auto p-4 md:p-8 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-6xl rounded-lg shadow-2xl flex flex-col overflow-hidden h-fit border border-slate-200 dark:border-slate-800 scoping-modal-container">
            
            {/* Modal Header Breadcrumb & Actions */}
            <div className="px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[15px] font-roboto text-400 font-bold">
                  <span>Individual OE Plan</span>
                  <span>&gt;</span>
                  <span className="text-slate-600 font-roboto dark:text-slate-300">{selectedProject.code}</span>
                </div>
                <input
                  type="text"
                  disabled={editStatus !== "PLANNING"}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`text-lg md:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent focus:outline-none w-full pb-0.5 ${editStatus === "PLANNING" ? "hover:border-slate-300 focus:border-[#05375c]" : "cursor-not-allowed"}`}
                />
                
                {/* Meta details row under header */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] font-sans text-slate-400">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300">
                    {editStatus === "RELEASED" && <CheckCircle2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
                    {editStatus === "CLOSED" && <CheckCircle className="w-3 h-3 text-slate-500" />}
                    {editStatus === "SUBMITTED_FOR_APPROVAL" && <FileText className="w-3 h-3 text-slate-500" />}
                    {(!editStatus || editStatus === "PLANNING") && <Clock className="w-3 h-3 text-slate-400" />}
                    {editStatus === "CLOSED" ? "Closed" : editStatus === "PLANNING" ? "Planning" : editStatus === "SUBMITTED_FOR_APPROVAL" ? "Submitted for Approval" : editStatus === "RELEASED" ? "Released" : editStatus}
                  </span>
                  <span className="flex items-center gap-1 font-roboto">
                    <CalendarDays className="w-3.5 h-3.5 font-roboto" /> Created {selectedProject.startDate}
                  </span>
                  <span className="flex items-center gap-1 font-roboto">
                    <UserIcon className="w-3.5 h-3.5" /> Assigned to {users.find(u => u.id === editLead || u.name === editLead)?.name || "Unassigned"}
                  </span>
                  <span className="flex items-center gap-1 font-roboto">
                    <Activity className="w-3.5 h-3.5" /> Owner: Sarah Jenkins
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> End Date: {editEnd}
                  </span>
                </div>
              </div>

              {/* Save feedback indicator removed */}

              {/* Action buttons (Header Right) */}
              <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProject) {
                      openCopyProjectModal(selectedProject);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 border border-[#0066cc] text-[#0066cc] hover:bg-[#0066cc]/10 text-xs font-bold rounded transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Plan
                </button>

                {editStatus === "PLANNING" && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveOnly}
                      className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold rounded transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Plan
                    </button>
                    {canSubmitProject && (
                      <button
                        type="button"
                        onClick={handleSubmitForApproval}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit for Approval
                      </button>
                    )}
                  </>
                )}

                {editStatus === "SUBMITTED_FOR_APPROVAL" && (
                  <>
                    {canApproveProject && (
                      <button
                        type="button"
                        onClick={handleReopenPlan}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold rounded transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reopen Plan
                      </button>
                    )}
                    {canApproveProject ? (
                      <>
                        <button
                          type="button"
                          onClick={handleApprovePlan}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:opacity-90 text-xs font-bold rounded transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve Plan
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectPlan}
                          className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold rounded transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject Plan
                        </button>
                      </>
                    ) : (
                      !canApproveProject && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Waiting for Approval (Locked)
                        </span>
                      )
                    )}
                  </>
                )}

                {editStatus === "RELEASED" && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" /> Approved & Released (Locked)
                    </span>
                    {canCloseProject && (
                      <button
                        type="button"
                        onClick={handleClosePlan}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                        title="Close this Audit Plan once and for all"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-300" /> Close Plan
                      </button>
                    )}
                  </>
                )}

                {editStatus === "CLOSED" && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                      <CheckCircle className="w-3.5 h-3.5 text-slate-500" /> Closed & Archived (Locked)
                    </span>
                    {canReopenProject && (
                      <button
                        type="button"
                        onClick={handleReopenClosedPlan}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold rounded transition-colors cursor-pointer"
                        title="Reopen this Closed Audit Plan"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Reopen Plan
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="p-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded cursor-pointer"
                  title="Close Screen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body Container Grid matching screen.png layout */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[72vh] bg-slate-50 dark:bg-slate-950">

              {/* Quick Summary Panel at the Top */}
              <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-roboto font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Audit Plan Members & Verification
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    Last edited by You 2 hours ago
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Column 1: Audit Plan Link Section */}
                  <div className="flex flex-col space-y-4 select-none border-b lg:border-b-0 lg:border-r border-slate-150 dark:border-slate-800 pb-4 lg:pb-0 lg:pr-6 no-print">
                    <div>
                      <label className="text-xs font-sans font-bold uppercase text-slate-500 block mb-2">Annual Audit Plan</label>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                        <MultiSelect
                          selectedValues={editAnnualPlanId ? [editAnnualPlanId] : []}
                          onChange={(values) => {
                            const chosenVal = values.length > 0 ? values[0] : "";
                            const match = annualPlans?.find(p => p.id === chosenVal || p.planName === chosenVal);
                            setEditAnnualPlanId(match ? match.id : chosenVal);
                            setEditAuditPlanId(""); // Reset audit plan when annual plan changes
                          }}
                          singleSelect={true}
                          disabled={isReadOnly}
                          options={(() => {
                            const filtered = annualPlans?.filter(plan => plan.status === "APPROVED") || [];
                            if (editAnnualPlanId && !filtered.some(plan => plan.id === editAnnualPlanId)) {
                              const target = annualPlans?.find(plan => plan.id === editAnnualPlanId);
                              if (target) filtered.push(target);
                            }
                            return filtered.map(plan => ({
                              value: plan.id,
                              label: `${plan.planName} (${plan.period})`
                            }));
                          })()}
                          placeholder="Select Annual OE Plan..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-sans font-bold uppercase text-slate-500 block mb-2">Planned Engagement</label>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                        <MultiSelect
                          selectedValues={editAuditPlanId ? [editAuditPlanId] : []}
                          onChange={(values) => {
                            setEditAuditPlanId(values.length > 0 ? values[0] : "");
                          }}
                          singleSelect={true}
                          disabled={isReadOnly || !editAnnualPlanId}
                          options={(() => {
                            const filtered = auditPlans?.filter(ap => ap.annualPlanId === editAnnualPlanId) || [];
                            if (editAuditPlanId && !filtered.some(ap => ap.id === editAuditPlanId)) {
                              const target = auditPlans?.find(ap => ap.id === editAuditPlanId);
                              if (target) filtered.push(target);
                            }
                            return filtered.map(ap => ({
                              value: ap.id,
                              label: `${ap.topic} - ${ap.version || "V1"}${ap.isApproved ? "" : " (Draft)"}`
                            }));
                          })()}
                          placeholder={editAnnualPlanId ? "Select Planned Engagement..." : "Please select an Annual Audit Plan first..."}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Column 2: Lead & Auditors & Departments */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans font-bold uppercase text-slate-500">Lead Auditor</label>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                        <MultiSelect
                          selectedValues={editLead ? editLead.split(",").map(s => {
                            const clean = s.trim();
                            const matched = users.find(u => u.name === clean || u.id === clean);
                            return matched ? matched.name : clean;
                          }).filter(Boolean) : []}
                          onChange={(values) => setEditLead(values.join(", "))}
                          disabled={isReadOnly}
                          options={users
                            .map(u => ({
                              value: u.name,
                              label: u.name,
                              subLabel: `${u.role.replace("_", " ")}${u.email ? ` - ${u.email}` : ""}`
                            }))}
                          placeholder="Select Lead Auditors..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-xs font-sans font-bold uppercase text-slate-500">Auditors</label>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                        <MultiSelect
                          selectedValues={editAuditorIds.map(s => {
                            const matched = users.find(u => u.id === s || u.name === s);
                            return matched ? matched.name : s;
                          })}
                          onChange={(values) => setEditAuditorIds(values)}
                          disabled={isReadOnly}
                          options={users
                            .filter(u => u.role === "ADMIN" || u.role === "LEAD_AUDITOR" || u.role === "AUDITOR")
                            .map(u => ({
                              value: u.name,
                              label: u.name,
                              subLabel: `${u.role.replace("_", " ")}${u.email ? ` - ${u.email}` : ""}`
                            }))}
                          placeholder="Select Auditors..."
                        />
                      </div>
                    </div>


                    <div className="flex flex-col space-y-1.5 select-none">
                      <label className="text-xs font-sans font-bold uppercase text-slate-500">Department</label>
                      <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                        <MultiSelect
                          selectedValues={editDepartments}
                          onChange={(values) => setEditDepartments(values)}
                          singleSelect={true}
                          disabled={isReadOnly}
                          options={departments.map((d) => ({
                            value: d.name,
                            label: d.name,
                          }))}
                          placeholder="Select Department..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Finding Reports Section */}
                {selectedProject && (() => {
                  const dbFindings = selectedProject.findings || [];
                  const scheduleFindings = selectedProject.executionSchedules?.filter(e => e.language === "finding") || [];
                  if (dbFindings.length === 0 && scheduleFindings.length === 0) return null;
                  
                  return (
                    <div className="pt-4 border-t border-slate-150 dark:border-slate-800 space-y-2.5">
                      <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-850 dark:text-slate-205">
                        Audit Findings vs Resolve Report 
                      </h4>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-sans font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="px-3.5 py-2.5">Audit Findings Name</th>
                              <th className="px-3 py-2.5 text-center text-amber-600 dark:text-amber-400">Pending</th>
                              <th className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400">Corrective</th>
                              <th className="px-3 py-2.5 text-center text-slate-500">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                            {dbFindings.map(f => {
                              const isCompleted = f.status === "CLOSED";
                              return (
                                <tr key={f.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                                  <td className="px-3.5 py-2">
                                    <a 
                                      href={`/findings?id=${f.id}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-[#0066cc] hover:underline font-bold"
                                    >
                                      {f.title}
                                    </a>
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-amber-600 dark:text-amber-400">
                                    {isCompleted ? 0 : 1}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                    {isCompleted ? 1 : 0}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">
                                    1
                                  </td>
                                </tr>
                              );
                            })}
                            {scheduleFindings.map(sf => {
                              let rows: ScheduleRow[] = [];
                              try {
                                if (sf.scheduleRows) rows = JSON.parse(sf.scheduleRows);
                              } catch {}
                              const total = rows.length;
                              const completed = rows.filter(r => !!r.correctiveFinalUser).length;
                              const pending = total - completed;

                              return (
                                <tr key={sf.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                                  <td className="px-3.5 py-2">
                                    <a 
                                      href={`/findings?id=${sf.id}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-[#0066cc] hover:underline font-bold"
                                    >
                                      FD-{sf.visitNumber} ({sf.departments})
                                    </a>
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-amber-600 dark:text-amber-400">
                                    {pending}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                    {completed}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">
                                    {total}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Linked Items Section */}
                {selectedProject && (
                  <div className="pt-4 border-t border-slate-150 dark:border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-850 dark:text-slate-205">
                      Linked Items
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-sans">
                      {/* Meetings */}
                      {(() => {
                        const meetings = selectedProject.openMeetings?.filter(m => !m.isDeleted) || [];
                        if (meetings.length === 0) return null;
                        return meetings.map(m => {
                          const ap = selectedProject.auditPlanId ? auditPlans?.find(a => a.id === selectedProject.auditPlanId) : null;
                          const deptDisplay = ap ? `${m.departments} - ${ap.version || "V1"}` : m.departments;
                          return (
                            <div key={m.id} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shrink-0" />
                              <span>Open Meetings: </span>
                              <a 
                                href={`/meetings?id=${m.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[#0066cc] hover:underline font-bold"
                              >
                                OM-{m.visitNumber} ({deptDisplay})
                              </a>
                            </div>
                          );
                        });
                      })()}

                      {/* Schedules */}
                      {(() => {
                        const schedules = selectedProject.executionSchedules?.filter(e => e.language !== "meeting" && e.language !== "finding") || [];
                        if (schedules.length === 0) return null;
                        return schedules.map(s => {
                          let rows: ScheduleRow[] = [];
                          try {
                            if (s.scheduleRows) rows = JSON.parse(s.scheduleRows);
                          } catch {}
                          
                          // Determine which indices of this schedule are linked to finding rows
                          const linkedRowIndices = new Set<number>();
                          const findingReports = selectedProject.executionSchedules?.filter(
                            fr => fr.language === "finding" && fr.departments === s.departments
                          ) || [];
                          
                          findingReports.forEach(fr => {
                            try {
                              if (fr.scheduleRows) {
                                const parsedRows = JSON.parse(fr.scheduleRows);
                                parsedRows.forEach((frRow: any) => {
                                  if (frRow.linkedRowIndex !== undefined && frRow.linkedRowIndex !== -1) {
                                    linkedRowIndices.add(frRow.linkedRowIndex);
                                  }
                                });
                              }
                            } catch {}
                          });

                          const total = rows.length;
                          const linkedCount = rows.filter((_, idx) => linkedRowIndices.has(idx)).length;
                          const notLinkedCount = total - linkedCount;

                          const isFullyCompleted = findingReports.length > 0 && notLinkedCount === 0 && total > 0;
                          const scheduleStatus = isFullyCompleted ? "Completed" : "Pending";

                          return (
                            <div key={s.id} className="flex flex-wrap items-center gap-1.5 py-0.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                              <span>Execution schedule: </span>
                              <a 
                                href={`/schedule?id=${s.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[#0066cc] hover:underline font-bold"
                              >
                                SCH-{s.visitNumber} ({s.departments})
                              </a>
                              {/*
                              <span className={`inline-flex items-center text-[10px] font-sans font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                scheduleStatus === "Completed"
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              }`}>
                                {scheduleStatus}
                              </span>
                              <span className="ml-1 inline-flex items-center gap-1.5 text-[10px] font-sans font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Schedule Not Used: {notLinkedCount}</span>
                                <span>•</span>
                                <span className="text-sky-600 dark:text-sky-400 font-bold">Schedule Used: {linkedCount}</span>
                                <span>•</span>
                                <span className="text-slate-500">Total Schedule: {total}</span>
                              </span>
                              */}
                            </div>
                          );
                        });
                      })()}

                      {/* Findings */}
                      {(() => {
                        const findingReports = selectedProject.executionSchedules?.filter(e => e.language === "finding") || [];
                        if (findingReports.length === 0) return null;
                        return findingReports.map(fr => {
                          let rows: any[] = [];
                          try {
                            if (fr.scheduleRows) rows = JSON.parse(fr.scheduleRows);
                          } catch {}
                          
                          return (
                            <div key={fr.id} className="space-y-1.5 py-1 pl-3 border-l-2 border-amber-500/30">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                                <span>Finding Report: </span>
                                <a 
                                  href={`/findings?id=${fr.id}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[#0066cc] hover:underline font-bold"
                                >
                                  NCN-{fr.visitNumber} ({fr.departments})
                                </a>
                              </div>
                              {rows.length > 0 && (
                                <div className="pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  {rows.map((row, idx) => {
                                    const isCompleted = !!row.correctiveFinalUser;
                                    const isInProgress = !isCompleted && row.correctiveFinalDate && row.correctiveFinalDate.trim() !== "";
                                    const cleanText = row.activity ? row.activity.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : "";
                                    const snippet = cleanText.length > 60 ? cleanText.substring(0, 60) + "..." : cleanText;
                                    
                                    return (
                                      <div key={idx} className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                                          Line #{idx + 1}:
                                        </span>
                                        <span className="italic truncate max-w-[200px]" title={cleanText}>
                                          "{snippet || "No details"}"
                                        </span>
                                        <span className={`inline-flex items-center text-[9px] font-sans font-bold px-1.5 py-0.2 rounded border uppercase shrink-0 ${
                                          isCompleted
                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                            : isInProgress
                                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                        }`}>
                                          {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Pending"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* Fallback if nothing is linked */}
                      {(!selectedProject.openMeetings?.filter(m => !m.isDeleted).length && !selectedProject.executionSchedules?.filter(e => e.language !== "meeting" && e.language !== "finding").length && !selectedProject.executionSchedules?.filter(e => e.language === "finding").length && !selectedProject.findings?.length) && (
                        <div className="text-slate-400 italic text-[11px] font-sans">
                          No linked meetings, schedules, or findings for this Audit Plan.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel 1: Objectives & Scope (Full Width) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6 shadow-sm">
                <h3 className="text-md font-roboto font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-150 dark:border-slate-800 pb-2">
                  I. Objectives & Scope
                </h3>

                <PlanItemEditor
                  sectionTitle="1.1 Objectives"
                  items={editObjectivesItems}
                  onChange={setEditObjectivesItems}
                  prefix="AP-OBJ"
                  editable={!isReadOnly}
                  placeholder="Enter objective item description..."
                  addBtnText="Add Objective"
                />

                <div className="border-t border-slate-150 dark:border-slate-800 pt-4">
                  <PlanItemEditor
                    sectionTitle="1.2 Audit Scope"
                    items={editScopeItems}
                    onChange={setEditScopeItems}
                    prefix="AP-ISCP"
                    editable={!isReadOnly}
                    placeholder="Enter audit scope item description..."
                    addBtnText="Add Scope Item"
                  />
                </div>
              </div>

              {/* Panel 2: Risk Mapping & Classification */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-2">
                  <h3 className="text-[20px] text-xs font-sans font-bold uppercase tracking-wider text-slate-1000 border-b border-slate-150 dark:border-slate-800 pb-2">
                    II. Map risk to department in charge
                  </h3>
                  {/* <button 
                    type="button"
                    onClick={() => showFeedback("Standard mapping framework imported successfully.")}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-[10px] font-bold rounded text-slate-600 dark:text-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  >
                    <Import className="w-3.5 h-3.5" /> Import Framework
                  </button> */}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-sans font-bold text-slate-800 uppercase">Risk meets company process</label>
                    <RichEditor value={editRiskProcess} onChange={setEditRiskProcess} editable={!isReadOnly} />
                  </div>
                  <div className="space-y-1.5">
                    <label className=" text-[15px] font-sans font-bold text-slate-800 uppercase">Classify risk base on potential impact</label>
                    <RichEditor value={editRiskClass} onChange={setEditRiskClass} editable={!isReadOnly} />
                  </div>
                </div>
              </div>

              {/* Panel 3: Operational Excellence */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
                <h3 className="text-[20px] text-xs font-sans font-bold uppercase tracking-wider text-slate-1000 border-b border-slate-150 dark:border-slate-800 pb-2">
                  III. Operational excellence technique/approach
                </h3>
                
                <div className="space-y-1.5">
                  <label className="text-[15px] font-sans font-bold text-slate-800 uppercase">Obtain data error to fieldwork mapping</label>
                  <RichEditor value={editOpEx} onChange={setEditOpEx} editable={!isReadOnly} />
                </div>

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-[20px] text-xs font-sans font-bold uppercase tracking-wider text-slate-1000 border-b border-slate-150 dark:border-slate-800 pb-2">IV. Obtain data error to fieldwork parameters</h4>
                  <div className="space-y-6">
                    <PlanItemEditor
                      sectionTitle="Type of data to request for information"
                      items={editDataRequestItems}
                      onChange={setEditDataRequestItems}
                      prefix="AP-DRQ"
                      editable={!isReadOnly}
                      placeholder="Enter data request item..."
                      addBtnText="Add Data Request Item"
                    />
                    <div className="border-t border-slate-150 dark:border-slate-800 pt-4">
                      <PlanItemEditor
                        sectionTitle="Which part need to focus on"
                        items={editFocusAreaItems}
                        onChange={setEditFocusAreaItems}
                        prefix="AP-FCA"
                        editable={!isReadOnly}
                        placeholder="Enter focus area item..."
                        addBtnText="Add Focus Area Item"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Panel 5: Operational Excellence Timeline */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6">
                <h3 className="text-[20px] text-xs font-sans font-bold uppercase tracking-wider text-slate-1000 border-b border-slate-150 dark:border-slate-800 pb-2">
                  V. Operational Excellence timeline
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Interactive Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Planning Presentation Date</label>
                      <input 
                        type="date" 
                        value={editTimelinePresDate}
                        disabled={isReadOnly}
                        onChange={(e) => setEditTimelinePresDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Notification to Department in charge</label>
                      <input 
                        type="date" 
                        value={editTimelineNotificationDate}
                        disabled={isReadOnly}
                        onChange={(e) => setEditTimelineNotificationDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Field Work Start</label>
                        <input 
                          type="date" 
                          value={editTimelineFieldWorkStart}
                          disabled={isReadOnly}
                          onChange={(e) => setEditTimelineFieldWorkStart(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Field Work End</label>
                        <input 
                          type="date" 
                          value={editTimelineFieldWorkEnd}
                          disabled={isReadOnly}
                          onChange={(e) => setEditTimelineFieldWorkEnd(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Finding/Observation Offset (Days)</label>
                        <input 
                          type="number" 
                          value={editTimelineFindingReportOffset}
                          disabled={isReadOnly}
                          onChange={(e) => setEditTimelineFindingReportOffset(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 uppercase">Final Report Offset (Days)</label>
                        <input 
                          type="number" 
                          value={editTimelineFinalReportOffset}
                          disabled={isReadOnly}
                          onChange={(e) => setEditTimelineFinalReportOffset(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual Timeline Stepper */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-5 border border-slate-100 dark:border-slate-900 space-y-4">
                    <h4 className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-400">Timeline Milestone Preview</h4>
                    
                    <div className="relative pl-6 border-l-2 border-blue-500/30 dark:border-blue-900/40 space-y-6">
                      {/* Milestone 1 */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Planning Presentation Date</div>
                        <div className="text-[11px] font-sans text-slate-500">{formatDateString(editTimelinePresDate)}</div>
                      </div>

                      {/* Milestone 2 */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Notification to Department in charge</div>
                        <div className="text-[11px] font-sans text-slate-500">{formatDateString(editTimelineNotificationDate)}</div>
                      </div>

                      {/* Milestone 3 */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Field Work Duration</div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {editTimelineFieldWorkStart || editTimelineFieldWorkEnd ? (
                            `${formatDateString(editTimelineFieldWorkStart)} to ${formatDateString(editTimelineFieldWorkEnd)}`
                          ) : (
                            "TBD"
                          )}
                        </div>
                      </div>

                      {/* Milestone 4 */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Finding/Observation Report Submission</div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {formatDateString(getCalculatedDate(editTimelineFieldWorkEnd, editTimelineFindingReportOffset) || "")}
                          <span className="text-[10px] text-slate-400 ml-1.5">({editTimelineFindingReportOffset} days after fieldwork)</span>
                        </div>
                      </div>

                      {/* Milestone 5 */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-blue-500 bg-white dark:bg-slate-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Final Report to Top Management</div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {formatDateString(
                            getCalculatedDate(
                              getCalculatedDate(editTimelineFieldWorkEnd, editTimelineFindingReportOffset) || "", 
                              editTimelineFinalReportOffset
                            ) || ""
                          )}
                          <span className="text-[10px] text-slate-400 ml-1.5">({editTimelineFinalReportOffset} days after finding report)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Panel 4: Fieldwork Strategy & Expected Outcomes */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
                <h3 className="text-[20px] text-xs font-sans font-bold uppercase tracking-wider text-slate-1000 border-b border-slate-150 dark:border-slate-800 pb-2">
                  VI.Expected Outcomes
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-sans font-bold text-slate-800 uppercase">Expected Outcomes</label>
                    <RichEditor value={editFieldwork} onChange={setEditFieldwork} editable={!isReadOnly} />
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-sans font-bold uppercase tracking-wider text-slate-400">
                    <FileText className="w-4 h-4" /> Plan Attachments & Files
                  </h3>
                  {!isReadOnly && RBAC.can(currentUser, "attachments:create") && (
                    <div>
                      <input
                        type="file"
                        id="plan-file-input"
                        className="hidden"
                        onChange={handleUploadFile}
                      />
                      <label
                        htmlFor="plan-file-input"
                        className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 dark:border-slate-850 text-[10px] font-bold rounded text-slate-600 dark:text-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Attach File
                      </label>
                    </div>
                  )}
                </div>

                {/* Attachment List */}
                <div className="space-y-2">
                  {editAttachments.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-2 italic text-center">
                      No documents attached to this plan yet. Use the button above to upload files.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {editAttachments.map((file) => (
                        <div 
                          key={file.id} 
                          className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-md"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <FileText className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                            <div className="truncate text-left">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={file.fileName}>
                                {file.fileName}
                              </div>
                              <div className="text-[9px] font-sans text-slate-400">
                                {(file.fileSize / 1024).toFixed(1)} KB | {file.fileType.split("/")[1] || "doc"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-4">
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(file)}
                              className="p-1 text-slate-500 hover:text-[#0066cc] cursor-pointer"
                              title="Download Attachment"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {!isReadOnly && RBAC.can(currentUser, "attachments:delete") && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file.id)}
                                className="p-1 text-slate-500 hover:text-red-500 cursor-pointer"
                                title="Remove Attachment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Page Footer */}
            <div className="px-8 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-sans text-slate-400 shrink-0">
              <div>
                <span>Audit ID: {selectedProject.code}-INTERNAL</span>
                <span className="mx-2">|</span>
                <span>Last Synced: Just now</span>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleCloseEditor}
                  className="hover:text-red-500 transition-colors font-semibold cursor-pointer"
                >
                  Discard Draft
                </button>
                <button 
                  onClick={() => showFeedback("Scoping revision history fetched.")}
                  className="hover:text-slate-700 dark:hover:text-slate-250 transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  <History className="w-3 h-3" /> Audit History
                </button>
                <button 
                  onClick={() => showFeedback("Redirecting to Compliance Policy Catalog.")}
                  className="hover:text-slate-700 dark:hover:text-slate-250 transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  Policy Link <ArrowUpRight className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Enlarged QR Code Modal */}
      {isQrModalOpen && selectedProject && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in no-print"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div 
            className="relative bg-[#0b1326] border-[3px] border-slate-700/60 rounded-[28px] shadow-2xl max-w-[360px] w-full overflow-hidden animate-in zoom-in-95 duration-200 font-roboto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative pt-6 pb-4 px-6 text-center space-y-2">
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors z-10"
                title="Close QR modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Audit Plan Title */}
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-[0.25em] font-roboto">
                Audit Plan
              </h3>

              {/* Project Code Badge */}
              <div className="inline-block px-5 py-1.5 rounded-lg bg-[#070c18]/90 border border-[#c79646]/30 shadow-inner">
                <span className="text-xl font-bold tracking-wider text-[#d9a84e] font-mono">
                  {selectedProject.code}
                </span>
              </div>
            </div>

            {/* Wavy Curve Transition with Gold Border */}
            <div className="relative w-full overflow-hidden leading-none pointer-events-none -mt-1">
              <svg className="relative block w-full h-8" viewBox="0 0 500 60" preserveAspectRatio="none">
                <path d="M0,40 C150,65 350,15 500,40 L500,60 L0,60 Z" fill="#ffffff" />
                <path d="M0,40 C150,65 350,15 500,40" fill="none" stroke="#c79646" strokeWidth="3" />
              </svg>
            </div>

            {/* Modal Body */}
            <div className="bg-white px-6 pb-6 pt-1 text-center flex flex-col items-center space-y-4">
              {/* QR Code Frame */}
              <div className="relative p-3 bg-white border-2 border-[#d9a24a]/70 rounded-3xl shadow-sm inline-block">
                {scanQrDataUrl ? (
                  <img 
                    src={scanQrDataUrl} 
                    alt="Audit Plan QR Code" 
                    className="w-[220px] h-[220px] object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-sm">
                    Generating QR...
                  </div>
                )}
                {/* Center Hanuman Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 bg-white rounded-xl p-1 shadow-md border border-slate-100 flex items-center justify-center">
                    <img 
                      src="/hanuman-logo.png" 
                      alt="Hanuman Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks Text */}
              <p className="text-[11.5px] text-slate-500 font-roboto font-normal leading-tight px-1">
                Scan to access your department Open Meetings.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/planning?id=${selectedProject.id}`;
                    navigator.clipboard.writeText(link);
                    setCopiedQrLink(true);
                    setTimeout(() => setCopiedQrLink(false), 2000);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-sm ${
                    copiedQrLink
                      ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  {copiedQrLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Link className="w-4 h-4 text-slate-500" />}
                  {copiedQrLink ? "Copied!" : "Copy Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!planningQrDataUrl) return;
                    const a = document.createElement("a");
                    a.href = planningQrDataUrl;
                    a.download = `QR-${selectedProject.code}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#d9a24a] to-[#c58e37] hover:from-[#cb953d] hover:to-[#b6802c] text-white transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4 text-white" />
                  Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
