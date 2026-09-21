import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserServer } from "@/lib/auth";
import { navFor } from "@/lib/nav";

export const metadata = {
  title: "No access | OE Portal",
};

export default async function NoAccessPage() {
  const user = await getCurrentUserServer();
  if (!user) redirect("/login");
  const firstPage = navFor(user)[0];

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <ShieldOff className="w-6 h-6 text-slate-500" />
      </div>
      <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
        You don&apos;t have access to this page
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {firstPage
          ? "Your account isn't allowed to open the page you asked for. If you think it should be, ask an administrator to grant your user group the matching permission."
          : "Your account doesn't have access to any pages yet. If you were asked to respond to an Open Meeting, scan the QR code you were given. Otherwise ask an administrator to grant your user group access."}
      </p>
      {firstPage && (
        <Link
          href={firstPage.href}
          className="inline-block px-4 py-2 rounded bg-[#063960] text-white text-xs font-semibold hover:bg-[#052b49] transition-colors"
        >
          Go to {firstPage.name}
        </Link>
      )}
    </div>
  );
}
