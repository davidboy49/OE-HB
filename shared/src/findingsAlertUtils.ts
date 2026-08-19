export interface FindingAlertItem {
  id: string; // scheduleId_rowIndex
  scheduleId: string;
  rowIndex: number;
  documentCode?: string;
  projectId: string;
  projectName?: string;
  departments?: string;
  standards?: string;
  ownerName?: string;
  status?: string;

  // Finding line details
  date: string;
  time?: string;
  activity: string;
  conductBy?: string;
  objectives?: string;
  pIncharge?: string;
  recommendation?: string;
  implication?: string;

  correctiveActionDate?: string;
  correctiveActionRemarks?: string;
  correctiveFinalDate?: string;
  correctiveFinalRemarks?: string;
  correctiveFinalUser?: string;
  correctiveFinalDatetime?: string;

  // Categorization
  alertType: "MISSING_FINAL_DATE" | "PENDING_RESOLUTION" | "RESOLVED";
  isResolved: boolean;
}

export function parseFindingAlerts(schedules: any[]): FindingAlertItem[] {
  const alerts: FindingAlertItem[] = [];

  if (!Array.isArray(schedules)) return alerts;

  schedules.forEach((schedule) => {
    // Only process finding reports
    if (schedule.language !== "finding") return;

    let rows: any[] = [];
    if (schedule.scheduleRows) {
      try {
        rows = typeof schedule.scheduleRows === "string"
          ? JSON.parse(schedule.scheduleRows)
          : schedule.scheduleRows;
      } catch (e) {
        rows = [];
      }
    }

    if (!Array.isArray(rows)) return;

    rows.forEach((row: any, idx: number) => {
      const hasFinalDate = !!(row.correctiveFinalDate && row.correctiveFinalDate.trim() !== "");
      const isResolved = !!(row.correctiveFinalUser && row.correctiveFinalUser.trim() !== "");

      let alertType: "MISSING_FINAL_DATE" | "PENDING_RESOLUTION" | "RESOLVED" = "RESOLVED";

      if (!hasFinalDate) {
        alertType = "MISSING_FINAL_DATE";
      } else if (!isResolved) {
        alertType = "PENDING_RESOLUTION";
      }

      alerts.push({
        id: `${schedule.id}_${idx}`,
        scheduleId: schedule.id,
        rowIndex: idx,
        documentCode: schedule.documentCode || schedule.visitNumber || `FND-${schedule.id.substring(0, 6)}`,
        projectId: schedule.projectId,
        projectName: schedule.projectName || schedule.project?.name || "N/A",
        departments: schedule.departments || schedule.project?.departments || "",
        standards: schedule.standards,
        ownerName: schedule.ownerName || schedule.lastModifiedBy,
        status: schedule.status,

        date: row.date || "",
        time: row.time || "",
        activity: row.activity || "Untitled Finding Item",
        conductBy: row.conductBy || "",
        objectives: row.objectives || "",
        pIncharge: row.pIncharge || "",
        recommendation: row.recommendation || "",
        implication: row.implication || "",

        correctiveActionDate: row.correctiveActionDate || "",
        correctiveActionRemarks: row.correctiveActionRemarks || "",
        correctiveFinalDate: row.correctiveFinalDate || "",
        correctiveFinalRemarks: row.correctiveFinalRemarks || "",
        correctiveFinalUser: row.correctiveFinalUser || "",
        correctiveFinalDatetime: row.correctiveFinalDatetime || "",

        alertType,
        isResolved,
      });
    });
  });

  return alerts;
}

export function getActiveAlertsCount(schedules: any[]): number {
  const alerts = parseFindingAlerts(schedules);
  return alerts.filter((a) => !a.isResolved).length;
}

export interface GroupedFindingAlert {
  scheduleId: string;
  documentCode: string;
  projectId: string;
  projectName: string;
  departments?: string;
  standards?: string;
  ownerName?: string;
  status?: string;

  totalRows: number;
  missingFinalDateCount: number;
  pendingResolutionCount: number;
  resolvedCount: number;
  isFullyResolved: boolean;
  overallAlertType: "MISSING_FINAL_DATE" | "PENDING_RESOLUTION" | "RESOLVED";

  primaryFindingTitle: string;
  items: FindingAlertItem[];
}

export function groupFindingAlerts(alerts: FindingAlertItem[]): GroupedFindingAlert[] {
  const groupsMap = new Map<string, FindingAlertItem[]>();

  alerts.forEach((item) => {
    const list = groupsMap.get(item.scheduleId) || [];
    list.push(item);
    groupsMap.set(item.scheduleId, list);
  });

  const grouped: GroupedFindingAlert[] = [];

  groupsMap.forEach((items, scheduleId) => {
    if (items.length === 0) return;
    const first = items[0];

    const totalRows = items.length;
    const missingFinalDateCount = items.filter((i) => i.alertType === "MISSING_FINAL_DATE").length;
    const pendingResolutionCount = items.filter((i) => i.alertType === "PENDING_RESOLUTION").length;
    const resolvedCount = items.filter((i) => i.isResolved).length;
    const isFullyResolved = resolvedCount === totalRows;

    let overallAlertType: "MISSING_FINAL_DATE" | "PENDING_RESOLUTION" | "RESOLVED" = "RESOLVED";
    if (missingFinalDateCount > 0) {
      overallAlertType = "MISSING_FINAL_DATE";
    } else if (pendingResolutionCount > 0) {
      overallAlertType = "PENDING_RESOLUTION";
    }

    const primaryFindingTitle = first.activity || "Audit Finding Document";

    grouped.push({
      scheduleId,
      documentCode: first.documentCode || `FND-${scheduleId.substring(0, 6)}`,
      projectId: first.projectId,
      projectName: first.projectName || "N/A",
      departments: first.departments,
      standards: first.standards,
      ownerName: first.ownerName,
      status: first.status,

      totalRows,
      missingFinalDateCount,
      pendingResolutionCount,
      resolvedCount,
      isFullyResolved,
      overallAlertType,

      primaryFindingTitle,
      items,
    });
  });

  return grouped;
}
