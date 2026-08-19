"use client";

import { useState, useEffect } from "react";
import { Search, History, User, Trash2, Plus, X, Save, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/apiClient";

interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

interface LogsClientProps {
  initialLogs: ActivityLog[];
  currentUser: any;
}

export default function LogsClient({ initialLogs, currentUser }: LogsClientProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Add modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customAction, setCustomAction] = useState("MANUAL_LOG");
  const [customDetails, setCustomDetails] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Keep logs state synchronized when server props change
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === "ALL" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);
  const visibleStart = filteredLogs.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = Math.min(startIndex + pageSize, filteredLogs.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes("CREATE")) return "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400";
    if (action.includes("DELETE")) return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";
    if (action.includes("UPDATE")) return "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";
    return "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400";
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAction || !customDetails) return;
    
    await clientApi("/activity-logs", {
      method: "POST",
      body: JSON.stringify({
        action: customAction.toUpperCase().replace(/\s+/g, "_"),
        details: customDetails,
      }),
    });
    setCustomAction("MANUAL_LOG");
    setCustomDetails("");
    setIsAddModalOpen(false);
    router.refresh();
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const handleDeleteLog = (id: string) => {
    showConfirm(
      "Confirm Log Deletion",
      "Are you sure you want to permanently delete this activity log from the system? This action is irreversible.",
      async () => {
        const success = await clientApi<boolean>(`/activity-logs/${id}`, { method: "DELETE" });
        if (success) {
          router.refresh();
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-850 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-[#05375c] dark:text-sky-400" />
            <span>Identity & Audit Action Logs</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Administrative record of all state mutations and resource creations executed by authenticated users.
          </p>
        </div>
        
        {/* Add Manual Log Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#05375c] hover:bg-[#074776] text-white text-xs font-bold rounded cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Log Entry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs by user, action, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0066cc]/45 focus:border-[#0066cc]/60 transition-all text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Action Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-sans text-slate-400 uppercase font-bold shrink-0">Action Type:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0066cc]/45 cursor-pointer font-sans"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
              <tr>
                <th className="px-6 py-4 w-48">Timestamp</th>
                <th className="px-6 py-4 w-60">Executed By</th>
                <th className="px-6 py-4 w-44">Action Code</th>
                <th className="px-6 py-4">Mutation Details</th>
                <th className="px-6 py-4 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No actions logged matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors align-top">
                    {/* Timestamp */}
                    <td className="px-6 py-4 font-sans text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-555" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{log.userName}</span>
                          <span className="text-[10px] text-slate-400 truncate">{log.userEmail}</span>
                        </div>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="px-6 py-4 leading-relaxed text-slate-700 dark:text-slate-350">
                      {log.details}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{visibleStart}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{visibleEnd}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{filteredLogs.length}</span> logs
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="min-w-20 text-center text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      {/* Add Log Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 flex justify-center items-center z-[100] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-slide-up flex flex-col">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Add Manual Activity Log</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddLog} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase mb-1.5">Action Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SYSTEM_MAINTENANCE"
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0066cc]/45 focus:border-[#0066cc]/60 text-slate-850 dark:text-slate-100 uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-slate-400 uppercase mb-1.5">Mutation Details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide detailed description of the administrative mutation..."
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0066cc]/45 focus:border-[#0066cc]/60 text-slate-850 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] hover:bg-[#074776] text-white text-xs font-bold rounded cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Alert Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 flex justify-center items-center z-[1000] p-4 animate-fade-in">
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
