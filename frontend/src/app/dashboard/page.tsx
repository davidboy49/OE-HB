import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AuditProject, Department, User } from "@auditdesk/shared";
import {
  Building2,
  FolderLock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CheckCircle,
  Clock,
  FileText
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUserServer();
  if (!user) redirect("/login");

  const [projects, users, departments] = await Promise.all([
    apiFetch<AuditProject[]>("/audit-projects"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
  ]);

  // Metrics calculations
  const totalAudits = projects.length;
  const activeAudits = projects.filter(p => p.status === "RELEASED").length;
  const planningAudits = projects.filter(p => p.status === "PLANNING").length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">OE Desk Portal</h1>
          <p className="text-xs text-muted-foreground">
            Welcome back, <span className="text-slate-800 dark:text-slate-200 font-semibold">{user.name}</span>. Below is the operational compliance status for Hanuman Estate.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.2 bg-[#05375c]/10 dark:bg-accent/10 border border-[#05375c]/20 dark:border-accent/20 rounded text-[#05375c] dark:text-accent text-[10px] font-sans font-semibold self-start md:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          Active Identity: {user.role}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stat 1 */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wider font-bold">Total OE</span>
            <FolderLock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold font-sans text-slate-800 dark:text-slate-100">{totalAudits}</div>
            <div className="text-[10px] text-slate-400">
              <span className="text-slate-700 dark:text-slate-300 font-bold">{activeAudits}</span> active, <span className="text-slate-700 dark:text-slate-300 font-bold">{planningAudits}</span> in planning
            </div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wider font-bold">Monitored Depts</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold font-sans text-slate-800 dark:text-slate-100">{departments.length}</div>
            <div className="text-[10px] text-slate-400">
              Across {users.length} active employee profiles
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Audits Table */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Ongoing OE Operations</h2>
              <p className="text-[10px] text-slate-400">Current schedule and operational scoping status.</p>
            </div>
            <Link
              href="/planning"
              className="text-[10px] text-[#0066cc] hover:underline flex items-center gap-0.5 font-bold font-sans"
            >
              Go Scoping <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Project Name</th>
                  <th className="px-5 py-3">Lead Auditor</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5 font-sans font-medium text-slate-800 dark:text-slate-200">
                      {proj.code}
                    </td>
                    <td className="px-5 py-3.5 text-[#0066cc] font-medium hover:underline">
                      <Link href="/planning">{proj.name}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {users.find(u => u.id === proj.leadAuditorId)?.name || "Unassigned"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850">
                        {proj.status === "RELEASED" ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                            Released
                          </>
                        ) : proj.status === "CLOSED" ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-slate-500" />
                            Closed
                          </>
                        ) : proj.status === "SUBMITTED_FOR_APPROVAL" ? (
                          <>
                            <FileText className="w-3 h-3 text-slate-500" />
                            Submitted
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-slate-400" />
                            Planning
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
