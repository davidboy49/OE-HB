"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  CalendarRange, 
  ClipboardList,
  AlertTriangle, 
  AlertCircle,
  BellRing,
  Users, 
  UserCheck, 
  Sun, 
  Moon,
  ChevronRight,
  ChevronDown,
  Menu,
  Bell,
  User as UserIcon,
  Lock,
  Building,
  CalendarCheck,
  History,
  MessageSquare,
  Settings as SettingsIcon,
  X
} from "lucide-react";
import type { User } from "@auditdesk/shared";
import { getActiveAlertsCount } from "@auditdesk/shared";
import { apiFetch } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";

interface AppLayoutProps {
  children: React.ReactNode;
  currentUser: User;
}

export default function AppLayout({ children, currentUser }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light"); // Default light just like screenshot
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [auditModuleOpen, setAuditModuleOpen] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const savedAvatar = localStorage.getItem(`avatar_${currentUser.id}`);
    setAvatarUrl(savedAvatar || null);
  }, [currentUser.id]);

  useEffect(() => {
    const syncAvatar = () => {
      const savedAvatar = localStorage.getItem(`avatar_${currentUser.id}`);
      setAvatarUrl(savedAvatar || null);
    };
    window.addEventListener("avatar-changed", syncAvatar);
    return () => window.removeEventListener("avatar-changed", syncAvatar);
  }, [currentUser.id]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem(`avatar_${currentUser.id}`, base64);
      setAvatarUrl(base64);
      window.dispatchEvent(new Event("avatar-changed"));
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/session/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const [simulatedAlerts, setSimulatedAlerts] = useState<Array<{ id: string; to: string; subject: string; body: string }>>([]);

  useEffect(() => {
    const handleSimulatedEmail = (e: Event) => {
      const customEvent = e as CustomEvent<{ to: string; subject: string; body: string }>;
      const { to, subject, body } = customEvent.detail;
      const newAlert = {
        id: Math.random().toString(36).substring(7),
        to,
        subject,
        body
      };
      setSimulatedAlerts(prev => [...prev, newAlert]);
      // Auto-remove after 8 seconds
      setTimeout(() => {
        setSimulatedAlerts(prev => prev.filter(a => a.id !== newAlert.id));
      }, 8000);
    };

    window.addEventListener("send-simulated-email" as any, handleSimulatedEmail);
    return () => window.removeEventListener("send-simulated-email" as any, handleSimulatedEmail);
  }, []);

  // Initialize theme from localStorage or document class
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "light"; // Default light theme
    
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const schedules = await apiFetch<any[]>("/execution-schedules");
        const count = getActiveAlertsCount(schedules);
        setActiveAlertsCount(count);
      } catch (err) {
        console.error("Failed to fetch alerts count:", err);
      }
    };

    fetchAlerts();

    const handleRefresh = () => fetchAlerts();
    window.addEventListener("findings-updated", handleRefresh);
    window.addEventListener("schedule-updated", handleRefresh);

    return () => {
      window.removeEventListener("findings-updated", handleRefresh);
      window.removeEventListener("schedule-updated", handleRefresh);
    };
  }, []);

  const menuItems = [
    { name: "Annual OE Plans", href: "/annual-plans", icon: CalendarRange },
    // { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Individual OE Plans", href: "/planning", icon: CalendarRange },    
    { name: "Open Meetings", href: "/meetings", icon: MessageSquare },
    { name: "Execution Schedule", href: "/schedule", icon: CalendarCheck },
    { name: "OE Findings", href: "/findings", icon: AlertTriangle },
    { name: "Findings Alerts", href: "/findings-alerts", icon: BellRing, badge: activeAlertsCount },
    { name: "User Groups", href: "/users", icon: Users },
    { name: "Departments", href: "/departments", icon: Building },
  ];

  if (RBAC.can(currentUser, "activity-logs:view")) {
    menuItems.push({ name: "Activity Logs", href: "/logs", icon: History });
  }
  if (RBAC.can(currentUser, "notifications:configure")) {
    menuItems.push({ name: "System Settings", href: "/settings", icon: SettingsIcon });
  }

  // Dynamic breadcrumb matching screenshot structure
  const getBreadcrumb = () => {
    if (pathname.startsWith("/planning")) return "Engagement / Individual OE Plan (IAP)";
    if (pathname.startsWith("/schedule")) return "Execution / Execution Schedule & Document Request";
    if (pathname.startsWith("/meetings")) return "Collaboration / Open Meetings & Minutes";
    if (pathname.startsWith("/findings-alerts")) return "Mitigation / Findings Alerts";
    if (pathname.startsWith("/findings")) return "Mitigation / Findings Ledger";
    if (pathname.startsWith("/users")) return "Identity / User Management";
    if (pathname.startsWith("/departments")) return "Identity / Department Management";
    if (pathname.startsWith("/annual-plans")) return "Strategy / Annual OE Plan";
    if (pathname.startsWith("/logs")) return "Administration / Activity Logs";
    if (pathname.startsWith("/settings")) return "Administration / System Settings";
    return "Portal / Dashboard";
  };

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-foreground transition-colors duration-200">
      
      {/* Sidebar - Solid Deep Blue */}
      <aside 
        className={`${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        } transition-all duration-300 bg-[#063960] text-white flex flex-col justify-between shrink-0 relative shadow-lg z-20`}
      >
        {/* Background H Watermark overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center overflow-hidden">
          {/* <div className="text-[280px] font-bold select-none font-sans leading-none">H</div> */}
        </div>

        <div className="z-10">
          {/* Header - "HE PORTAL" */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#042844] shrink-0">
            <span className="font-sans font-extrabold tracking-wider text-base">OE Portal</span>
          </div>

          {/* Profile Section - Centered avatar & name */}
          <div className="py-8 flex flex-col items-center justify-center border-b border-[#042844] space-y-3 bg-[#053254]/40">
            <label className="w-20 h-20 rounded-full bg-slate-500/50 flex items-center justify-center border border-white/10 shadow-inner overflow-hidden cursor-pointer relative group hover:opacity-85 transition-opacity shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-slate-300" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] text-white font-sans tracking-wider transition-opacity uppercase font-bold">
                Upload
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
            <div className="text-center space-y-1">
              <div className="text-xs text-slate-300 font-sans flex items-center justify-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" /> {currentUser.role}
              </div>
              <div className="font-bold text-sm tracking-wide uppercase text-white">
                {currentUser.name}
              </div>
            </div>
          </div>

          {/* Navigation Links with nesting */}
          <nav className="py-4 space-y-1">
            {/* Audit Module Collapsible Parent */}
            <div>
              <button
                type="button"
                onClick={() => setAuditModuleOpen(!auditModuleOpen)}
                className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-white hover:bg-[#053254]/50 transition-all select-none cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-slate-300" />
                  <span className="uppercase tracking-wider">OE Module</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${auditModuleOpen ? "" : "-rotate-90"}`} />
              </button>

              {/* Nested Child Items */}
              <div 
                className={`transition-all duration-300 overflow-hidden ${
                  auditModuleOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="pl-4 border-l border-[#042844] ml-7 my-1 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href) || (item.href === "/dashboard" && pathname === "/");
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold transition-all select-none rounded ${
                          isActive
                            ? "bg-[#052b49] text-white font-bold border-l-2 border-accent pl-3"
                            : "text-slate-300 hover:bg-[#053254]/30 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {typeof item.badge === "number" && item.badge > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse">
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight className="w-2.5 h-2.5 text-slate-500" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-[#042844] space-y-2 bg-[#042d4c]/30 text-center z-10">
          <div className="text-[10px] text-slate-400 font-sans tracking-wider">
            {currentUser.departmentId ? `DEPT: ${currentUser.departmentName || "SECURITY"}` : "GLOBAL ACCESS"}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 z-10 shrink-0 shadow-xs">
          
          {/* Left: Hamburger menu toggle */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-5">
            {/* Session */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-sans text-slate-700 dark:text-slate-300 hover:text-white hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              {loggingOut ? "Logging out…" : "Log out"}
            </button>

            {/* Notification bell */}
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Profile Avatar */}
            <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-800 select-none overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-sans text-sm font-semibold">{currentUser.name.charAt(0)}</span>
              )}
            </div>
          </div>
        </header>

        {/* Content Breadcrumb Area */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/50 py-3.5 px-8 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {getBreadcrumb()}
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-100 dark:bg-slate-950">
          {children}
        </main>
      </div>

      {/* Global Simulated SMTP Notification Stack */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 max-w-sm w-full no-print">
        {simulatedAlerts.map((alert) => (
          <div 
            key={alert.id} 
            className="bg-slate-900 border border-slate-800 text-slate-100 p-4 rounded-lg shadow-2xl animate-slide-up flex flex-col gap-1.5 relative overflow-hidden"
          >
            {/* Top pulsing indicator */}
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-sans text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                Simulated SMTP Alert
              </div>
              <button 
                onClick={() => setSimulatedAlerts(prev => prev.filter(a => a.id !== alert.id))}
                className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">To: {alert.to}</div>
              <div className="text-xs font-semibold text-slate-300 mt-1">{alert.subject}</div>
              <div 
                className="text-[10px] text-slate-450 leading-relaxed mt-1 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: alert.body }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
