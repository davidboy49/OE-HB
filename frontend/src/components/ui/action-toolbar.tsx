"use client";

import { 
  Plus, 
  Eye, 
  Pencil, 
  Copy, 
  Trash2, 
  TrendingUp, 
  RotateCw, 
  SlidersHorizontal,
  Search,
  ChevronDown
} from "lucide-react";

interface ActionToolbarProps {
  onCreate?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onChartToggle?: () => void;
  onRefresh?: () => void;
  
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  searchPlaceholder?: string;
  
  filterLabel?: string;
  filterValue?: string;
  setFilterValue?: (val: string) => void;
  filterOptions?: { label: string; value: string }[];
  
  activeFilterCountLabel?: string; // e.g. "ALL" or count
}

export default function ActionToolbar({
  onCreate,
  onView,
  onEdit,
  onCopy,
  onDelete,
  onChartToggle,
  onRefresh,
  searchQuery,
  setSearchQuery,
  searchPlaceholder = "Search...",
  filterLabel = "Category",
  filterValue,
  setFilterValue,
  filterOptions = [],
  activeFilterCountLabel = "ALL"
}: ActionToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-lg select-none">
      
      {/* Left side actions buttons matching screenshot */}
      <div className="flex items-center gap-2">
        {onCreate && (
          <button 
            type="button" 
            onClick={onCreate}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Add New"
          >
            <Plus className="w-4 h-4 font-bold" />
          </button>
        )}
        {onView && (
          <button 
            type="button" 
            onClick={onView}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        {onEdit && (
          <button 
            type="button" 
            onClick={onEdit}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onCopy && (
          <button 
            type="button" 
            onClick={onCopy}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button 
            type="button" 
            onClick={onDelete}
            className="p-2 text-slate-500 hover:text-destructive dark:hover:text-destructive hover:bg-red-500/10 rounded transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {onChartToggle && (
          <button 
            type="button" 
            onClick={onChartToggle}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Toggle Charts"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        )}
        {onRefresh && (
          <button 
            type="button" 
            onClick={onRefresh}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Reload Data"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right side filters matching screenshot */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Active filter count badge */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold border-r border-slate-200 dark:border-slate-800 pr-3 h-5">
          <span>{activeFilterCountLabel}</span>
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>

        {/* Dropdown Select - e.g. "Sub Block" */}
        {setFilterValue && filterOptions.length > 0 && (
          <div className="relative inline-block text-left">
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-accent text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
            >
              <option value="ALL">{filterLabel}</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        )}

        {/* Search input with Blue Search button */}
        {setSearchQuery && (
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 border-r-0 rounded-l-md text-xs px-3 py-2 w-48 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
            />
            <button
              type="button"
              className="bg-[#05375c] hover:bg-[#074776] text-white p-2 rounded-r-md transition-colors cursor-pointer border border-[#05375c]"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
