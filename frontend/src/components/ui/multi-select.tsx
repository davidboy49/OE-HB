"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

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
  compact?: boolean;
  /** Values shown as pills that can't be removed (e.g. inherited from a parent record). */
  lockedValues?: string[];
  /** Values whose pill carries an "added" indicator, with `highlightTitle` as its tooltip. */
  highlightedValues?: string[];
  highlightTitle?: string;
  /** Read-only without the faded look: when disabled, pills keep their normal colors. */
  plainWhenDisabled?: boolean;
}

export default function MultiSelect({
  selectedValues = [],
  onChange,
  options,
  placeholder = "Select or search...",
  disabled = false,
  singleSelect = false,
  compact = false,
  lockedValues = [],
  highlightedValues = [],
  highlightTitle,
  plainWhenDisabled = false,
}: MultiSelectProps) {
  const muted = disabled && !plainWhenDisabled;
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

  const isLocked = (val: string) => lockedValues.some((l) => l.toLowerCase() === val.toLowerCase());
  const isHighlighted = (val: string) => highlightedValues.some((h) => h.toLowerCase() === val.toLowerCase());

  const handleRemove = (valToRemove: string) => {
    if (isLocked(valToRemove)) return;
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

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedValues.some(selected => selected.toLowerCase() === opt.value.toLowerCase())
  );

  // Selection-only: typed text can only narrow the list, never become a value itself. Enter
  // picks the top match, same as clicking it - it never creates a value that isn't a real option.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value);
      }
    } else if (e.key === "Backspace" && !inputValue && selectedValues.length > 0) {
      const last = selectedValues[selectedValues.length - 1];
      if (!isLocked(last)) onChange(selectedValues.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      <div 
        onClick={() => {
          if (disabled) return;
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center rounded-md transition-colors ${
          compact ? "h-8 justify-between gap-2 px-2.5" : "flex-wrap gap-1.5 px-2 py-1.5"
        } ${
          disabled
            ? (muted ? "cursor-not-allowed opacity-60" : "cursor-default")
            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 focus-within:bg-slate-100/80 dark:focus-within:bg-slate-800/60 cursor-text"
        }`}
      >
        {compact && singleSelect ? (
          <>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {options.find((option) => option.value === selectedValues[0])?.label || placeholder}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </>
        ) : selectedValues.map((val) => (
          <span 
            key={val}
            title={isHighlighted(val) ? highlightTitle : undefined}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold select-none border ${
              muted
                ? "bg-slate-200/40 dark:bg-slate-800/40 text-slate-550 dark:text-slate-400 border-slate-300/35 dark:border-slate-700/30"
                : isHighlighted(val)
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  : "bg-[#05375c]/10 dark:bg-sky-500/10 text-[#05375c] dark:text-sky-300 border-[#05375c]/20 dark:border-sky-500/20"
            }`}
          >
            {isHighlighted(val) && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />}
            {options.find(o => o.value === val || o.value.toLowerCase() === val.toLowerCase())?.label || val}
            {!disabled && !isLocked(val) && (
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
        {!compact && !disabled && (
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
        <div className={`absolute left-0 right-0 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg max-h-56 overflow-y-auto p-1.5 space-y-1 no-print ${
          compact ? "bottom-full mb-1.5" : "mt-1.5"
        }`}>
          {filteredOptions.length === 0 ? (
            <div className="px-2.5 py-2 text-slate-400 italic text-xs">
              No matches found.
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
