"use client";

import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface MultiSelectProps {
  selectedValues: string[];
  onChange: (values: string[]) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  singleSelect?: boolean;
}

export default function MultiSelect({
  selectedValues = [],
  onChange,
  options,
  placeholder = "Select or type...",
  disabled = false,
  singleSelect = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
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

  const handleRemove = (valToRemove: string) => {
    onChange(selectedValues.filter((v) => v !== valToRemove));
  };

  const handleSelect = (val: string) => {
    if (singleSelect) {
      onChange([val]);
    } else if (!selectedValues.includes(val)) {
      onChange([...selectedValues, val]);
    }
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        if (singleSelect) {
          onChange([trimmed]);
        } else if (!selectedValues.includes(trimmed)) {
          onChange([...selectedValues, trimmed]);
        }
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && selectedValues.length > 0) {
      onChange(selectedValues.slice(0, -1));
    }
  };

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedValues.some(selected => selected.toLowerCase() === opt.value.toLowerCase())
  );

  const showAddCustom = 
    inputValue.trim() && 
    !options.some(opt => opt.value.toLowerCase() === inputValue.trim().toLowerCase()) &&
    !selectedValues.some(selected => selected.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      <div 
        onClick={() => {
          if (disabled) return;
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors ${
          disabled 
            ? "cursor-not-allowed opacity-60" 
            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus-within:bg-slate-100/80 dark:focus-within:bg-slate-800/60 cursor-text"
        }`}
      >
        {selectedValues.map((val) => (
          <span 
            key={val}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold select-none border ${
              disabled
                ? "bg-slate-200/40 dark:bg-slate-800/40 text-slate-550 dark:text-slate-400 border-slate-300/35 dark:border-slate-700/30"
                : "bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border-[#05375c]/20 dark:border-sky-500/20"
            }`}
          >
            {options.find(o => o.value === val || o.value.toLowerCase() === val.toLowerCase())?.label || val}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(val);
                }}
                className="text-[#05375c]/60 hover:text-[#05375c] dark:text-sky-300/60 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedValues.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent border-none p-0 focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-405 placeholder:text-xs font-semibold"
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg max-h-56 overflow-y-auto p-1.5 space-y-1 no-print">
          {showAddCustom && (
            <button
              type="button"
              onClick={() => handleSelect(inputValue.trim())}
              className="w-full text-left px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-[#0066cc] dark:text-sky-400 font-semibold rounded text-xs cursor-pointer"
            >
              + Add custom: <span className="font-bold">"{inputValue.trim()}"</span>
            </button>
          )}
          
          {filteredOptions.length === 0 && !showAddCustom ? (
            <div className="px-2.5 py-2 text-slate-400 italic text-xs">
              No users found. Press Enter to add custom.
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className="w-full text-left px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 flex flex-col transition-colors rounded cursor-pointer"
              >
                <span className="font-medium text-xs text-slate-800 dark:text-slate-200">{opt.label}</span>
                {opt.subLabel && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{opt.subLabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
