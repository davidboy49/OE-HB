import { redirect } from "next/navigation";
import type { User } from "@oeportal/shared";
import { getCurrentUserServer } from "./auth";
import { canOpen, navItemFor } from "./nav";

/**
 * Call first in every server page. Sends anonymous visitors to the login page and anyone who
 * lacks the page's permission (see NAV_ITEMS) to the "no access" page, so a typed-in or
 * bookmarked URL is no more revealing than the sidebar.
 */
export async function guardPage(href: string): Promise<User> {
  const user = await getCurrentUserServer();
  if (!user) redirect(`/login?from=${encodeURIComponent(href)}`);

  const item = navItemFor(href);
  if (item && !canOpen(user, item)) redirect("/no-access");
  return user;
}
