"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";
export interface SortState {
  key: string;
  direction: SortDirection;
}

type SortValue = string | number | null | undefined;

const isEmpty = (v: SortValue) => v === null || v === undefined || v === "";

const compareValues = (a: string | number, b: string | number) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * Sorts a list that is already loaded in the browser by the column the user clicked. Sort before
 * paging (feed `sorted` to useClientPagination) and add `id` to its resetKey so a new sort goes
 * back to page 1. Empty values always sort last. With no sort chosen, `items` keep their order.
 */
export function useTableSort<T>(
  items: T[],
  accessors: Record<string, (item: T) => SortValue>,
  initial: SortState | null = null,
  thenBy?: (a: T, b: T) => number,
) {
  const [sort, setSort] = useState<SortState | null>(initial);

  const toggle = (key: string) =>
    setSort((prev) => ({ key, direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc" }));

  const accessor = sort ? accessors[sort.key] : undefined;
  const sorted =
    sort && accessor
      ? [...items].sort((a, b) => {
          const av = accessor(a);
          const bv = accessor(b);
          if (isEmpty(av) || isEmpty(bv)) {
            if (isEmpty(av) && isEmpty(bv)) return thenBy?.(a, b) ?? 0;
            return isEmpty(av) ? 1 : -1;
          }
          const result = compareValues(av as string | number, bv as string | number);
          return (sort.direction === "asc" ? result : -result) || (thenBy?.(a, b) ?? 0);
        })
      : items;

  return { sorted, sort, toggle, id: sort ? `${sort.key}:${sort.direction}` : "" };
}

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTh({ label, sortKey, sort, onSort, className = "px-6 py-4" }: SortableThProps) {
  const active = sort?.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
        className="inline-flex items-center gap-1.5 font-bold uppercase cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
      >
        {label}
        {active ? (
          sort.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
