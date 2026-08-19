"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ScheduleRowSelectProps {
  rows: any[];
  selectedRowIndex: number;
  onSelect: (index: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ScheduleRowSelect({
  rows,
  selectedRowIndex,
  onSelect,
  placeholder = "Choose Linked Execution Schedule Row...",
  disabled = false,
}: ScheduleRowSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRow = selectedRowIndex !== undefined && selectedRowIndex !== -1 ? rows[selectedRowIndex] : null;

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
          {selectedRow ? (
            <>
              <span className="shrink-0 text-[10px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-1.5 py-0.5 rounded font-semibold select-none">
                {selectedRow.date} {selectedRow.time || ""}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {selectedRow.activity.replace(/<[^>]*>/g, '')}
              </span>
            </>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-[100] bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-md shadow-lg max-h-56 overflow-y-auto p-1.5 space-y-1 no-print animate-in fade-in duration-100">
          {rows.length === 0 ? (
            <div className="px-2.5 py-2 text-slate-400 italic text-xs">
              No schedule rows found.
            </div>
          ) : (
            rows.map((r, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelect(idx);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between text-left px-2.5 py-2 rounded transition-colors text-xs cursor-pointer ${
                  idx === selectedRowIndex
                    ? "bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 font-bold"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-[10px] font-mono bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border border-[#05375c]/20 dark:border-sky-500/20 px-1.5 py-0.5 rounded font-semibold select-none">
                    {r.date} {r.time || ""}
                  </span>
                  <span className="truncate">{r.activity.replace(/<[^>]*>/g, '')}</span>
                </div>
                {idx === selectedRowIndex && <Check className="w-3.5 h-3.5 text-[#05375c] dark:text-sky-300 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
