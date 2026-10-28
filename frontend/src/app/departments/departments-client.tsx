"use client";

import { useState } from "react";
import { 
  Building2, 
  Plus, 
  Lock,
  X,
  Pencil,
  Power
} from "lucide-react";
import type { User, Department, UserGroup, BusinessUnit } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import MultiSelect from "@/components/ui/multi-select";

interface DepartmentsClientProps {
  initialUsers: User[];
  initialDepartments: Department[];
  businessUnits: BusinessUnit[];
  initialUserGroups: UserGroup[];
  currentUser: User;
}

export default function DepartmentsClient({ 
  initialUsers, 
  initialDepartments,
  businessUnits,
  initialUserGroups, 
  currentUser 
}: DepartmentsClientProps) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [buFilter, setBuFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [deptIdInput, setDeptIdInput] = useState("");
  const [deptDescInput, setDeptDescInput] = useState("");
  const [deptBuInput, setDeptBuInput] = useState(""); // Business Unit id - every department belongs to one

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  const canCreate = RBAC.can(currentUser, "departments:create");
  const canEdit = RBAC.can(currentUser, "departments:update");

  const openCreateModal = () => {
    setModalMode("create");
    setDeptIdInput("");
    setDeptDescInput("");
    setDeptBuInput("");
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedDeptId) return;
    const dept = departments.find(d => d.id === selectedDeptId);
    if (!dept) return;

    setModalMode("edit");
    setDeptIdInput(dept.code);
    setDeptDescInput(dept.description || "");
    setDeptBuInput(dept.businessUnitId || "");
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptIdInput.trim() || !deptDescInput.trim()) return;
    if (!deptBuInput) {
      showFeedback("Error: Please select the Business Unit this department belongs to.");
      return;
    }

    const formattedCode = deptIdInput.trim().toUpperCase();
    const description = deptDescInput.trim();

    try {
      if (modalMode === "create") {
        // Codes only need to be unique within a Business Unit
        if (departments.some(d => d.code === formattedCode && d.businessUnitId === deptBuInput)) {
          showFeedback(`Error: Department "${formattedCode}" already exists in this Business Unit.`);
          return;
        }
        const newDept = await clientApi<Department>("/departments", {
          method: "POST",
          body: JSON.stringify({ code: formattedCode, name: description, description, businessUnitId: deptBuInput }),
        });
        if (newDept) {
          setDepartments([...departments, newDept]);
          setIsModalOpen(false);
          setSelectedDeptId(newDept.id);
          showFeedback(`Department "${formattedCode}" created successfully.`);
        }
      } else {
        if (!selectedDeptId) return;
        const updated = await clientApi<Department>(`/departments/${selectedDeptId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: description, description, businessUnitId: deptBuInput }),
        });
        if (updated) {
          setDepartments(departments.map(d => d.id === selectedDeptId ? updated : d));
          setIsModalOpen(false);
          showFeedback(`Department "${updated.code}" updated successfully.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedDeptId) return;
    const dept = departments.find(d => d.id === selectedDeptId);
    if (!dept) return;

    const makeActive = dept.isActive === false;
    if (!makeActive && !window.confirm(`Deactivate department "${dept.code}"? It stays on existing records but can't be picked for new ones.`)) return;

    try {
      const updated = await clientApi<Department>(`/departments/${selectedDeptId}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: makeActive }),
      });
      if (updated) {
        setDepartments(departments.map(d => d.id === selectedDeptId ? updated : d));
        showFeedback(`Department "${dept.code}" ${makeActive ? "reactivated" : "deactivated"}.`);
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`Error: ${err.message || err.toString()}`);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Filter logic
  const filteredDepartments = departments.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBu = buFilter === "ALL" || d.businessUnitId === buFilter;
    const matchesStatus =
      statusFilter === "ALL" || (statusFilter === "INACTIVE" ? d.isActive === false : d.isActive !== false);
    return matchesSearch && matchesBu && matchesStatus;
  });

  const buFilterOptions = businessUnits.map(b => ({ label: b.name, value: b.id }));
  const statusFilterOptions = [
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" }
  ];
  const activeFilterCount = [buFilter, statusFilter].filter(v => v !== "ALL").length;

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
          onRefresh={() => {
            setSearchQuery("");
            setBuFilter("ALL");
            setStatusFilter("ALL");
            setSelectedDeptId(null);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchPlaceholder="Search departments..."
          filterLabel="Business Unit"
          filterValue={buFilter}
          setFilterValue={setBuFilter}
          filterOptions={buFilterOptions}
          extraFilters={[{ label: "Status", value: statusFilter, setValue: setStatusFilter, options: statusFilterOptions }]}
          activeFilterCountLabel={activeFilterCount === 0 ? "ALL" : `${activeFilterCount} FILTERED`}
        />

        {canEdit && selectedDeptId && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={handleToggleActive}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#05375c] dark:text-accent hover:underline cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />{" "}
              {departments.find(d => d.id === selectedDeptId)?.isActive === false ? "Reactivate Selected Department" : "Deactivate Selected Department"}
            </button>
          </div>
        )}

        {/* Table roster */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 uppercase font-sans font-bold">
              <tr>
                <th className="px-12 py-4 w-1/5">Code</th>
                <th className="px-12 py-4 w-1/4">Business Unit</th>
                <th className="px-12 py-4 w-1/3">Description</th>
                <th className="px-12 py-4 w-1/6">Status</th>
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
                      {dept.code}
                    </td>
                    <td className="px-12 py-5 text-slate-600 dark:text-slate-300">
                      {dept.businessUnitName || <span className="italic text-amber-600">Not assigned</span>}
                    </td>
                    <td className="px-12 py-5 text-slate-600 dark:text-slate-300">
                      {dept.description || dept.name}
                    </td>
                    <td className="px-12 py-5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        dept.isActive === false
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }`}>
                        {dept.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-12 py-8 text-center text-slate-400 font-sans text-xs">
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
                <label className="text-lg font-semibold text-slate-800 dark:text-slate-200">Code</label>
                <input
                  type="text"
                  required
                  disabled={modalMode === "edit"}
                  value={deptIdInput}
                  maxLength={3}
                  onChange={(e) => setDeptIdInput(e.target.value.slice(0, 3))}
                  placeholder="e.g. FIN (max 3 characters)"
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#05375c] text-slate-800 dark:text-slate-250 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-lg font-semibold text-slate-800 dark:text-slate-200">Business Unit *</label>
                <div className="border border-slate-200 dark:border-slate-700 rounded">
                  <MultiSelect
                    selectedValues={deptBuInput ? [deptBuInput] : []}
                    onChange={(values) => setDeptBuInput(values[0] || "")}
                    singleSelect={true}
                    options={businessUnits.map((b) => ({ value: b.id, label: b.name, subLabel: b.description || undefined }))}
                    placeholder="Select Business Unit..."
                  />
                </div>
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
