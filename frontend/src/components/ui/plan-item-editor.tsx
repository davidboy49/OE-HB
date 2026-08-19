"use client";

import React from "react";
import { Plus, Trash2, Tag, ChevronUp, ChevronDown } from "lucide-react";
import type { AuditPlanItem } from "@auditdesk/shared";

interface PlanItemEditorProps {
  sectionTitle: string;
  items: AuditPlanItem[];
  onChange: (items: AuditPlanItem[]) => void;
  prefix: string; // e.g. "IAP-OBJ" or "IAP-ISCP"
  editable?: boolean;
  placeholder?: string;
  addBtnText?: string;
  hideHeader?: boolean;
}

export default function PlanItemEditor({
  sectionTitle,
  items,
  onChange,
  prefix,
  editable = true,
  placeholder = "Enter item description...",
  addBtnText = "Add Item",
  hideHeader = false
}: PlanItemEditorProps) {
  
  const handleAddItem = () => {
    const nextNum = items.length + 1;
    const formattedIdx = String(nextNum).padStart(2, "0");
    const newId = `${prefix}-${formattedIdx}`;
    const nextItems = [...items, { id: newId, text: "" }];
    onChange(nextItems);
  };

  const handleUpdateItemText = (index: number, text: string) => {
    const nextItems = [...items];
    nextItems[index] = { ...nextItems[index], text };
    onChange(nextItems);
  };

  const handleUpdateItemId = (index: number, id: string) => {
    const nextItems = [...items];
    nextItems[index] = { ...nextItems[index], id };
    onChange(nextItems);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      // Clear content instead of removing sole item to retain 1 input
      const formattedIdx = "01";
      onChange([{ id: `${prefix}-${formattedIdx}`, text: "" }]);
      return;
    }
    const nextItems = items.filter((_, i) => i !== index);
    onChange(nextItems);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const nextItems = [...items];
    const temp = nextItems[index];
    nextItems[index] = nextItems[index - 1];
    nextItems[index - 1] = temp;
    onChange(nextItems);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const nextItems = [...items];
    const temp = nextItems[index];
    nextItems[index] = nextItems[index + 1];
    nextItems[index + 1] = temp;
    onChange(nextItems);
  };

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-[14px] font-sans font-bold text-slate-750 dark:text-slate-355 uppercase">
              {sectionTitle}
            </label>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {items.length} {items.length === 1 ? "Item" : "Items"}
            </span>
          </div>
          {editable && (
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {addBtnText}
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-4 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
          No items added yet. Click &quot;{addBtnText}&quot; to add one.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <div
              key={index}
              className="group relative p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 rounded-lg space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
            >
              {/* Item Header Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-500" />
                    {editable ? (
                      <input
                        type="text"
                        value={item.id}
                        onChange={(e) => handleUpdateItemId(index, e.target.value)}
                        className="bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none text-xs font-mono font-bold w-28 px-0.5"
                        title="Unique Item ID (editable)"
                      />
                    ) : (
                      item.id
                    )}
                  </span>
                </div>

                {editable && (
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(index)}
                      className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-950/50 ml-1"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Item Input / Text Area */}
              <div>
                {editable ? (
                  <textarea
                    rows={2}
                    value={item.text}
                    onChange={(e) => handleUpdateItemText(index, e.target.value)}
                    placeholder={placeholder}
                    className="w-full text-xs font-sans text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all resize-y min-h-[56px]"
                  />
                ) : (
                  <div className="text-xs font-sans text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">
                    {item.text || <span className="italic text-slate-400">No content entered.</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editable && items.length > 0 && (
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {addBtnText}
        </button>
      )}
    </div>
  );
}
