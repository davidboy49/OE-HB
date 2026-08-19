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
  Search,
  User as UserIcon,
  X,
  Edit3,
  Building,
  Briefcase,
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
  AlertCircle,
  Eye
} from "lucide-react";
import type { User, AuditProject, Department, ExecutionSchedule } from "@auditdesk/shared";
import { parseFindingAlerts, FindingAlertItem, groupFindingAlerts, GroupedFindingAlert } from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import MultiSelect from "@/components/ui/multi-select";

interface FindingsAlertsClientProps {
  initialSchedules: ExecutionSchedule[];
  projects: AuditProject[];
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
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string[]>(["ALL"]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string[]>(["ALL"]);
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

  // Filtered items
  const filteredAlerts = useMemo(() => {
    return allAlertItems.filter(item => {
      // Tab Filter
      if (activeTab === "ACTIVE" && item.isResolved) return false;
      if (activeTab === "MISSING_FINAL_DATE" && item.alertType !== "MISSING_FINAL_DATE") return false;
      if (activeTab === "PENDING_RESOLUTION" && item.alertType !== "PENDING_RESOLUTION") return false;

      // Project Filter
      if (selectedProjectFilter[0] && selectedProjectFilter[0] !== "ALL") {
        if (item.projectId !== selectedProjectFilter[0]) return false;
      }

      // Department Filter
      if (selectedDeptFilter[0] && selectedDeptFilter[0] !== "ALL") {
        if (!item.departments?.toLowerCase().includes(selectedDeptFilter[0].toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesActivity = item.activity.toLowerCase().includes(q);
        const matchesProject = item.projectName?.toLowerCase().includes(q);
        const matchesDoc = item.documentCode?.toLowerCase().includes(q);
        const matchesDept = item.departments?.toLowerCase().includes(q);
        const matchesConduct = item.conductBy?.toLowerCase().includes(q);
        if (!matchesActivity && !matchesProject && !matchesDoc && !matchesDept && !matchesConduct) {
          return false;
        }
      }

      return true;
    });
  }, [allAlertItems, activeTab, selectedProjectFilter, selectedDeptFilter, searchQuery]);

  // Slide-over Drawer state for viewing NCN items
  const [selectedDrawerGroup, setSelectedDrawerGroup] = useState<GroupedFindingAlert | null>(null);

  // Grouped finding alerts
  const groupedAlerts = useMemo(() => {
    return groupFindingAlerts(filteredAlerts);
  }, [filteredAlerts]);

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

  // Options for MultiSelect dropdowns
  const projectOptions = [
    { value: "ALL", label: "All Projects" },
    ...projects.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))
  ];

  const deptOptions = [
    { value: "ALL", label: "All Departments" },
    ...departments.map(d => ({ value: d.name, label: d.name }))
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-slide-in text-xs font-medium">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Findings Alerts
        </h1>
      </div>


      {/* Control Panel: Filter Tabs, Single-Select Dropdowns, View Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          {/* Segmented Tab Controller */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl text-xs font-semibold">
            {/* <button
              onClick={() => setActiveTab("ACTIVE")}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "ACTIVE"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Active Alerts ({counts.active})
            </button>
            <button
              onClick={() => setActiveTab("MISSING_FINAL_DATE")}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "MISSING_FINAL_DATE"
                  ? "bg-red-600 text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              }`}
            >
              Missing Final Date ({counts.missingFinalDate})
            </button>
            <button
              onClick={() => setActiveTab("PENDING_RESOLUTION")}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "PENDING_RESOLUTION"
                  ? "bg-amber-600 text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400"
              }`}
            >
              Pending Resolution ({counts.pendingResolution})
            </button> */}
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Items ({counts.total})
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 self-end lg:self-auto">
            <button
              onClick={() => setViewMode("TABLE")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "TABLE"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("CARDS")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "CARDS"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdowns & Search Inputs Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Audit Project Filter - Custom MultiSelect singleSelect */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Filter by OE Project
            </label>
            <MultiSelect
              options={projectOptions}
              selectedValues={selectedProjectFilter}
              onChange={setSelectedProjectFilter}
              singleSelect={true}
              placeholder="All Projects"
            />
          </div>

          {/* Department Filter - Custom MultiSelect singleSelect */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Filter by Department
            </label>
            <MultiSelect
              options={deptOptions}
              selectedValues={selectedDeptFilter}
              onChange={setSelectedDeptFilter}
              singleSelect={true}
              placeholder="All Departments"
            />
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Search Alert Items
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search activity, document code, objective..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data Render Area: Table View or Cards Grid View */}
      {viewMode === "TABLE" ? (
        <div className="overflow-hidden border border-[#0066cc] rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs bg-white dark:bg-slate-950">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-[#0066cc] font-bold text-slate-700 dark:text-slate-200">
                  <th className="px-4 py-3 w-[5%] text-center border-r border-[#0066cc]/30">No</th>
                  <th className="px-4 py-3 w-[25%] border-r border-[#0066cc]/30">OE Plan</th>
                  <th className="px-4 py-3 w-[30%] border-r border-[#0066cc]/30">Department of the OE Plan</th>
                  <th className="px-4 py-3 w-[18%] border-r border-[#0066cc]/30">Confirmed Final Corrective Date</th>
                  <th className="px-4 py-3 w-[12%] border-r border-[#0066cc]/30">Resolved</th>
                  <th className="px-4 py-3 w-[10%] text-center">Alert Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {groupedAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-70" />
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          No matching OE Findings found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                          All OE findings documents meet the required date and resolution criteria for this filter view.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedAlerts.map((group, idx) => (
                    <tr 
                      key={group.scheduleId}
                      className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* 1. No */}
                      <td className="px-4 py-3.5 text-center font-sans text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                        {idx + 1}
                      </td>

                      {/* 2. Audit Plan (Code & Project) */}
                      <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800 font-sans text-slate-800 dark:text-slate-200 font-semibold space-y-1">
                        <div className="flex items-center gap-2">
                        </div>
                        
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-1">
                          {/* <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" /> */}
                          <span className="truncate max-w-[200px]">{group.projectName}</span>
                        </div>
                      </td>

                      {/* 3. Department of the Audit Plan */}
                      <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800 space-y-1">
                        {group.departments ? (
                          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {/* <Building className="w-4 h-4 shrink-0 text-slate-400" /> */}
                            <span>{group.departments}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No department specified</span>
                        )}
                      </td>

                      {/* 4. Confirmed Final Corrective Date */}
                      <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {group.missingFinalDateCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg#F8FAFC text-red-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider border border-red-500/15">
                            <Clock className="w-3 h-3 text-red-500" />
                            {group.missingFinalDateCount}/{group.totalRows} Date Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/15">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Dates Confirmed
                          </span>
                        )}
                      </td>

                      {/* 5. Resolved */}
                      <td className="px-4 py-3.5 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {group.isFullyResolved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/15">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/15">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {group.pendingResolutionCount}/{group.totalRows} Not Resolved
                          </span>
                        )}
                      </td>

                      {/* 6. Status & Actions */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDrawerGroup(group)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#0066cc] text-white hover:bg-[#004499] text-[11px] font-bold rounded cursor-pointer transition-colors shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Settings</span>
                        </button>
                        {/* <Link
                          href={`/findings?scheduleId=${group.scheduleId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded transition-colors"
                          title="Open full schedule document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link> */}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70 mb-2" />
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No alert items found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">All audit findings rows meet required date and resolution criteria.</p>
            </div>
          ) : (
            filteredAlerts.map((item) => (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      {item.documentCode}
                    </span>

                    {item.alertType === "MISSING_FINAL_DATE" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 rounded-full">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                        Missing Final Date
                      </span>
                    )}

                    {item.alertType === "PENDING_RESOLUTION" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Pending Resolution
                      </span>
                    )}

                    {item.alertType === "RESOLVED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Resolved
                      </span>
                    )}
                  </div>

                  {/* Project & Dept */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.projectName}</span>
                    </div>
                    {item.departments && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{item.departments}</span>
                      </div>
                    )}
                  </div>

                  {/* Activity */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {item.activity}
                  </p>

                  {/* Objective Badge */}
                  {item.objectives && (
                    <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-md border border-amber-200/50 dark:border-amber-800/40">
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
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.correctiveFinalDate || <span className="text-red-500">Missing</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {!item.isResolved && (
                    <button
                      onClick={() => handleSendSingleReminder(item)}
                      className="px-2.5 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800/60 flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Send email reminder to department PIC"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Remind</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Update / Resolve
                  </button>
                  
                  <Link
                    href={`/findings?scheduleId=${item.scheduleId}`}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
                  Custom Audit Team Note / Instruction (Optional)
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
                  placeholder="Provide verification notes or audit sign-off remarks..."
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
