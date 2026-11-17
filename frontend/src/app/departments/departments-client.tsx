"use client";

import { useState } from "react";
import { 
  Building2, 
  Plus, 
  Lock,
  X,
  Pencil,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { User, Department, UserGroup, BusinessUnit } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import MultiSelect from "@/components/ui/multi-select";
import TablePagination, { useClientPagination } from "@/components/ui/table-pagination";
import { SortableTh, useTableSort } from "@/components/ui/sortable-header";

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

  const openEditModal = (id: string | null = selectedDeptId) => {
    if (!id) return;
    const dept = departments.find(d => d.id === id);
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

  const tableSort = useTableSort(filteredDepartments, {
    code: (d) => d.code,
    businessUnit: (d) => d.businessUnitName,
    description: (d) => d.description || d.name,
    status: (d) => (d.isActive === false ? "Inactive" : "Active"),
  });
  const pagination = useClientPagination(
    tableSort.sorted,
    "departments-page-size",
    `${searchQuery}|${buFilter}|${statusFilter}|${tableSort.id}`,
  );
  const selectedDept = departments.find(d => d.id === selectedDeptId);
  // A department already in a Business Unit stays there (legacy rows with none can still be assigned)
  const buLocked = modalMode === "edit" && !!selectedDept?.businessUnitId;

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
          onEdit={canEdit && selectedDeptId ? () => openEditModal() : undefined}
          onToggleActive={canEdit && selectedDeptId ? handleToggleActive : undefined}
          toggleActiveLabel={selectedDept?.isActive === false ? "Reactivate Department" : "Deactivate Department"}
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

        {/* Table roster */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
              <tr>
                <SortableTh label="Code" sortKey="code" sort={tableSort.sort} onSort={tableSort.toggle} />
                <SortableTh label="Business Unit" sortKey="businessUnit" sort={tableSort.sort} onSort={tableSort.toggle} />
                <SortableTh label="Description" sortKey="description" sort={tableSort.sort} onSort={tableSort.toggle} />
                <SortableTh label="Status" sortKey="status" sort={tableSort.sort} onSort={tableSort.toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                    No departments found.
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((dept) => (
                  <tr
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id === selectedDeptId ? null : dept.id)}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                      dept.id === selectedDeptId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                    }`}
                  >
                    <td
                      onClick={(e) => {
                        if (!canEdit) return;
                        e.stopPropagation();
                        setSelectedDeptId(dept.id);
                        openEditModal(dept.id);
                      }}
                      className={`px-6 py-4.5 font-medium text-[#0066cc] ${canEdit ? "hover:underline cursor-pointer" : ""}`}
                    >
                      {dept.code}
                    </td>
                    <td className="px-6 py-4.5 text-slate-600 dark:text-slate-400">
                      {dept.businessUnitName || <span className="italic text-amber-600">Not assigned</span>}
                    </td>
                    <td className="px-6 py-4.5 text-slate-700 dark:text-slate-300">
                      {dept.description || dept.name}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                        {dept.isActive === false ? (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            Inactive
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            Active
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
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          emptyLabel="No departments found"
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />

      </div>

      {/* CREATE/EDIT Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-sans text-slate-400 font-bold uppercase">Department</div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {modalMode === "create" ? "New Department" : `Edit ${deptIdInput}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Code</label>
                <input
                  type="text"
                  required
                  disabled={modalMode === "edit"}
                  value={deptIdInput}
                  maxLength={3}
                  onChange={(e) => setDeptIdInput(e.target.value.slice(0, 3))}
                  placeholder="e.g. FIN (max 3 characters)"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#05375c] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Business Unit</label>
                {buLocked ? (
                  <div className="flex items-center gap-2 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-200 opacity-60 cursor-not-allowed">
                    <Lock className="w-3 h-3 text-slate-400" />
                    {businessUnits.find((b) => b.id === deptBuInput)?.name || "-"}
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded">
                    <MultiSelect
                      selectedValues={deptBuInput ? [deptBuInput] : []}
                      onChange={(values) => setDeptBuInput(values[0] || "")}
                      singleSelect={true}
                      options={businessUnits.map((b) => ({ value: b.id, label: b.name, subLabel: b.description || undefined }))}
                      placeholder="Select Business Unit..."
                    />
                  </div>
                )}
                {buLocked && (
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Code and Business Unit can't be changed after creation. To move a department, create it in the other Business Unit and deactivate this one.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Description</label>
                <input
                  type="text"
                  required
                  value={deptDescInput}
                  onChange={(e) => setDeptDescInput(e.target.value)}
                  placeholder="e.g. Finance"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#05375c]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer"
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
