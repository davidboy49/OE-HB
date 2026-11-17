"use client";

import { useEffect, useState } from "react";
import MultiSelect from "@/components/ui/multi-select";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const readSavedPageSize = (storageKey: string): number | null => {
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

const savePageSize = (storageKey: string, size: number) => {
  try {
    window.localStorage.setItem(storageKey, String(size));
  } catch {
    // Storage blocked (private window etc.) - the size just won't be remembered.
  }
};

/** Page size state that remembers the user's "Rows" choice per list in localStorage. */
export function usePageSize(storageKey: string, initial = 10) {
  const [pageSize, setPageSizeState] = useState(initial);

  useEffect(() => {
    const saved = readSavedPageSize(storageKey);
    if (saved && saved !== pageSize) setPageSizeState(saved);
    // Read once on mount; localStorage is not available during server render.
  }, [storageKey]);

  const setPageSize = (size: number) => {
    savePageSize(storageKey, size);
    setPageSizeState(size);
  };

  return [pageSize, setPageSize] as const;
}

/**
 * Pages a list that is already loaded and filtered in the browser. `resetKey` should change
 * whenever the search/filter changes, which sends the user back to page 1.
 */
export function useClientPagination<T>(items: T[], storageKey: string, resetKey: string) {
  const [pageSize, setPageSize] = usePageSize(storageKey);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  // Deleting the last row on the last page would otherwise leave the user on an empty page.
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { pageItems, page: currentPage, setPage, pageSize, setPageSize, totalItems, totalPages };
}

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

/** The footer under a list table: "Showing x-y of n", Rows per page, Previous / Next. */
export default function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  emptyLabel = "No records found",
}: TablePaginationProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
      <span>
        {totalItems === 0
          ? emptyLabel
          : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalItems)} of ${totalItems}`}
      </span>
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-600 dark:text-slate-300">Rows</span>
          <div className="w-16 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
            <MultiSelect
              singleSelect={true}
              compact={true}
              selectedValues={[String(pageSize)]}
              options={PAGE_SIZE_OPTIONS.map((size) => ({
                value: String(size),
                label: String(size),
              }))}
              onChange={(values) => {
                const nextSize = Number(values[0]);
                if (!PAGE_SIZE_OPTIONS.includes(nextSize)) return;
                onPageSizeChange(nextSize);
              }}
              placeholder="Rows"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={page <= 1 || disabled}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <span className="min-w-24 text-center">
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || disabled}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
