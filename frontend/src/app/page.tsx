import { redirect } from "next/navigation";
import { getCurrentUserServer } from "@/lib/auth";
import { firstAllowedPath } from "@/lib/nav";

/** Sends each person to the first page their permissions allow. */
export default async function Home() {
  const user = await getCurrentUserServer();
  if (!user) redirect("/login");
  redirect(firstAllowedPath(user));
}
