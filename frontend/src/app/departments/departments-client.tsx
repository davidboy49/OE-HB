"use client";

import { useState } from "react";
import { 
  Building2, 
  Plus, 
  Lock,
  X,
  Pencil,
  Trash2
} from "lucide-react";
import type { User, Department, UserGroup } from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";

interface DepartmentsClientProps {
  initialUsers: User[];
  initialDepartments: Department[];
  initialUserGroups: UserGroup[];
  currentUser: User;
}

export default function DepartmentsClient({ 
  initialUsers, 
  initialDepartments, 
  initialUserGroups, 
  currentUser 
}: DepartmentsClientProps) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [deptIdInput, setDeptIdInput] = useState("");
  const [deptDescInput, setDeptDescInput] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  const canCreate = RBAC.can(currentUser, "departments:create");
  const canEdit = RBAC.can(currentUser, "departments:update");
  const canDelete = RBAC.can(currentUser, "departments:delete");

  const openCreateModal = () => {
    setModalMode("create");
    setDeptIdInput("");
    setDeptDescInput("");
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedDeptId) return;
    const dept = departments.find(d => d.id === selectedDeptId);
    if (!dept) return;

    setModalMode("edit");
    setDeptIdInput(dept.id);
    setDeptDescInput(dept.description || "");
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptIdInput.trim() || !deptDescInput.trim()) return;

    const formattedId = deptIdInput.trim().toUpperCase();
    const description = deptDescInput.trim();

    try {
      if (modalMode === "create") {
        // Check for duplicates
        if (departments.some(d => d.id === formattedId)) {
          showFeedback(`Error: Department with ID "${formattedId}" already exists.`);
          return;
        }
        const newDept = await clientApi<Department>("/departments", {
          method: "POST",
          body: JSON.stringify({ id: formattedId, name: description, description }),
        });
        if (newDept) {
          setDepartments([...departments, newDept]);
          setIsModalOpen(false);
          setSelectedDeptId(newDept.id);
          showFeedback(`Department "${formattedId}" created successfully.`);
        }
      } else {
        if (!selectedDeptId) return;
        const updated = await clientApi<Department>(`/departments/${selectedDeptId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: description, description }),
        });
        if (updated) {
          setDepartments(departments.map(d => d.id === selectedDeptId ? updated : d));
          setIsModalOpen(false);
          showFeedback(`Department "${selectedDeptId}" updated successfully.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDeptId) return;
    const dept = departments.find(d => d.id === selectedDeptId);
    if (!dept) return;

    const confirmDel = window.confirm(`Are you sure you want to delete department "${dept.id}"? This will unassign all users currently mapped to this department.`);
    if (!confirmDel) return;

    try {
      const success = await clientApi<boolean>(`/departments/${selectedDeptId}`, { method: "DELETE" });
      if (success) {
        setDepartments(departments.filter(d => d.id !== selectedDeptId));
        setSelectedDeptId(null);
        showFeedback(`Department "${dept.id}" has been deleted.`);
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
  const filteredDepartments = departments.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const roleFilterOptions = [
    { label: "Admin", value: "ADMIN" },
    { label: "Lead Auditor", value: "LEAD_AUDITOR" },
    { label: "Auditor", value: "AUDITOR" },
    { label: "Auditee", value: "AUDITEE" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Department List</h1>
        <div className="h-px bg-slate-200 dark:bg-slate-800 w-full mt-2" />
      </div>

      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Table & Toolbar Area */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        
        {/* ActionToolbar */}
        <ActionToolbar
          onCreate={canCreate ? openCreateModal : undefined}
          onEdit={canEdit && selectedDeptId ? openEditModal : undefined}
          onDelete={canDelete && selectedDeptId ? handleDeleteDepartment : undefined}
          onRefresh={() => {
            setSearchQuery("");
            setRoleFilter("ALL");
            setSelectedDeptId(null);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder="Search users..."
          filterLabel="Role"
          filterValue={roleFilter}
          setFilterValue={setRoleFilter}
          filterOptions={roleFilterOptions}
          activeFilterCountLabel={roleFilter === "ALL" ? "ALL" : "FILTERED"}
        />

        {/* Table roster */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 uppercase font-sans font-bold">
              <tr>
                <th className="px-12 py-4 w-1/4">ID</th>
                <th className="px-12 py-4 w-3/4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {filteredDepartments.map((dept) => {
                return (
                  <tr 
                    key={dept.id} 
                    onClick={() => setSelectedDeptId(dept.id === selectedDeptId ? null : dept.id)}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                      dept.id === selectedDeptId ? "bg-slate-100 dark:bg-slate-800/50 font-medium" : ""
                    }`}
                  >
                    <td className="px-12 py-5 font-semibold text-slate-800 dark:text-slate-200">
                      {dept.id}
                    </td>
                    <td className="px-12 py-5 text-slate-600 dark:text-slate-300">
                      {dept.description || dept.name}
                    </td>
                  </tr>
                );
              })}
              {filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-12 py-8 text-center text-slate-400 font-sans text-xs">
                    No departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* CREATE/EDIT Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-850">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-wider text-[#05375c] dark:text-accent font-sans">
                <span className="uppercase text-xs font-sans font-bold text-slate-500 mr-1.5">CREATE NEW</span>
                <span className="text-slate-800 dark:text-slate-100">Department</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDepartment} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-lg font-semibold text-slate-800 dark:text-slate-200">ID</label>
                <input
                  type="text"
                  required
                  disabled={modalMode === "edit"}
                  value={deptIdInput}
                  onChange={(e) => setDeptIdInput(e.target.value)}
                  placeholder="e.g. FIN"
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#05375c] text-slate-800 dark:text-slate-250 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-lg font-semibold text-slate-800 dark:text-slate-200">Description</label>
                <input
                  type="text"
                  required
                  value={deptDescInput}
                  onChange={(e) => setDeptDescInput(e.target.value)}
                  placeholder="e.g. Finance"
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#05375c] text-slate-800 dark:text-slate-250"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
