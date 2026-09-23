"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CalendarDays, 
  X,
  Trash2,
  Save,
  Plus,
  Clock,
  Activity,
  Edit2,
  QrCode,
  CheckCircle,
  CheckCircle2,
  Circle,
  FileText,
  XCircle,
  Send,
  Layers,
  ChevronRight
} from "lucide-react";
import type { User, AnnualPlan, Project, Department, BusinessUnit, PlanItem } from "@oeportal/shared";
import { parsePlanItems, serializePlanItems, validateDateRange } from "@oeportal/shared";
import QRCodeModal from "@/components/ui/qr-code-modal";
import QRCode from "qrcode";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import MultiSelect from "@/components/ui/multi-select";
import PlanItemEditor from "@/components/ui/plan-item-editor";

interface AnnualPlansClientProps {
  initialAnnualPlans: AnnualPlan[];
  initialUsers?: User[];
  departments: Department[];
  businessUnits: BusinessUnit[];
  currentUser: User;
}

export default function AnnualPlansClient({
  initialAnnualPlans,
  initialUsers = [],
  departments,
  businessUnits,
  currentUser
}: AnnualPlansClientProps) {
  const [annualPlans, setAnnualPlans] = useState<AnnualPlan[]>(initialAnnualPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  
  // Form fields
  const [planNameInput, setPlanNameInput] = useState("");
  const [periodInput, setPeriodInput] = useState<string[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [statusInput, setStatusInput] = useState("DRAFT");

  // QR Modal States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ qrToken: string; planName: string; period: string }>({ qrToken: "", planName: "", period: "" });
  const [miniQrDataUrl, setMiniQrDataUrl] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  // setState re-renders are batched/async, so a fast double-click can fire the handler
  // twice before isSavingPlan reflects true - this ref guards re-entrancy synchronously.
  const isSavingPlanRef = useRef(false);

  // Child Plan (OE Plan) states
  const [plannedEngagements, setPlannedEngagements] = useState<any[]>([]);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [childModalMode, setChildModalMode] = useState<"create" | "edit">("create");
  const [selectedPlannedEngagementId, setSelectedPlannedEngagementId] = useState<string | null>(null);
  const [approvedTopicCounts, setApprovedTopicCounts] = useState<Record<string, number>>({});

  // Child Plan fields
  const [apProjectName, setApProjectName] = useState("");
  const [apBuId, setApBuId] = useState(""); // Business Unit picked first ...
  const [apDepartmentId, setApDepartmentId] = useState(""); // ... then one of its departments
  const [apType, setApType] = useState("OE");
  const [apVersion, setApVersion] = useState("V1");
  const [apRevieweeIds, setApRevieweeIds] = useState<string[]>([]);
  const [apConductDate, setApConductDate] = useState("");
  const [apEndDate, setApEndDate] = useState("");
  const [apPurpose, setApPurpose] = useState("");
  const [apObjectivesItems, setApObjectivesItems] = useState<PlanItem[]>([]);
  const [apScopeItems, setApScopeItems] = useState<PlanItem[]>([]);

  const canCreatePlan = RBAC.can(currentUser, "annual-plans:create");
  const canUpdatePlan = RBAC.can(currentUser, "annual-plans:update");
  const canDeletePlan = RBAC.can(currentUser, "annual-plans:delete");
  const canSubmitPlan = RBAC.can(currentUser, "annual-plans:submit");
  const canApprovePlan = RBAC.can(currentUser, "annual-plans:approve");
  const canCreateChildPlan = RBAC.can(currentUser, "projects:create");
  const canUpdateChildPlan = RBAC.can(currentUser, "projects:update");
  const canDeleteChildPlan = RBAC.can(currentUser, "projects:delete");
  // Whether the child Project modal's fields may be edited right now - locked once the parent
  // Annual Plan is approved (existing rule), and also now by whether the viewer actually holds
  // the permission for the mode they're in, so a projects:view-only caller sees a real
  // read-only "View Project" instead of fields that look editable but 403 on save.
  const childCanEdit =
    statusInput !== "APPROVED" &&
    (childModalMode === "create" ? canCreateChildPlan : canUpdateChildPlan);

  const loadApprovedTopicCounts = () => {
    clientApi<Record<string, number>>("/annual-plans/approved-topic-counts").then(setApprovedTopicCounts).catch(console.error);
  };

  useEffect(() => {
    loadApprovedTopicCounts();
  }, [annualPlans]);

  useEffect(() => {
    if (selectedPlanId && modalMode === "edit") {
      clientApi<Project[]>(`/projects/by-annual-plan/${selectedPlanId}`).then(setPlannedEngagements).catch(console.error);
      const plan = annualPlans.find(p => p.id === selectedPlanId);
      if (plan?.qrToken) {
        const url = `${window.location.origin}/scan/${plan.qrToken}`;
        QRCode.toDataURL(url, { width: 100, margin: 1, color: { dark: '#334155', light: '#ffffff00' } })
          .then(setMiniQrDataUrl)
          .catch(console.error);
      }
    } else {
      setMiniQrDataUrl("");
    }
  }, [selectedPlanId, modalMode, annualPlans]);

  const openCreateModal = () => {
    setModalMode("create");
    setPlanNameInput("");
    setPeriodInput([]);
    setCommentInput("");
    setStatusInput("DRAFT");
    setSelectedPlanId(null);
    setPlannedEngagements([]);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: AnnualPlan) => {
    setSelectedPlanId(plan.id);
    setModalMode("edit");
    setPlanNameInput(plan.planName);
    setPeriodInput(plan.period ? [plan.period] : []);
    setCommentInput(plan.comment);
    setStatusInput(plan.status || "DRAFT");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveAnnualPlan = async () => {
    if (isSavingPlanRef.current) return;
    const pInput = periodInput[0] || "";
    if (!planNameInput.trim() || !pInput) {
      showFeedback("Error: Plan Name and Period are required.");
      return;
    }

    isSavingPlanRef.current = true;
    setIsSavingPlan(true);
    try {
      if (modalMode === "create") {
        const newPlan = await clientApi<AnnualPlan>("/annual-plans", {
          method: "POST",
          body: JSON.stringify({
            planName: planNameInput.trim(),
            period: pInput,
            comment: commentInput.trim(),
          }),
        });
        if (newPlan) {
          // If child plans were added during creation, create them under the new annual plan
          if (plannedEngagements.length > 0) {
            const plansToPersist = [...plannedEngagements].sort((a, b) =>
              (a.no || "").localeCompare(b.no || "", undefined, { numeric: true, sensitivity: "base" })
            );
            for (let i = 0; i < plansToPersist.length; i++) {
              const ap = plansToPersist[i];
              const no = `PRJ-${String(i + 1).padStart(3, '0')}`;
              await clientApi<Project>("/projects", {
                method: "POST",
                body: JSON.stringify({
                  annualPlanId: newPlan.id,
                  no,
                  projectName: ap.projectName || "",
                  departmentId: ap.departmentId,
                  type: ap.type || "OE",
                  revieweeIds: ap.revieweeIds || "",
                  conductDate: ap.conductDate,
                  endDate: ap.endDate,
                  durationDay: ap.durationDay || 1,
                  purpose: ap.purpose || "",
                  objectives: ap.objectives || "",
                  scope: ap.scope || "",
                }),
              });
            }
          }
          setAnnualPlans([newPlan, ...annualPlans]);
          setIsModalOpen(false);
          showFeedback(`Annual Plan "${planNameInput}" created successfully.`);
        }
      } else {
        if (!selectedPlanId) return;
        const updated = await clientApi<AnnualPlan>(`/annual-plans/${selectedPlanId}`, {
          method: "PATCH",
          body: JSON.stringify({
            planName: planNameInput.trim(),
            period: pInput,
            comment: commentInput.trim(),
          }),
        });
        if (updated) {
          setAnnualPlans(annualPlans.map(p => p.id === selectedPlanId ? updated : p));
          setIsModalOpen(false);
          showFeedback(`Annual Plan "${planNameInput}" updated successfully.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    } finally {
      isSavingPlanRef.current = false;
      setIsSavingPlan(false);
    }
  };

  // Issues a new QR token; the previous QR code (and any printed copy) stops working.
  const handleRotateQr = async () => {
    if (!selectedPlanId) return;
    try {
      const updated = await clientApi<AnnualPlan>(`/annual-plans/${selectedPlanId}/rotate-qr`, { method: "POST" });
      if (updated) {
        setAnnualPlans(annualPlans.map(p => (p.id === selectedPlanId ? updated : p)));
        setQrModalData(d => ({ ...d, qrToken: updated.qrToken ?? "" }));
        showFeedback("QR code reset. The previous code no longer works.");
      }
    } catch (err: any) {
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPlanId) return;
    try {
      const updated = await clientApi<AnnualPlan>(`/annual-plans/${selectedPlanId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (updated) {
        setAnnualPlans(annualPlans.map(p => p.id === selectedPlanId ? updated : p));
        setStatusInput(newStatus);
        const updatedAps = await clientApi<Project[]>(`/projects/by-annual-plan/${selectedPlanId}`);
        setPlannedEngagements(updatedAps);
        loadApprovedTopicCounts();
        showFeedback(`Annual Plan status updated to ${newStatus}.`);
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Status Update Error: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteAnnualPlan = async (id: string) => {
    const plan = annualPlans.find(p => p.id === id);
    if (!plan) return;

    const confirmDel = window.confirm(`Are you sure you want to delete annual plan "${plan.planName}"?`);
    if (!confirmDel) return;

    try {
      const success = await clientApi<boolean>(`/annual-plans/${id}`, { method: "DELETE" });
      if (success) {
        setAnnualPlans(annualPlans.filter(p => p.id !== id));
        if (selectedPlanId === id) {
          setSelectedPlanId(null);
          setIsModalOpen(false);
        }
        showFeedback(`Annual plan "${plan.planName}" has been deleted.`);
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Delete Error: ${err.message || err.toString()}`);
    }
  };

  // --- Child OE Plan Handlers ---
  const openChildCreateModal = () => {
    setChildModalMode("create");
    setApProjectName("");
    setApBuId("");
    setApDepartmentId("");
    setApType("OE");
    setApVersion("V1");
    setApRevieweeIds([]);
    setApConductDate("");
    setApEndDate("");
    setApPurpose("");
    setApObjectivesItems(parsePlanItems("", "OE-OBJ"));
    setApScopeItems(parsePlanItems("", "OE-SCP"));
    setSelectedPlannedEngagementId(null);
    setIsChildModalOpen(true);
  };

  const openChildEditModal = (ap: any) => {
    setChildModalMode("edit");
    setSelectedPlannedEngagementId(ap.id);
    setApProjectName(ap.projectName || "");
    // Older projects only stored the department name and BU name as text.
    const dept =
      departments.find(d => d.id === ap.departmentId) ||
      departments.find(d => d.name === ap.topic && d.businessUnitName === ap.bu);
    setApDepartmentId(dept?.id ?? "");
    setApBuId(dept?.businessUnitId ?? "");
    setApType(ap.type || "OE");
    setApVersion(ap.version || "V1");
    setApRevieweeIds(ap.revieweeIds ? ap.revieweeIds.split(",") : []);
    setApConductDate(ap.conductDate);
    setApEndDate(ap.endDate);
    setApPurpose(ap.purpose);
    setApObjectivesItems(parsePlanItems(ap.objectives, "OE-OBJ"));
    setApScopeItems(parsePlanItems(ap.scope, "OE-SCP"));
    setIsChildModalOpen(true);
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of start day
  };

  const handleSaveChildPlan = async () => {
    if (!apProjectName.trim() || !apBuId || !apDepartmentId || !apConductDate || !apEndDate) {
      showFeedback("Error: Project Name, BU, Department, Conduct Date, and End Date are required.");
      return;
    }
    // Display text for the local draft rows; the server derives these from departmentId.
    const chosenDept = departments.find(d => d.id === apDepartmentId);
    const apTopic = chosenDept?.name ?? "";
    const apBu = chosenDept?.businessUnitName ?? "";
    if (!apPurpose.trim() || apRevieweeIds.length === 0) {
      showFeedback("Error: Purpose and Reviewee(s) are required.");
      return;
    }
    if (!apScopeItems.some((item) => item.text.trim())) {
      showFeedback("Error: Scope is required. Add at least one scope item before saving.");
      return;
    }
    const dateError = validateDateRange(apConductDate, apEndDate);
    if (dateError) {
      showFeedback(`Error: ${dateError}`);
      return;
    }

    const durationDay = calculateDuration(apConductDate, apEndDate);
    const revieweeString = apRevieweeIds.join(",");

    try {
      if (modalMode === "create") {
        if (childModalMode === "create") {
          const no = `PRJ-${String(plannedEngagements.length + 1).padStart(3, '0')}`;
          const newAp = {
            id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            annualPlanId: "",
            no,
            projectName: apProjectName,
            departmentId: apDepartmentId,
            topic: apTopic,
            bu: apBu,
            type: apType,
            version: apVersion,
            revieweeIds: revieweeString,
            conductDate: apConductDate,
            endDate: apEndDate,
            durationDay,
            purpose: apPurpose,
            objectives: serializePlanItems(apObjectivesItems),
            scope: serializePlanItems(apScopeItems)
          };
          setPlannedEngagements([...plannedEngagements, newAp]);
          setIsChildModalOpen(false);
          showFeedback("Project added to draft.");
        } else {
          if (!selectedPlannedEngagementId) return;
          setPlannedEngagements(plannedEngagements.map(ap => ap.id === selectedPlannedEngagementId ? {
            ...ap,
            projectName: apProjectName,
            departmentId: apDepartmentId,
            topic: apTopic,
            bu: apBu,
            type: apType,
            version: apVersion,
            revieweeIds: revieweeString,
            conductDate: apConductDate,
            endDate: apEndDate,
            durationDay,
            purpose: apPurpose,
            objectives: serializePlanItems(apObjectivesItems),
            scope: serializePlanItems(apScopeItems)
          } : ap));
          setIsChildModalOpen(false);
          showFeedback("Project updated in draft.");
        }
      } else {
        if (!selectedPlanId) return;
        if (childModalMode === "create") {
          const no = `PRJ-${String(plannedEngagements.length + 1).padStart(3, '0')}`;
          const newAp = await clientApi<Project>("/projects", {
            method: "POST",
            body: JSON.stringify({
              annualPlanId: selectedPlanId,
              no,
              projectName: apProjectName,
              departmentId: apDepartmentId,
              topic: apTopic,
              bu: apBu,
              type: apType,
              revieweeIds: revieweeString,
              conductDate: apConductDate,
              endDate: apEndDate,
              durationDay,
              purpose: apPurpose,
              objectives: serializePlanItems(apObjectivesItems),
              scope: serializePlanItems(apScopeItems),
            }),
          });
          if (newAp) {
            const updated = await clientApi<Project[]>(`/projects/by-annual-plan/${selectedPlanId}`);
            setPlannedEngagements(updated);
            setIsChildModalOpen(false);
            showFeedback("Project added successfully.");
          }
        } else {
          if (!selectedPlannedEngagementId) return;
          const updatedAp = await clientApi<Project>(`/projects/${selectedPlannedEngagementId}`, {
            method: "PATCH",
            body: JSON.stringify({
              projectName: apProjectName,
              departmentId: apDepartmentId,
              topic: apTopic,
              bu: apBu,
              type: apType,
              revieweeIds: revieweeString,
              conductDate: apConductDate,
              endDate: apEndDate,
              durationDay,
              purpose: apPurpose,
              objectives: serializePlanItems(apObjectivesItems),
              scope: serializePlanItems(apScopeItems),
            }),
          });
          if (updatedAp) {
            const updated = await clientApi<Project[]>(`/projects/by-annual-plan/${selectedPlanId}`);
            setPlannedEngagements(updated);
            setIsChildModalOpen(false);
            showFeedback("Project updated successfully.");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteChildPlan = async (id: string) => {
    const confirmDel = window.confirm("Are you sure you want to delete this project?");
    if (!confirmDel) return;

    if (modalMode === "create" || id.startsWith("draft-")) {
      const remaining = plannedEngagements.filter(ap => ap.id !== id);
      const deptCounts: Record<string, number> = {};
      const remapped = remaining.map(ap => {
        const key = (ap.topic || "").trim().toLowerCase();
        const count = (deptCounts[key] || 0) + 1;
        deptCounts[key] = count;
        return { ...ap, version: `V${count}` };
      });
      setPlannedEngagements(remapped);
      showFeedback("Project removed from draft.");
      return;
    }

    try {
      const success = await clientApi<boolean>(`/projects/${id}`, { method: "DELETE" });
      if (success) {
        if (selectedPlanId) {
          const updated = await clientApi<Project[]>(`/projects/by-annual-plan/${selectedPlanId}`);
          setPlannedEngagements(updated);
        } else {
          setPlannedEngagements(plannedEngagements.filter(ap => ap.id !== id));
        }
        showFeedback("Project deleted successfully.");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Delete Error: ${err.message || err.toString()}`);
    }
  };


  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Filter logic
  const filteredPlans = annualPlans.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.planName.toLowerCase().includes(query) || 
      p.period.toLowerCase().includes(query)
    );
  }).sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));

  const periodOptions = Array.from({ length: 11 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { label: year.toString(), value: year.toString() };
  });

  const userOptions = initialUsers.map(u => ({ label: u.name, value: u.id }));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Annual OE Plans</h1>
        <div className="h-px bg-slate-200 dark:bg-slate-800 w-full mt-2" />
      </div>

      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Main projects grid layout */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        
        {/* ActionToolbar */}
        <ActionToolbar
          onCreate={canCreatePlan ? openCreateModal : undefined}
          onEdit={canUpdatePlan && selectedPlanId && annualPlans.find(p => p.id === selectedPlanId) ? () => openEditModal(annualPlans.find(p => p.id === selectedPlanId)!) : undefined}
          onDelete={canDeletePlan && selectedPlanId && annualPlans.find(p => p.id === selectedPlanId)?.status !== "APPROVED" ? () => handleDeleteAnnualPlan(selectedPlanId) : undefined}
          onRefresh={() => {
            setSearchQuery("");
            setSelectedPlanId(null);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder="Search plans..."
          activeFilterCountLabel="ALL"
        />

        {/* Table of plans */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
              <tr>
                <th className="px-6 py-4">Plan Name</th>
                <th className="px-6 py-4">Year</th>
                <th className="px-6 py-4">Remarks</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredPlans.map((plan) => (
                <tr 
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id === selectedPlanId ? null : plan.id)}
                  className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                    plan.id === selectedPlanId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                  }`}
                >
                  <td 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(plan);
                    }}
                    className="px-6 py-4 text-[#0066cc] font-medium hover:underline cursor-pointer font-sans"
                  >
                    {plan.planName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {plan.period}
                  </td>
                  <td className="px-6 py-4 text-slate-500 truncate max-w-[250px]" title={plan.comment}>
                    {plan.comment || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                      {plan.status === "APPROVED" && <CheckCircle className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
                      {plan.status === "REJECTED" && <XCircle className="w-3 h-3 text-slate-500" />}
                      {plan.status === "PENDING_APPROVAL" && <Clock className="w-3 h-3 text-slate-500" />}
                      {(!plan.status || plan.status === "DRAFT") && <Clock className="w-3 h-3 text-slate-400" />}
                      {plan.status || "DRAFT"}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPlans.length === 0 && (
                <tr>
                  <td colSpan={canDeletePlan || canUpdatePlan ? 5 : 4} className="px-6 py-8 text-center text-slate-400 font-sans text-xs">
                    No annual plans found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen-matching Modal Editor Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center z-50 overflow-y-auto p-4 md:p-8 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-[92rem] rounded-lg shadow-2xl flex flex-col overflow-hidden h-fit border border-slate-200 dark:border-slate-800">
            
            {/* Modal Header Breadcrumb & Actions */}
            <div className="px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 w-full max-w-xl">
                <div className="flex items-center gap-1.5 text-[15px] font-roboto text-400 font-bold">
                  <span>Annual OE Plan</span>
                  <span>&gt;</span>
                  <span className="text-slate-600 font-roboto dark:text-slate-300">
                    {modalMode === "create" ? "New Plan" : "Edit Plan"}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 pb-0.5">
                  {modalMode === "create" ? "New Annual OE Plan" : "Edit Annual OE Plan"}
                </h2>
                
                {/* Meta details row under header */}
                {modalMode === "edit" && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] font-sans text-slate-400">
                    <span className="flex items-center gap-1 font-roboto">
                      <CalendarDays className="w-3.5 h-3.5 font-roboto" /> Period: {periodInput[0] || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 font-roboto">
                      <Activity className="w-3.5 h-3.5" /> Owner: {annualPlans.find(p => p.id === selectedPlanId)?.createdBy || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300">
                      {statusInput === "APPROVED" && <CheckCircle className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
                      {statusInput === "REJECTED" && <XCircle className="w-3 h-3 text-slate-500" />}
                      {statusInput === "PENDING_APPROVAL" && <Clock className="w-3 h-3 text-slate-500" />}
                      {(!statusInput || statusInput === "DRAFT") && <Clock className="w-3 h-3 text-slate-400" />}
                      {statusInput}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons (Header Right) */}
              <div className="flex items-center gap-4 self-start md:self-auto shrink-0 no-print">
                {modalMode === "edit" && selectedPlanId && (
                  <>
                    {(statusInput === "DRAFT" || statusInput === "REJECTED") && canSubmitPlan && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus("PENDING_APPROVAL")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                        title="Submit for Approval"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit
                      </button>
                    )}
                    {statusInput === "PENDING_APPROVAL" && canApprovePlan && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus("APPROVED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                          title="Approve Plan"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus("REJECTED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                          title="Reject Plan"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </>
                )}
                {modalMode === "edit" && selectedPlanId && statusInput === "APPROVED" && annualPlans.find(p => p.id === selectedPlanId)?.qrToken && (
                  <button
                    type="button"
                    onClick={() => {
                      const plan = annualPlans.find(p => p.id === selectedPlanId);
                      setQrModalData({ qrToken: plan?.qrToken ?? "", planName: planNameInput, period: periodInput[0] || "" });
                      setQrModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded cursor-pointer group"
                    title="Show Annual Plan QR Code"
                  >
                    {miniQrDataUrl ? (
                      <div className="h-6 flex items-center justify-center bg-white rounded shadow-sm overflow-hidden p-0.5 pointer-events-none">
                        <img 
                          src={miniQrDataUrl} 
                          alt="Annual Plan QR Code" 
                          className="h-full w-auto object-contain mix-blend-multiply filter contrast-125"
                        />
                      </div>
                    ) : (
                      <QrCode className="w-5 h-5 text-slate-400 group-hover:text-slate-500 transition-colors" />
                    )}
                    <span className="text-xs font-bold font-sans">Show QR</span>
                  </button>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveAnnualPlan}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0a1128] dark:bg-accent text-white dark:text-slate-950 hover:opacity-90 text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={
                      isSavingPlan ||
                      (statusInput !== "DRAFT" && statusInput !== "REJECTED" && modalMode !== "create") ||
                      (modalMode === "create" ? !canCreatePlan : !canUpdatePlan)
                    }
                  >
                    <Save className="w-3.5 h-3.5" /> {isSavingPlan ? "Saving..." : "Save Plan"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="p-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded cursor-pointer bg-white dark:bg-slate-900"
                    title="Close Screen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body Container Grid */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[72vh] bg-slate-50 dark:bg-slate-950">
              
              {/* Quick Summary Panel at the Top */}
              <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-roboto font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    ANNUAL PLAN DETAILS
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Column 1 */}
                  <div className="space-y-4 border-b md:border-b-0 md:border-r border-slate-150 dark:border-slate-800 pb-4 md:pb-0 md:pr-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans font-bold text-slate-500">Annual Plan Name</label>
                      <input
                        type="text"
                        value={planNameInput}
                        onChange={(e) => setPlanNameInput(e.target.value)}
                        placeholder="e.g. Annual Plan Name"
                        disabled={statusInput === "APPROVED" || (modalMode === "create" ? !canCreatePlan : !canUpdatePlan)}
                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  
                  {/* Column 2 */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans font-bold uppercase text-slate-500">Year</label>
                      <MultiSelect
                        options={periodOptions}
                        selectedValues={periodInput}
                        onChange={setPeriodInput}
                        placeholder="Select Period..."
                        singleSelect={true}
                        disabled={statusInput === "APPROVED" || (modalMode === "create" ? !canCreatePlan : !canUpdatePlan)}
                      />
                    </div>
                  </div>
                </div>

                {/* Comment Section below */}
                <div className="pt-4 border-t border-slate-150 dark:border-slate-800">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-sans font-bold uppercase text-slate-500">Remarks</label>
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add any additional comments for this annual plan..."
                      disabled={statusInput === "APPROVED" || (modalMode === "create" ? !canCreatePlan : !canUpdatePlan)}
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-3 focus:outline-none focus:ring-1 focus:ring-[#05375c] min-h-[100px] resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
              
              {/* Child OE Plans List */}
              <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="text-xs font-roboto font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Projects
                  </h3>
                  {canCreateChildPlan && statusInput !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={openChildCreateModal}
                      className="flex items-center gap-1 text-xs font-medium text-[#0066cc] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Project
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Project Name</th>
                        <th className="px-4 py-3">Department/Topic</th>
                        <th className="px-4 py-3">BU</th>
                        <th className="px-4 py-3">Version</th>
                        <th className="px-4 py-3">Conduct Date</th>
                        <th className="px-4 py-3">End Date</th>
                        <th className="px-4 py-3">Duration (Day)</th>
                        <th className="px-4 py-3">Status</th>
                        {(canUpdateChildPlan || canDeleteChildPlan) && <th className="px-4 py-3 text-center w-20">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {[...plannedEngagements].sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true, sensitivity: "base" })).map((ap) => (
                        <tr key={ap.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-medium">{ap.no}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{ap.type || "OE"}</td>
                          <td
                            onClick={() => openChildEditModal(ap)}
                            className="px-4 py-3 text-[#0066cc] font-medium hover:underline cursor-pointer"
                          >
                            {ap.projectName}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{ap.topic}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{ap.bu}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {statusInput === "APPROVED" || ap.isApproved ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700">
                                {ap.version || "V1"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                                <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 font-medium">
                                  {ap.version || "V1"}
                                </span>
                                <span className="text-[10px] font-sans font-medium text-slate-400 uppercase tracking-wider">
                                  Draft
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{ap.conductDate}</td>
                          <td className="px-4 py-3 text-slate-500">{ap.endDate}</td>
                          <td className="px-4 py-3 text-slate-500">{ap.durationDay}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                              {!ap.isUsed ? (
                                <>
                                  <Circle className="w-3 h-3 text-slate-400" />
                                  Available
                                </>
                              ) : ap.individualPlanStatus === "RELEASED" ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                                  Released
                                </>
                              ) : ap.individualPlanStatus === "CLOSED" ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-slate-500" />
                                  Closed
                                </>
                              ) : ap.individualPlanStatus === "SUBMITTED_FOR_APPROVAL" ? (
                                <>
                                  <FileText className="w-3 h-3 text-slate-500" />
                                  Submitted
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Planning
                                </>
                              )}
                            </span>
                          </td>
                          {(canUpdateChildPlan || canDeleteChildPlan) && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {canUpdateChildPlan && (
                                  <button
                                    type="button"
                                    onClick={() => openChildEditModal(ap)}
                                    className="text-slate-400 hover:text-[#0066cc]"
                                    title={statusInput === "APPROVED" ? "View Project" : "Edit Project"}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {statusInput !== "APPROVED" && !ap.isUsed && canDeleteChildPlan && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChildPlan(ap.id)}
                                    className="text-slate-400 hover:text-red-600"
                                    title="Delete Project"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {plannedEngagements.length === 0 && (
                        <tr>
                          <td colSpan={canUpdateChildPlan || canDeleteChildPlan ? 11 : 10} className="px-4 py-6 text-center text-slate-400 text-xs italic">
                            No Projects added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Child OE Plan Modal */}
      {isChildModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-[60] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 w-full max-w-3xl rounded-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                {!childCanEdit ? "View Project" : (childModalMode === "create" ? "Add Project" : "Edit Project")}
              </h2>
              <button onClick={() => setIsChildModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Type</label>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-md">
                    <MultiSelect
                      selectedValues={apType ? [apType] : []}
                      onChange={(values) => setApType(values.length > 0 ? values[0] : "")}
                      singleSelect={true}
                      disabled={!childCanEdit}
                      options={[
                        { value: "OE", label: "OE" },
                        { value: "ISO Internal OE", label: "ISO Internal OE" },
                        { value: "ISO External OE", label: "ISO External OE" }
                      ]}
                      placeholder="Select Type..."
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Project Name</label>
                  <input
                    type="text"
                    value={apProjectName}
                    onChange={(e) => setApProjectName(e.target.value)}
                    disabled={!childCanEdit}
                    placeholder="Enter project name..."
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_2fr_1fr] gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">BU *</label>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-md">
                    <MultiSelect
                      selectedValues={apBuId ? [apBuId] : []}
                      onChange={(values) => {
                        const chosen = values.length > 0 ? values[0] : "";
                        if (chosen !== apBuId) {
                          // Departments belong to one Business Unit, so changing it clears the department.
                          setApDepartmentId("");
                          setApVersion("V1");
                        }
                        setApBuId(chosen);
                      }}
                      singleSelect={true}
                      disabled={!childCanEdit}
                      options={businessUnits.map((b) => ({
                        value: b.id,
                        label: b.name,
                      }))}
                      placeholder="Select BU..."
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Department / Project Topic *</label>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-md">
                    <MultiSelect
                      selectedValues={apDepartmentId ? [apDepartmentId] : []}
                      onChange={(values) => {
                        const chosenId = values.length > 0 ? values[0] : "";
                        setApDepartmentId(chosenId);
                        if (chosenId) {
                          // Versions count per department (ids, so two BUs can both have a "Finance").
                          const baseApproved = approvedTopicCounts[chosenId] || 0;
                          const draftCount = plannedEngagements.filter(p =>
                            (childModalMode === "create" || p.id !== selectedPlannedEngagementId) &&
                            p.departmentId === chosenId
                          ).length;
                          const computedVersion = statusInput === "APPROVED"
                            ? `V${baseApproved}`
                            : `V${baseApproved + draftCount + 1}`;
                          setApVersion(computedVersion);
                        } else {
                          setApVersion("V1");
                        }
                      }}
                      singleSelect={true}
                      disabled={!childCanEdit || !apBuId}
                      options={departments
                        .filter((d) => d.businessUnitId === apBuId)
                        .map((d) => ({
                          value: d.id,
                          label: d.name,
                        }))}
                      placeholder={apBuId ? "Select Department..." : "Select a BU first..."}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Version</label>
                  <input
                    type="text"
                    value={statusInput === "APPROVED" ? apVersion : `${apVersion} (Draft)`}
                    readOnly
                    title={statusInput !== "APPROVED" ? "Provisional - locks on approval" : undefined}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-sm font-semibold rounded-md px-3 py-2 focus:outline-none cursor-default"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-bold uppercase text-slate-500">Reviewee(s) *</label>
                <MultiSelect
                  options={[
                    { label: 'Related', value: 'Related' },
                    { label: 'HOD', value: 'HOD' },
                    { label: 'MGT', value: 'MGT' }
                  ]}
                  selectedValues={apRevieweeIds}
                  onChange={setApRevieweeIds}
                  disabled={!childCanEdit}
                  placeholder="Select Reviewees..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Conduct Date</label>
                  <input
                    type="date"
                    value={apConductDate}
                    onChange={(e) => setApConductDate(e.target.value)}
                    disabled={!childCanEdit}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">End Date</label>
                  <input
                    type="date"
                    value={apEndDate}
                    onChange={(e) => setApEndDate(e.target.value)}
                    disabled={!childCanEdit}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-bold uppercase text-slate-500">Purpose *</label>
                <textarea
                  value={apPurpose}
                  onChange={(e) => setApPurpose(e.target.value)}
                  disabled={!childCanEdit}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] h-24 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Enter purpose..."
                />
              </div>

              <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-4">
                <PlanItemEditor
                  sectionTitle="Objectives"
                  items={apObjectivesItems}
                  onChange={setApObjectivesItems}
                  prefix="OE-OBJ"
                  editable={childCanEdit}
                  placeholder="Enter objective item description..."
                  addBtnText="Add Objective"
                />

                <PlanItemEditor
                  sectionTitle="Scope *"
                  items={apScopeItems}
                  onChange={setApScopeItems}
                  prefix="OE-SCP"
                  editable={childCanEdit}
                  placeholder="Enter scope item description..."
                  addBtnText="Add Scope Item"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsChildModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                {childCanEdit ? "Cancel" : "Close"}
              </button>
              {childCanEdit && (
                <button
                  type="button"
                  onClick={handleSaveChildPlan}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#0a1128] rounded-md hover:opacity-90 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {qrModalOpen && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          qrToken={qrModalData.qrToken}
          planName={qrModalData.planName}
          period={qrModalData.period}
          onRotate={canUpdatePlan ? handleRotateQr : undefined}
        />
      )}
    </div>
  );
}
