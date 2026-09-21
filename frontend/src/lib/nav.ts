import type { User } from "@oeportal/shared";

/**
 * The single list of pages and the permissions each one needs. The sidebar hides an item the
 * user cannot open, and every page calls guardPage(href) with the same entry, so the menu and
 * the page can never disagree. (The backend enforces the same permissions on the API - this is
 * about not showing people things that would only fail.)
 */
export interface NavItem {
  name: string;
  href: string;
  /** Every one of these permissions is needed. */
  requires?: string[];
  /** At least one of these is needed. */
  anyOf?: string[];
  /** Reachable by link but not listed in the sidebar. */
  hidden?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Annual OE Plans", href: "/annual-plans", requires: ["annual-plans:view"] },
  { name: "Individual OE Plans", href: "/planning", requires: ["oe-plans:view"] },
  { name: "Open Meetings", href: "/meetings", requires: ["meetings:view"] },
  { name: "Execution Schedule", href: "/schedule", requires: ["execution-schedules:view"] },
  // Finding reports are stored as execution schedules, so both are needed.
  { name: "OE Findings", href: "/findings", requires: ["findings:view", "execution-schedules:view"] },
  { name: "Findings Alerts", href: "/findings-alerts", requires: ["findings:view", "execution-schedules:view"] },
  { name: "Department Responses", href: "/meeting-responses", requires: ["meeting-responses:view-all"] },
  { name: "User Groups", href: "/users", anyOf: ["users:view", "user-groups:view"] },
  { name: "Access Control", href: "/access-control", requires: ["user-groups:view"] },
  { name: "Departments", href: "/departments", requires: ["departments:view"] },
  { name: "Business Units", href: "/business-units", requires: ["business-units:view"] },
  { name: "Activity Logs", href: "/logs", requires: ["activity-logs:view"] },
  { name: "System Settings", href: "/settings", requires: ["notifications:configure"] },
  { name: "Dashboard", href: "/dashboard", requires: ["oe-plans:view"], hidden: true },
];

const holds = (user: User, key: string) => user.permissions?.includes(key) ?? false;

export function canOpen(user: User | null, item: NavItem): boolean {
  if (!user) return false;
  if (item.requires && !item.requires.every((k) => holds(user, k))) return false;
  if (item.anyOf && !item.anyOf.some((k) => holds(user, k))) return false;
  return true;
}

export function navFor(user: User | null): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.hidden && canOpen(user, item));
}

/** Where to send someone who has just signed in (or hit "/"). */
export function firstAllowedPath(user: User | null): string {
  return navFor(user)[0]?.href ?? "/no-access";
}

export function navItemFor(href: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.href === href);
}
