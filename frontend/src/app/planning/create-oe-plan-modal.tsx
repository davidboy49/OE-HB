"use client";

import { Save, X } from "lucide-react";
import type { AnnualPlan, Project, User } from "@oeportal/shared";
import MultiSelect from "@/components/ui/multi-select";

interface CreateOePlanModalProps {
  isCopying: boolean;
  users: User[];
  annualPlans?: AnnualPlan[];
  /** The Projects a new Individual OE Plan can be created from (formerly "Planned Engagements"). */
  projects?: Project[];
  newStart: string;
  setNewStart: (value: string) => void;
  newEnd: string;
  setNewEnd: (value: string) => void;
  newLeads: string[];
  setNewLeads: (value: string[]) => void;
  newAnnualPlanId: string;
  setNewAnnualPlanId: (value: string) => void;
  newProjectId: string;
  setNewProjectId: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * The "Create Individual OE Plan" / "Copy Individual OE Plan" modal, split out of
 * planning-client.tsx. Purely presentational - all state lives in the parent, which also owns
 * validation and the actual create/copy request; this only renders the form and reports
 * changes back up.
 */
export default function CreateOePlanModal({
  isCopying,
  users,
  annualPlans,
  projects,
  newStart,
  setNewStart,
  newEnd,
  setNewEnd,
  newLeads,
  setNewLeads,
  newAnnualPlanId,
  setNewAnnualPlanId,
  newProjectId,
  setNewProjectId,
  onClose,
  onSubmit,
}: CreateOePlanModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
      onClick={onClose}
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
              onClick={onClose}
              className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 rounded cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form with Word Document table styling */}
        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <div className="overflow-visible border border-slate-300 dark:border-slate-800 rounded-md">
            <table className="w-full border-collapse text-xs">
              <tbody>
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

                {/* Row 4: OE Leader */}
                <tr className="border-b border-slate-300 dark:border-slate-800/80">
                  <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                    OE Leader:
                  </td>
                  <td colSpan={3} className="px-4 py-2">
                    <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                      <MultiSelect
                        selectedValues={newLeads}
                        onChange={setNewLeads}
                        options={users.map((u) => ({
                          value: u.name,
                          label: u.name,
                          subLabel: u.departmentName ?? '',
                        }))}
                        placeholder="Select OE Leaders..."
                      />
                    </div>
                  </td>
                </tr>

                {/* Row 6: Annual Plan Master */}
                <tr className="border-b border-slate-300 dark:border-slate-800/80">
                  <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                    Annual OE Plan:
                  </td>
                  <td colSpan={3} className="px-4 py-2">
                    <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                      <MultiSelect
                        selectedValues={newAnnualPlanId ? [newAnnualPlanId] : []}
                        onChange={(values) => {
                          const chosenVal = values.length > 0 ? values[0] : "";
                          const match = annualPlans?.find(p => p.id === chosenVal || p.planName === chosenVal);
                          setNewAnnualPlanId(match ? match.id : chosenVal);
                          setNewProjectId(""); // Reset OE plan when annual plan changes
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

                {/* Row 7: OE Plan */}
                <tr className="border-b border-slate-300 dark:border-slate-800/80">
                  <td className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 font-bold border-r border-slate-300 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                    Project Name*:
                  </td>
                  <td colSpan={3} className="px-4 py-2">
                    <div className="border border-slate-300 dark:border-slate-700 rounded-md">
                      <MultiSelect
                        selectedValues={newProjectId ? [newProjectId] : []}
                        onChange={(values) => {
                          setNewProjectId(values.length > 0 ? values[0] : "");
                        }}
                        singleSelect={true}
                        disabled={!newAnnualPlanId}
                        options={(() => {
                          const filtered = projects?.filter(p => p.annualPlanId === newAnnualPlanId && !p.isUsed) || [];
                          if (newProjectId && !filtered.some(p => p.id === newProjectId)) {
                            const target = projects?.find(p => p.id === newProjectId);
                            if (target) filtered.push(target);
                          }
                          return filtered.map(p => ({
                            value: p.id,
                            label: p.projectName || p.topic,
                            subLabel: `${p.topic} - ${p.version || "V1"}${p.isApproved ? "" : " (Draft)"}`
                          }));
                        })()}
                        placeholder={newAnnualPlanId ? "Select Project Name..." : "Please select an Annual OE Plan first..."}
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
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded cursor-pointer text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> {isCopying ? "Create Copy" : "Create Individual OE Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
