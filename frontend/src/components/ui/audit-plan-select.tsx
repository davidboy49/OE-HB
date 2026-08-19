"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import type { AuditProject } from "@auditdesk/shared";

interface AuditPlanSelectProps {
  projects: AuditProject[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function AuditPlanSelect({
  projects,
  selectedProjectId,
  onSelect,
  placeholder = "Choose Audit Plan...",
  disabled = false,
}: AuditPlanSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

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

  const filteredProjects = projects.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

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
          {selectedProject ? (
            <>
              <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                {selectedProject.code}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {selectedProject.name}
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
          {projects.length > 4 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or Name..."
                className="w-full bg-transparent border-none p-0 focus:outline-none text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                autoFocus
              />
            </div>
          )}

          <div className="overflow-y-auto max-h-52 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredProjects.length === 0 ? (
              <div className="p-3 text-slate-400 italic text-xs text-center">
                No matching Audit Plans found.
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="shrink-0 text-[11px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-2 py-0.5 rounded font-semibold select-none">
                        {p.code}
                      </span>
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {p.name}
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
