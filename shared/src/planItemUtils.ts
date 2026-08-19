export interface AuditPlanItem {
  id: string;
  text: string;
}

/**
 * Parses raw objectives or scope data into structured AuditPlanItem objects.
 * Handles legacy raw strings, HTML text, or existing JSON arrays.
 */
export function parsePlanItems(raw?: string, defaultPrefix: string = "IAP-OBJ"): AuditPlanItem[] {
  if (!raw || !raw.trim()) {
    return [{ id: `${defaultPrefix}-01`, text: "" }];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => {
        const formattedIdx = String(idx + 1).padStart(2, "0");
        if (typeof item === "string") {
          return { id: `${defaultPrefix}-${formattedIdx}`, text: item };
        }
        return {
          id: item.id || `${defaultPrefix}-${formattedIdx}`,
          text: item.text || item.description || ""
        };
      });
    }
  } catch {
    const cleanText = raw.replace(/<[^>]*>/g, "").trim();
    if (cleanText) {
      return [{ id: `${defaultPrefix}-01`, text: cleanText }];
    }
  }
  return [{ id: `${defaultPrefix}-01`, text: "" }];
}

/**
 * Serializes AuditPlanItem array to JSON string for DB storage.
 */
export function serializePlanItems(items: AuditPlanItem[]): string {
  return JSON.stringify(items);
}

/**
 * Formats JSON or raw string objectives/scope into human-readable text.
 */
export function formatPlanItemsAsText(raw?: string): string {
  if (!raw || !raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any, idx: number) => {
          if (typeof item === "string") return `${idx + 1}. ${item}`;
          const idStr = item.id ? `[${item.id}] ` : "";
          return `${idStr}${item.text || ""}`;
        })
        .filter((line: string) => line.trim().length > 0)
        .join("\n");
    }
  } catch {
    return raw.replace(/<[^>]*>/g, "").trim();
  }
  return raw;
}
