"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import type { ExecutionSchedule as FindingReport, AuditProject } from "@auditdesk/shared";

interface ExecScheduleSelectProps {
  schedules: FindingReport[];
  projects: AuditProject[];
  selectedExecScheduleId: string;
  onSelect: (scheduleId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ExecScheduleSelect({
  schedules,
  projects,
  selectedExecScheduleId,
  onSelect,
  placeholder = "Choose Released Execution Schedule...",
  disabled = false,
}: ExecScheduleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSchedule = schedules.find((s) => s.id === selectedExecScheduleId);
  const selectedProject = selectedSchedule
    ? projects.find((p) => p.id === selectedSchedule.projectId)
    : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredSchedules = schedules.filter((s) => {
    const project = projects.find((p) => p.id === s.projectId);
    const text = `${s.projectCode || ""} ${project?.name || ""} ${s.departments || ""} ${s.actualVisitDate || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 rounded-md transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden me-2">
          {selectedSchedule ? (
            <>
              <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                {selectedSchedule.projectCode || selectedProject?.code}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {selectedProject?.name || "Unknown Audit Plan"}
              </span>
              <span className="text-slate-550 dark:text-slate-400 shrink-0">
                — {selectedSchedule.departments} ({selectedSchedule.actualVisitDate})
              </span>
            </>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden max-h-64 flex flex-col no-print">
          {schedules.length > 4 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schedule, ID or Audit Plan..."
                className="w-full bg-transparent border-none p-0 focus:outline-none text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                autoFocus
              />
            </div>
          )}

          <div className="overflow-y-auto max-h-52 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredSchedules.length === 0 ? (
              <div className="p-3 text-slate-400 italic text-xs text-center">
                No matching Execution Schedules found.
              </div>
            ) : (
              filteredSchedules.map((s) => {
                const project = projects.find((p) => p.id === s.projectId);
                const isSelected = s.id === selectedExecScheduleId;
                const isClosed = project?.status === "CLOSED";
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isClosed}
                    onClick={() => {
                      onSelect(s.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isClosed
                        ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40"
                        : isSelected
                        ? "bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 cursor-pointer"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                        {s.projectCode || project?.code}
                      </span>
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {project?.name || "Unknown Audit Plan"}
                      </span>
                      <span className="text-slate-550 dark:text-slate-400 truncate font-medium">
                        — {s.departments} ({s.actualVisitDate})
                        {isClosed && " - Audit Plan closed; reopen it first"}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
