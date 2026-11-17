/**
 * Where to go after signing in: the page the user was sent here from (a scanned QR code, a
 * bookmarked page...). Only same-site paths are accepted so "?from=" can never be used to
 * bounce someone to another website.
 */
export function safeReturnPath(from: string | null | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return "/";
  if (from === "/login" || from.startsWith("/login/") || from.startsWith("/api/")) return "/";
  return from;
}
