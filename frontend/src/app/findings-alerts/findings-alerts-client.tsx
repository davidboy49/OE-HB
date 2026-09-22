"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Info,
  User as UserIcon,
  X,
  Edit3,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Copy,
  Check,
  Mail,
  Send,
  CalendarClock,
  Settings,
  AlertCircle
} from "lucide-react";
import type { User, OePlan, Department, ExecutionSchedule } from "@oeportal/shared";
import { parseFindingAlerts, FindingAlertItem, groupFindingAlerts, GroupedFindingAlert } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import ActionToolbar from "@/components/ui/action-toolbar";

interface FindingsAlertsClientProps {
  initialSchedules: ExecutionSchedule[];
  projects: OePlan[];
  users: User[];
  departments: Department[];
  currentUser: User;
}

export default function FindingsAlertsClient({
  initialSchedules,
  projects,
  users,
  departments,
  currentUser
}: FindingsAlertsClientProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ExecutionSchedule[]>(initialSchedules);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "MISSING_FINAL_DATE" | "PENDING_RESOLUTION" | "ALL">("ACTIVE");
  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer config inputs state
  const [correctiveDays, setCorrectiveDays] = useState(30);
  const [notResolvedDays, setNotResolvedDays] = useState(60);
  const [manualTriggerEnabled, setManualTriggerEnabled] = useState(false);

  // Quick Action Modal State (Update date/resolve)
  const [editModalAlertItem, setEditModalAlertItem] = useState<FindingAlertItem | null>(null);
  const [modalFinalDate, setModalFinalDate] = useState<string>("");
  const [modalFinalRemarks, setModalFinalRemarks] = useState<string>("");
  const [modalIsResolved, setModalIsResolved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  // Batch Email Modal State
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState(false);
  const [batchCustomNote, setBatchCustomNote] = useState("");
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // Scheduled Reminder Config State
  const [isScheduleConfigOpen, setIsScheduleConfigOpen] = useState(false);
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(true);
  const [autoReminderFrequency, setAutoReminderFrequency] = useState<"daily" | "three_days" | "weekly">("daily");
  const [lastAutoScanTime, setLastAutoScanTime] = useState<string>("Today, 08:00 AM");

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Parse all alert items
  const allAlertItems = useMemo(() => {
    return parseFindingAlerts(schedules);
  }, [schedules]);

  // Counts & Statistics
  const counts = useMemo(() => {
    const missingFinalDate = allAlertItems.filter(item => item.alertType === "MISSING_FINAL_DATE").length;
    const pendingResolution = allAlertItems.filter(item => item.alertType === "PENDING_RESOLUTION").length;
    const resolved = allAlertItems.filter(item => item.isResolved).length;
    const active = missingFinalDate + pendingResolution;
    const total = allAlertItems.length;
    const complianceRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
    return { active, missingFinalDate, pendingResolution, resolved, total, complianceRate };
  }, [allAlertItems]);

  const projectCodeById = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = p.code; });
    return map;
  }, [projects]);

  // Filtered items
  const filteredAlerts = useMemo(() => {
    return allAlertItems.filter(item => {
      // Tab Filter
      if (activeTab === "ACTIVE" && item.isResolved) return false;
      if (activeTab === "MISSING_FINAL_DATE" && item.alertType !== "MISSING_FINAL_DATE") return false;
      if (activeTab === "PENDING_RESOLUTION" && item.alertType !== "PENDING_RESOLUTION") return false;

      // Project Filter
      if (projectFilter !== "ALL" && item.projectId !== projectFilter) return false;

      // Department Filter
      if (deptFilter !== "ALL" && !item.departments?.toLowerCase().includes(deptFilter.toLowerCase())) return false;

      // Search Query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesActivity = item.activity.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        const matchesDoc = item.documentCode?.toLowerCase().includes(q);
        const matchesDept = item.departments?.toLowerCase().includes(q);
        const matchesConduct = item.conductBy?.toLowerCase().includes(q);
        const matchesCode = projectCodeById[item.projectId]?.toLowerCase().includes(q);
        if (!matchesActivity && !matchesProject && !matchesDoc && !matchesDept && !matchesConduct && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [allAlertItems, activeTab, projectFilter, deptFilter, searchQuery, projectCodeById]);

  // Slide-over Drawer state for viewing NCN items
  const [selectedDrawerGroup, setSelectedDrawerGroup] = useState<GroupedFindingAlert | null>(null);

  // Grouped finding alerts
  const groupedAlerts = useMemo(() => {
    return groupFindingAlerts(filteredAlerts);
  }, [filteredAlerts]);

  const selectedGroup = groupedAlerts.find(g => g.scheduleId === selectedGroupId) || null;

  // Line item statistics for header subtitle and pill counts
  const lineStats = useMemo(() => {
    const totalLines = allAlertItems.length;
    const pendingLines = allAlertItems.filter(i => !i.isResolved).length;
    const completedLines = allAlertItems.filter(i => i.isResolved).length;
    return { totalLines, pendingLines, completedLines };
  }, [allAlertItems]);

  // Active items in current view for batch sending
  const activeAlertsInView = useMemo(() => {
    return filteredAlerts.filter(item => !item.isResolved);
  }, [filteredAlerts]);

  // Individual Row Email Reminder Trigger
  const handleSendSingleReminder = async (item: FindingAlertItem) => {
    showFeedback(`Sending email reminder for ${item.documentCode}...`);
    try {
      const res = await clientApi<{ success: boolean; simulatedAlerts: any[] }>("/notifications/send-findings-alert", {
        method: "POST",
        body: JSON.stringify({ alertItems: [item] }),
      });
      if (res.success && res.simulatedAlerts.length > 0) {
        // Dispatch window events so floating SMTP alert toasts pop up
        res.simulatedAlerts.forEach(alert => {
          window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
        });
        showFeedback(`Sent ${res.simulatedAlerts.length} email reminder(s) for NCN ${item.documentCode}.`);
      } else {
        showFeedback(`Reminder sent for NCN ${item.documentCode}.`);
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Failed to send reminder: ${err.message || err.toString()}`);
    }
  };

  // Batch Email Reminder Dispatcher
  const handleSendBatchReminders = async () => {
    if (activeAlertsInView.length === 0) return;
    setIsSendingEmails(true);
    try {
      const res = await clientApi<{ success: boolean; simulatedAlerts: any[] }>("/notifications/send-findings-alert", {
        method: "POST",
        body: JSON.stringify({ alertItems: activeAlertsInView, customNote: batchCustomNote }),
      });
      if (res.success && res.simulatedAlerts.length > 0) {
        res.simulatedAlerts.forEach(alert => {
          window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
        });
        showFeedback(`Batch email scan complete! Dispatched ${res.simulatedAlerts.length} reminder notifications.`);
      } else {
        showFeedback("Batch email reminders processed successfully.");
      }
      setIsBatchEmailModalOpen(false);
      setBatchCustomNote("");
    } catch (err: any) {
      console.error(err);
      showFeedback(`Batch email error: ${err.message || err.toString()}`);
    } finally {
      setIsSendingEmails(false);
    }
  };

  // Modal Handlers
  const openEditModal = (item: FindingAlertItem) => {
    setEditModalAlertItem(item);
    setModalFinalDate(item.correctiveFinalDate || "");
    setModalFinalRemarks(item.correctiveFinalRemarks || "");
    setModalIsResolved(item.isResolved);
  };

  const closeEditModal = () => {
    setEditModalAlertItem(null);
  };

  const handleSaveModal = async () => {
    if (!editModalAlertItem) return;
    setIsSaving(true);

    try {
      // Find schedule
      const sched = schedules.find(s => s.id === editModalAlertItem.scheduleId);
      if (!sched) {
        showFeedback("Error: Associated Finding Schedule not found.");
        setIsSaving(false);
        return;
      }

      let rows: any[] = [];
      try {
        rows = typeof sched.scheduleRows === "string" ? JSON.parse(sched.scheduleRows) : sched.scheduleRows;
      } catch (e) {
        rows = [];
      }

      const idx = editModalAlertItem.rowIndex;
      if (rows[idx]) {
        rows[idx].correctiveFinalDate = modalFinalDate;
        rows[idx].correctiveFinalRemarks = modalFinalRemarks;

        if (modalIsResolved) {
          if (!rows[idx].correctiveFinalUser) {
            rows[idx].correctiveFinalUser = currentUser.name;
            rows[idx].correctiveFinalDatetime = new Date().toISOString();
          }
        } else {
          rows[idx].correctiveFinalUser = "";
          rows[idx].correctiveFinalDatetime = "";
        }
      }

      const updatedScheduleStr = JSON.stringify(rows);
      await clientApi<ExecutionSchedule>(`/execution-schedules/${sched.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduleRows: updatedScheduleStr }),
      });

      showFeedback("Finding row updated successfully.");

      // Refresh local schedules list
      const freshSchedules = await clientApi<ExecutionSchedule[]>("/execution-schedules");
      setSchedules(freshSchedules.filter((s) => s.language === "finding"));

      // Trigger global event so sidebar updates badge count immediately
      window.dispatchEvent(new Event("findings-updated"));
      
      closeEditModal();
    } catch (err: any) {
      console.error(err);
      showFeedback(`Update failed: ${err.message || err.toString()}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Options for toolbar filters
  const statusOptions = [
    { value: "ACTIVE", label: `Active Alerts (${counts.active})` },
    { value: "MISSING_FINAL_DATE", label: `Missing Final Date (${counts.missingFinalDate})` },
    { value: "PENDING_RESOLUTION", label: `Pending Resolution (${counts.pendingResolution})` },
  ];

  const projectOptions = projects.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }));

  const deptOptions = departments.map(d => ({ value: d.name, label: d.name }));

  const hasActiveFilters =
    activeTab !== "ALL" || projectFilter !== "ALL" || deptFilter !== "ALL" || searchQuery.trim() !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setActiveTab("ACTIVE");
    setProjectFilter("ALL");
    setDeptFilter("ALL");
    setSelectedGroupId(null);
  };

  const viewToggleClass = (active: boolean) =>
    `p-2 rounded transition-colors cursor-pointer ${
      active
        ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Findings Alerts</h1>
        <p className="text-xs text-muted-foreground">Track OE findings that still need a confirmed final corrective date or resolution.</p>
      </div>

      {/* Main list */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <ActionToolbar
          onView={selectedGroup ? () => setSelectedDrawerGroup(selectedGroup) : undefined}
          onRefresh={resetFilters}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder="Search alerts..."
          filterLabel="All Items"
          filterValue={activeTab}
          setFilterValue={(v) => setActiveTab(v as typeof activeTab)}
          filterOptions={statusOptions}
          extraFilters={[
            { label: "All Projects", value: projectFilter, setValue: setProjectFilter, options: projectOptions },
            { label: "All Departments", value: deptFilter, setValue: setDeptFilter, options: deptOptions },
          ]}
          extraControls={
            <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-3">
              <button type="button" onClick={() => setViewMode("TABLE")} className={viewToggleClass(viewMode === "TABLE")} title="Table View">
                <List className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setViewMode("CARDS")} className={viewToggleClass(viewMode === "CARDS")} title="Card Grid View">
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          }
          activeFilterCountLabel={hasActiveFilters ? "FILTERED" : "ALL"}
        />

        {viewMode === "TABLE" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                <tr>
                  <th className="px-6 py-4">OE Plan Code</th>
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Confirmed Final Corrective Date</th>
                  <th className="px-6 py-4">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {groupedAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                      No matching OE findings found. All findings meet the required date and resolution criteria for this filter.
                    </td>
                  </tr>
                ) : (
                  groupedAlerts.map((group) => (
                    <tr
                      key={group.scheduleId}
                      onClick={() => setSelectedGroupId(group.scheduleId === selectedGroupId ? null : group.scheduleId)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                        group.scheduleId === selectedGroupId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                      }`}
                    >
                      <td className="px-6 py-4.5 font-sans text-slate-700 dark:text-slate-300">
                        {projectCodeById[group.projectId] || "-"}
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupId(group.scheduleId);
                          setSelectedDrawerGroup(group);
                        }}
                        className="px-6 py-4.5 text-[#0066cc] font-medium hover:underline cursor-pointer"
                      >
                        {group.projectName}
                      </td>
                      <td className="px-6 py-4.5 text-slate-700 dark:text-slate-300 font-medium">
                        {group.departments || <span className="text-slate-400 italic font-normal">No department specified</span>}
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                          {group.missingFinalDateCount > 0 ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {group.missingFinalDateCount}/{group.totalRows} Date Pending
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              Dates Confirmed
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                          {group.isFullyResolved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              Completed
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {group.pendingResolutionCount}/{group.totalRows} Not Resolved
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
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-50/50 dark:bg-slate-950/30">
            {filteredAlerts.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 italic text-xs">
                No alert items found. All findings rows meet the required date and resolution criteria.
              </div>
            ) : (
              filteredAlerts.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {item.documentCode}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                        {item.alertType === "RESOLVED" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            Resolved
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {item.alertType === "MISSING_FINAL_DATE" ? "Missing Final Date" : "Pending Resolution"}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Project & Dept */}
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {projectCodeById[item.projectId] ? `${projectCodeById[item.projectId]} - ` : ""}{item.projectName}
                      </div>
                      {item.departments && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.departments}</div>
                      )}
                    </div>

                    {/* Activity */}
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {item.activity}
                    </p>

                    {/* Objective Badge */}
                    {item.objectives && (
                      <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                        Objective: {item.objectives}
                      </div>
                    )}

                    {/* Dates Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Target Action Date</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.correctiveActionDate || "Not set"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Corrective Final Date</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {item.correctiveFinalDate || <span className="text-slate-400 font-normal italic">Missing</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {!item.isResolved && (
                      <button
                        type="button"
                        onClick={() => handleSendSingleReminder(item)}
                        className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Send email reminder to department PIC"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Remind</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="flex-1 py-2 bg-[#05375c] hover:bg-[#074776] text-white font-bold text-xs rounded transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Update / Resolve
                    </button>

                    <Link
                      href={`/findings?scheduleId=${item.scheduleId}`}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded border border-slate-200 dark:border-slate-700 transition-colors"
                      title="Open full findings document"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Batch Email Reminders Dispatcher Modal */}
      {isBatchEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-500" />
                  Batch Send Email Reminders
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notify Department PICs for active NCN alert items in the current view.
                </p>
              </div>
              <button
                onClick={() => setIsBatchEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                    Target Action Items ({activeAlertsInView.length})
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">
                    Ready to Dispatch
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {activeAlertsInView.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 p-2 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{item.documentCode}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">({item.projectName})</span>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-xs">{item.activity}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        item.alertType === "MISSING_FINAL_DATE" 
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {item.alertType === "MISSING_FINAL_DATE" ? "Missing Final Date" : "Pending Resolution"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Note input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Custom OE Team Note / Instruction (Optional)
                </label>
                <textarea
                  rows={3}
                  value={batchCustomNote}
                  onChange={(e) => setBatchCustomNote(e.target.value)}
                  placeholder="e.g. Please expedite the corrective action entries prior to the end-of-month review..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsBatchEmailModalOpen(false)}
                disabled={isSendingEmails}
                className="px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBatchReminders}
                disabled={isSendingEmails}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl font-extrabold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isSendingEmails ? (
                  <span>Sending Reminders...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send All ({activeAlertsInView.length}) Reminders
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automated Reminder Schedule Modal */}
      {isScheduleConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-500" />
                  Automated Background Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure automated email reminder scans for unresolved NCNs.
                </p>
              </div>
              <button
                onClick={() => setIsScheduleConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Config Options */}
            <div className="space-y-4 text-xs">
              {/* Enable Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Enable Background Auto-Scan
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Automatically emails Department PICs for unresolved items.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoReminderEnabled}
                  onChange={(e) => setAutoReminderEnabled(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded-lg border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Frequency Selector */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Scan Frequency
                </label>
                <select
                  value={autoReminderFrequency}
                  onChange={(e) => setAutoReminderFrequency(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="daily">Daily Auto-Scan (Every morning at 08:00 AM)</option>
                  <option value="three_days">Every 3 Days Scan</option>
                  <option value="weekly">Weekly Summary Scan (Every Monday morning)</option>
                </select>
              </div>

              {/* Status Info Box */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 rounded-xl flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-[11px]">Last Auto-Scan Status</div>
                  <div className="text-[11px] opacity-90">
                    Last scan executed at <strong className="font-semibold">{lastAutoScanTime}</strong>. Next scheduled scan is active.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={async () => {
                  setLastAutoScanTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (Manual Trigger)");
                  showFeedback("Executing immediate automated background email scan...");
                  const res = await clientApi<{ success: boolean; simulatedAlerts: any[] }>("/notifications/send-findings-alert", {
                    method: "POST",
                    body: JSON.stringify({ alertItems: counts.active > 0 ? parseFindingAlerts(schedules).filter(i => !i.isResolved) : [] }),
                  });
                  if (res.simulatedAlerts.length > 0) {
                    res.simulatedAlerts.forEach(alert => {
                      window.dispatchEvent(new CustomEvent("send-simulated-email", { detail: alert }));
                    });
                    showFeedback(`Immediate scan complete! Sent ${res.simulatedAlerts.length} simulated email alerts.`);
                  } else {
                    showFeedback("Immediate scan complete. No active items required alerts.");
                  }
                }}
                className="px-3 py-2 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-xl font-bold text-[11px] transition-colors"
              >
                Run Scan Now
              </button>

              <button
                onClick={() => {
                  showFeedback("Saved automated scheduler configuration.");
                  setIsScheduleConfigOpen(false);
                }}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Save Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Modal (Update date/resolve) */}
      {editModalAlertItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  Update Corrective Final Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ref: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{editModalAlertItem.documentCode}</span> — {editModalAlertItem.projectName}
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              {/* Finding Item Preview */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                  Finding / Nonconformity Activity
                </div>
                <div className="text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
                  {editModalAlertItem.activity}
                </div>
                {editModalAlertItem.correctiveActionDate && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 mt-1">
                    Target Action Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{editModalAlertItem.correctiveActionDate}</span>
                  </div>
                )}
              </div>

              {/* Input: Corrective Final Date */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Corrective Final Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={modalFinalDate}
                  onChange={(e) => setModalFinalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Input: Final Verification Remarks */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Final Verification Remarks
                </label>
                <textarea
                  rows={3}
                  value={modalFinalRemarks}
                  onChange={(e) => setModalFinalRemarks(e.target.value)}
                  placeholder="Provide verification notes or OE sign-off remarks..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Resolution Sign-Off Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${modalIsResolved ? "text-emerald-500" : "text-slate-400"}`} />
                    Sign Off as Resolved
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {modalIsResolved ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Will record verification sign-off by <strong>{currentUser.name}</strong>.
                      </span>
                    ) : (
                      "Tick to finalize verification, sign off, and clear active alert status."
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={modalIsResolved}
                  onChange={(e) => setModalIsResolved(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded-lg border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={closeEditModal}
                disabled={isSaving}
                className="px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModal}
                disabled={isSaving}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl font-extrabold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save & Update Alert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Centered Dialog Modal for Viewing / Editing Settings */}
      {selectedDrawerGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
          {/* Click outside to close */}
          <div 
            className="absolute inset-0"
            onClick={() => setSelectedDrawerGroup(null)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-850 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-[10px] text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {selectedDrawerGroup.documentCode}
                  </span>
                  {/* <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    OE Finding Document
                  </span> */}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedDrawerGroup.projectName}
                </h3>
                {selectedDrawerGroup.departments && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Department: {selectedDrawerGroup.departments}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => setSelectedDrawerGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-8 bg-white dark:bg-slate-900">
              {/* Auto Schedule Section */}
              <div className="space-y-4">
                <div className="border-l-2 border-slate-900 dark:border-white pl-2.5">
                  <h4 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Auto Reminder Schedule
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {/* Configure automated notifications for NCN lines. */}
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Corrective Final Date Row */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Corrective Final Date:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={correctiveDays}
                        onChange={(e) => setCorrectiveDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-center font-mono text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all" 
                      />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 w-36">Days after Finding Released</span>
                    </div>
                  </div>

                  {/* Not Yet Resolve Row */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Not Yet Resolve:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={notResolvedDays}
                        onChange={(e) => setNotResolvedDays(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-12 h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-center font-mono text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all" 
                      />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 w-36">Days after Finding Released</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Trigger Section */}
              <div className="space-y-4 pt-1">
                <div className="border-l-2 border-slate-900 dark:border-white pl-2.5">
                  <h4 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Manual Trigger
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {/* Force scan notification dispatch override. */}
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        showFeedback("Manual trigger scan initiated.");
                      }}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-md transition-colors shadow-xs active:scale-98 cursor-pointer"
                    >
                      Trigger Schedule Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer / Save Area */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setSelectedDrawerGroup(null)}
                className="px-4 py-2 bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  showFeedback("Auto Schedule configuration updated.");
                  setSelectedDrawerGroup(null);
                }}
                className="px-4 py-2 bg-[#0066cc] hover:bg-[#004499] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
