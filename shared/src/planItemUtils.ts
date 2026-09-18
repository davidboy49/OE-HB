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

export interface ScopeOverride {
  inactiveIds: string[];
  extraItems: AuditPlanItem[];
}

/**
 * Parses an Individual OE Plan's AuditProject.scope field, which - unlike
 * objectives - does NOT hold scope text directly. Scope lives on the Planned
 * Engagement (AuditPlan.scope); AuditProject.scope only stores a delta on top
 * of it: which inherited item ids are deactivated for this plan, plus any
 * extra items added locally. See ScopeOverride usage in planning-client.tsx.
 */
export function parseScopeOverride(raw?: string): ScopeOverride {
  if (!raw || !raw.trim()) return { inactiveIds: [], extraItems: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      inactiveIds: Array.isArray(parsed.inactiveIds) ? parsed.inactiveIds : [],
      extraItems: Array.isArray(parsed.extraItems) ? parsed.extraItems : [],
    };
  } catch {
    return { inactiveIds: [], extraItems: [] };
  }
}

/**
 * Resolves an Individual OE Plan's actual effective scope items: its Planned
 * Engagement's base scope items minus any this plan marked inactive, plus
 * any extra items it added locally. Use this (not AuditProject.scope
 * directly) anywhere the real inherited scope content is needed.
 */
export function resolveEffectiveScopeItems(
  baseScopeRaw: string | undefined,
  overrideRaw: string | undefined,
  defaultPrefix: string = "AP-ISCP",
): AuditPlanItem[] {
  const override = parseScopeOverride(overrideRaw);
  const baseItems = baseScopeRaw
    ? parsePlanItems(baseScopeRaw, defaultPrefix).filter((item) => item.text)
    : [];
  const activeBase = baseItems.filter((item) => !override.inactiveIds.includes(item.id));
  const activeExtra = override.extraItems.filter(
    (item) => item.text && !override.inactiveIds.includes(item.id),
  );
  return [...activeBase, ...activeExtra];
}

/**
 * Resolves an Individual OE Plan's actual inherited objectives + scope text
 * from its linked Planned Engagement, falling back to whatever is stored
 * directly on the AuditProject (e.g. a manually-created plan with no linked
 * Planned Engagement, or legacy data). Always prefer this over reading
 * AuditProject.objectives/scope directly: objectives can go stale if the
 * linked Planned Engagement is edited or swapped after this plan was
 * created, and scope is a { inactiveIds, extraItems } override, not text -
 * see resolveEffectiveScopeItems.
 */
export function resolveInheritedPlanContent(
  auditProject: { objectives?: string; scope?: string },
  linkedAuditPlan: { objectives?: string; scope?: string } | null | undefined,
): { objectives: string; scope: string } {
  const objectives = linkedAuditPlan?.objectives || auditProject.objectives || '';
  const scopeItems = resolveEffectiveScopeItems(linkedAuditPlan?.scope, auditProject.scope);
  const scope = scopeItems.length > 0 ? serializePlanItems(scopeItems) : '';
  return { objectives, scope };
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
