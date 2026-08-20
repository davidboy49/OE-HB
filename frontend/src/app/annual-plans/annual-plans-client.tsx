"use client";

import { useState, useEffect } from "react";
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
  XCircle,
  Send,
  Layers,
  ChevronRight
} from "lucide-react";
import type { User, AnnualPlan, AuditPlan, Department } from "@auditdesk/shared";
import QRCodeModal from "@/components/ui/qr-code-modal";
import QRCode from "qrcode";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import MultiSelect from "@/components/ui/multi-select";

interface AnnualPlansClientProps {
  initialAnnualPlans: AnnualPlan[];
  initialUsers?: User[];
  departments: Department[];
  currentUser: User;
}

export default function AnnualPlansClient({ 
  initialAnnualPlans, 
  initialUsers = [],
  departments,
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
  const [qrModalData, setQrModalData] = useState<{ qrToken: string; projectTitle: string }>({ qrToken: "", projectTitle: "" });
  const [miniQrDataUrl, setMiniQrDataUrl] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  // Child Plan (Audit Plan) states
  const [auditPlans, setAuditPlans] = useState<any[]>([]);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [childModalMode, setChildModalMode] = useState<"create" | "edit">("create");
  const [selectedAuditPlanId, setSelectedAuditPlanId] = useState<string | null>(null);
  const [approvedTopicCounts, setApprovedTopicCounts] = useState<Record<string, number>>({});

  // Child Plan fields
  const [apTopic, setApTopic] = useState("");
  const [apType, setApType] = useState("OE");
  const [apVersion, setApVersion] = useState("V1");
  const [apRevieweeIds, setApRevieweeIds] = useState<string[]>([]);
  const [apConductDate, setApConductDate] = useState("");
  const [apEndDate, setApEndDate] = useState("");
  const [apPurpose, setApPurpose] = useState("");

  const canCreatePlan = RBAC.can(currentUser, "annual-plans:create");
  const canUpdatePlan = RBAC.can(currentUser, "annual-plans:update");
  const canDeletePlan = RBAC.can(currentUser, "annual-plans:delete");
  const canCreateChildPlan = RBAC.can(currentUser, "audit-plans:create");
  const canUpdateChildPlan = RBAC.can(currentUser, "audit-plans:update");
  const canDeleteChildPlan = RBAC.can(currentUser, "audit-plans:delete");

  const loadApprovedTopicCounts = () => {
    clientApi<Record<string, number>>("/annual-plans/approved-topic-counts").then(setApprovedTopicCounts).catch(console.error);
  };

  useEffect(() => {
    loadApprovedTopicCounts();
  }, [annualPlans]);

  useEffect(() => {
    if (selectedPlanId && modalMode === "edit") {
      clientApi<AuditPlan[]>(`/audit-plans/by-annual-plan/${selectedPlanId}`).then(setAuditPlans).catch(console.error);
      const plan = annualPlans.find(p => p.id === selectedPlanId);
      if (plan) {
        const url = `${window.location.origin}/annual-plans/scan/${plan.id}`;
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
    setAuditPlans([]);
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
    const pInput = periodInput[0] || "";
    if (!planNameInput.trim() || !pInput) {
      showFeedback("Error: Plan Name and Period are required.");
      return;
    }

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
          if (auditPlans.length > 0) {
            const plansToPersist = [...auditPlans].sort((a, b) =>
              (a.no || "").localeCompare(b.no || "", undefined, { numeric: true, sensitivity: "base" })
            );
            for (let i = 0; i < plansToPersist.length; i++) {
              const ap = plansToPersist[i];
              const no = `AP-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`;
              await clientApi<AuditPlan>("/audit-plans", {
                method: "POST",
                body: JSON.stringify({
                  annualPlanId: newPlan.id,
                  no,
                  topic: ap.topic,
                  type: ap.type || "OE",
                  revieweeIds: ap.revieweeIds || "",
                  conductDate: ap.conductDate,
                  endDate: ap.endDate,
                  durationDay: ap.durationDay || 1,
                  purpose: ap.purpose || "",
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
        const updatedAps = await clientApi<AuditPlan[]>(`/audit-plans/by-annual-plan/${selectedPlanId}`);
        setAuditPlans(updatedAps);
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

  // --- Child Audit Plan Handlers ---
  const openChildCreateModal = () => {
    setChildModalMode("create");
    setApTopic("");
    setApType("OE");
    setApVersion("V1");
    setApRevieweeIds([]);
    setApConductDate("");
    setApEndDate("");
    setApPurpose("");
    setSelectedAuditPlanId(null);
    setIsChildModalOpen(true);
  };

  const openChildEditModal = (ap: any) => {
    setChildModalMode("edit");
    setSelectedAuditPlanId(ap.id);
    setApTopic(ap.topic);
    setApType(ap.type || "OE");
    setApVersion(ap.version || "V1");
    setApRevieweeIds(ap.revieweeIds ? ap.revieweeIds.split(",") : []);
    setApConductDate(ap.conductDate);
    setApEndDate(ap.endDate);
    setApPurpose(ap.purpose);
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
    if (!apTopic.trim() || !apConductDate || !apEndDate) {
      showFeedback("Error: Topic, Conduct Date, and End Date are required.");
      return;
    }

    const durationDay = calculateDuration(apConductDate, apEndDate);
    const revieweeString = apRevieweeIds.join(",");

    try {
      if (modalMode === "create") {
        if (childModalMode === "create") {
          const no = `AP-${new Date().getFullYear()}-${String(auditPlans.length + 1).padStart(3, '0')}`;
          const newAp = {
            id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            annualPlanId: "",
            no,
            topic: apTopic,
            type: apType,
            version: apVersion,
            revieweeIds: revieweeString,
            conductDate: apConductDate,
            endDate: apEndDate,
            durationDay,
            purpose: apPurpose
          };
          setAuditPlans([...auditPlans, newAp]);
          setIsChildModalOpen(false);
          showFeedback("Audit Plan added to draft.");
        } else {
          if (!selectedAuditPlanId) return;
          setAuditPlans(auditPlans.map(ap => ap.id === selectedAuditPlanId ? {
            ...ap,
            topic: apTopic,
            type: apType,
            version: apVersion,
            revieweeIds: revieweeString,
            conductDate: apConductDate,
            endDate: apEndDate,
            durationDay,
            purpose: apPurpose
          } : ap));
          setIsChildModalOpen(false);
          showFeedback("Audit Plan updated in draft.");
        }
      } else {
        if (!selectedPlanId) return;
        if (childModalMode === "create") {
          const no = `AP-${new Date().getFullYear()}-${String(auditPlans.length + 1).padStart(3, '0')}`;
          const newAp = await clientApi<AuditPlan>("/audit-plans", {
            method: "POST",
            body: JSON.stringify({
              annualPlanId: selectedPlanId,
              no,
              topic: apTopic,
              type: apType,
              revieweeIds: revieweeString,
              conductDate: apConductDate,
              endDate: apEndDate,
              durationDay,
              purpose: apPurpose,
            }),
          });
          if (newAp) {
            const updated = await clientApi<AuditPlan[]>(`/audit-plans/by-annual-plan/${selectedPlanId}`);
            setAuditPlans(updated);
            setIsChildModalOpen(false);
            showFeedback("Audit Plan added successfully.");
          }
        } else {
          if (!selectedAuditPlanId) return;
          const updatedAp = await clientApi<AuditPlan>(`/audit-plans/${selectedAuditPlanId}`, {
            method: "PATCH",
            body: JSON.stringify({
              topic: apTopic,
              type: apType,
              revieweeIds: revieweeString,
              conductDate: apConductDate,
              endDate: apEndDate,
              durationDay,
              purpose: apPurpose,
            }),
          });
          if (updatedAp) {
            const updated = await clientApi<AuditPlan[]>(`/audit-plans/by-annual-plan/${selectedPlanId}`);
            setAuditPlans(updated);
            setIsChildModalOpen(false);
            showFeedback("Audit Plan updated successfully.");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteChildPlan = async (id: string) => {
    const confirmDel = window.confirm("Are you sure you want to delete this planned engagement?");
    if (!confirmDel) return;

    if (modalMode === "create" || id.startsWith("draft-")) {
      const remaining = auditPlans.filter(ap => ap.id !== id);
      const deptCounts: Record<string, number> = {};
      const remapped = remaining.map(ap => {
        const key = (ap.topic || "").trim().toLowerCase();
        const count = (deptCounts[key] || 0) + 1;
        deptCounts[key] = count;
        return { ...ap, version: `V${count}` };
      });
      setAuditPlans(remapped);
      showFeedback("Audit Plan removed from draft.");
      return;
    }

    try {
      const success = await clientApi<boolean>(`/audit-plans/${id}`, { method: "DELETE" });
      if (success) {
        if (selectedPlanId) {
          const updated = await clientApi<AuditPlan[]>(`/audit-plans/by-annual-plan/${selectedPlanId}`);
          setAuditPlans(updated);
        } else {
          setAuditPlans(auditPlans.filter(ap => ap.id !== id));
        }
        showFeedback("Audit Plan deleted successfully.");
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
          <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-5xl rounded-lg shadow-2xl flex flex-col overflow-hidden h-fit border border-slate-200 dark:border-slate-800">
            
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
                      <Activity className="w-3.5 h-3.5" /> Owner: {currentUser?.name}
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
                    {(statusInput === "DRAFT" || statusInput === "REJECTED") && canUpdatePlan && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus("PENDING_APPROVAL")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                        title="Submit for Approval"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit
                      </button>
                    )}
                    {statusInput === "PENDING_APPROVAL" && canUpdatePlan && (
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
                {modalMode === "edit" && selectedPlanId && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrModalData({ qrToken: selectedPlanId, projectTitle: planNameInput });
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
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0a1128] dark:bg-accent text-white dark:text-slate-950 hover:opacity-90 text-xs font-bold rounded transition-colors cursor-pointer"
                    disabled={
                      (statusInput !== "DRAFT" && statusInput !== "REJECTED" && modalMode !== "create") ||
                      (modalMode === "create" ? !canCreatePlan : !canUpdatePlan)
                    }
                  >
                    <Save className="w-3.5 h-3.5" /> Save Plan
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
                        disabled={statusInput === "APPROVED"}
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
                        disabled={statusInput === "APPROVED"}
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
                      disabled={statusInput === "APPROVED"}
                      className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-3 focus:outline-none focus:ring-1 focus:ring-[#05375c] min-h-[100px] resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
              
              {/* Child Audit Plans List */}
              <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="text-xs font-roboto font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Planned OE Engagements
                  </h3>
                  {canCreateChildPlan && statusInput !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={openChildCreateModal}
                      className="flex items-center gap-1 text-xs font-medium text-[#0066cc] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Planned Engagement
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                      <tr>
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Department/Topic</th>
                        <th className="px-4 py-3">Version</th>
                        <th className="px-4 py-3">Conduct Date</th>
                        <th className="px-4 py-3">End Date</th>
                        <th className="px-4 py-3">Duration (Day)</th>
                        {(canUpdateChildPlan || canDeleteChildPlan) && <th className="px-4 py-3 text-center w-20">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {[...auditPlans].sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true, sensitivity: "base" })).map((ap) => (
                        <tr key={ap.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-medium">{ap.no}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{ap.type || "OE"}</td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{ap.topic}</td>
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
                          {(canUpdateChildPlan || canDeleteChildPlan) && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {canUpdateChildPlan && (
                                  <button
                                    type="button"
                                    onClick={() => openChildEditModal(ap)}
                                    className="text-slate-400 hover:text-[#0066cc]"
                                    title={statusInput === "APPROVED" ? "View Planned Engagement" : "Edit Planned Engagement"}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {statusInput !== "APPROVED" && canDeleteChildPlan && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChildPlan(ap.id)}
                                    className="text-slate-400 hover:text-red-600"
                                    title="Delete Planned Engagement"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {auditPlans.length === 0 && (
                        <tr>
                          <td colSpan={canUpdateChildPlan || canDeleteChildPlan ? 8 : 7} className="px-4 py-6 text-center text-slate-400 text-xs italic">
                            No Planned Engagements added yet.
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

      {/* Child Audit Plan Modal */}
      {isChildModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-[60] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                {statusInput === "APPROVED" ? "View Planned Engagement" : (childModalMode === "create" ? "Add Planned Engagement" : "Edit Planned Engagement")}
              </h2>
              <button onClick={() => setIsChildModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-bold uppercase text-slate-500">Department / Engagement Topic</label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-md">
                  <MultiSelect
                    selectedValues={apTopic ? [apTopic] : []}
                    onChange={(values) => {
                      const chosenTopic = values.length > 0 ? values[0] : "";
                      setApTopic(chosenTopic);
                      if (chosenTopic) {
                        const topicKey = chosenTopic.trim().toLowerCase();
                        const baseApproved = approvedTopicCounts[topicKey] || 0;
                        const draftCount = auditPlans.filter(p => 
                          (childModalMode === "create" || p.id !== selectedAuditPlanId) &&
                          (p.topic || "").trim().toLowerCase() === topicKey
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
                    disabled={statusInput === "APPROVED"}
                    options={departments.map((d) => ({
                      value: d.name,
                      label: d.name,
                    }))}
                    placeholder="Select Department..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">Type</label>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-md">
                    <MultiSelect
                      selectedValues={apType ? [apType] : []}
                      onChange={(values) => setApType(values.length > 0 ? values[0] : "")}
                      singleSelect={true}
                      disabled={statusInput === "APPROVED"}
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-sans font-bold uppercase text-slate-500">Version</label>
                    {statusInput !== "APPROVED" && (
                      <span className="text-[10px] font-sans font-medium text-slate-400">
                        Provisional (Locks on Approval)
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={statusInput === "APPROVED" ? apVersion : `${apVersion} (Draft)`}
                    readOnly
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-sm font-semibold rounded-md px-3 py-2 focus:outline-none cursor-default"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-bold uppercase text-slate-500">Reviewee(s)</label>
                <MultiSelect
                  options={[
                    { label: 'Related', value: 'Related' },
                    { label: 'HOD', value: 'HOD' },
                    { label: 'MGT', value: 'MGT' }
                  ]}
                  selectedValues={apRevieweeIds}
                  onChange={setApRevieweeIds}
                  disabled={statusInput === "APPROVED"}
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
                    disabled={statusInput === "APPROVED"}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-bold uppercase text-slate-500">End Date</label>
                  <input
                    type="date"
                    value={apEndDate}
                    onChange={(e) => setApEndDate(e.target.value)}
                    disabled={statusInput === "APPROVED"}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-sans font-bold uppercase text-slate-500">Purpose</label>
                <textarea
                  value={apPurpose}
                  onChange={(e) => setApPurpose(e.target.value)}
                  disabled={statusInput === "APPROVED"}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#05375c] h-24 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Enter purpose..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsChildModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                {statusInput === "APPROVED" ? "Close" : "Cancel"}
              </button>
              {statusInput !== "APPROVED" && (
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
          projectTitle={qrModalData.projectTitle}
          projectCode="Annual Plan"
          departments=""
        />
      )}
    </div>
  );
}
