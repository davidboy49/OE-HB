"use client";

import { useState } from "react";

import { Users, Plus, Lock, Mail, X, ShieldCheck, KeyRound, Save, ShieldQuestion } from "lucide-react";
import type { User, Department, UserGroup, UserRole } from "@auditdesk/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";
import type { PermissionDef } from "./permission-types";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

interface UsersClientProps {
  initialUsers: User[];
  initialDepartments: Department[];
  initialUserGroups: UserGroup[];
  allPermissions: PermissionDef[];
  currentUser: User;
}

export default function UsersClient({
  initialUsers,
  initialDepartments,
  initialUserGroups,
  allPermissions,
  currentUser
}: UsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [departments] = useState<Department[]>(initialDepartments);
  const [userGroups, setUserGroups] = useState<UserGroup[]>(initialUserGroups);
  
  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupRole, setNewGroupRole] = useState<UserRole>("AUDITEE");
  
  // User Edit/Create state variables
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("AUDITEE");
  const [userDept, setUserDept] = useState("");
  const [userGroup, setUserGroup] = useState("");
  const [userPassword, setUserPassword] = useState("");

  // Set-password modal (admin only)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Group permissions matrix modal (admin only)
  const [permissionsModalGroup, setPermissionsModalGroup] = useState<UserGroup | null>(null);
  const [groupPermissionKeys, setGroupPermissionKeys] = useState<Set<string>>(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  const canManage = RBAC.canManageUsers(currentUser);
  const isAdmin = RBAC.isAdmin(currentUser);

  // Assignment handlers
  const handleAssignGroup = async (userId: string, groupId: string | null) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const updated = await clientApi<User>(`/users/${userId}/group-and-dept`, {
      method: "PATCH",
      body: JSON.stringify({ departmentId: user.departmentId, groupId: groupId || null }),
    });

    if (updated) {
      const freshUsers = await clientApi<User[]>("/users");
      setUsers(freshUsers);
      const group = userGroups.find((item) => item.id === groupId);
      showFeedback(group ? `${user.name} now inherits ${formatRole(group.role)} access.` : `Removed ${user.name} from their group.`);
    }
  };
  
  const openCreateUserModal = () => {
    setUserModalMode("create");
    setUserName("");
    setUserEmail("");
    setUserRole("AUDITEE");
    setUserDept("");
    setUserGroup("");
    setUserPassword("");
    setIsUserModalOpen(true);
  };

  const openEditUserModal = () => {
    if (!selectedUserId) return;
    const u = users.find(x => x.id === selectedUserId);
    if (!u) return;

    setUserModalMode("edit");
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRole(u.role);
    setUserDept(u.departmentId || "");
    setUserGroup(u.groupId || "");
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !userRole) return;

    try {
      if (userModalMode === "create") {
        const newUser = await clientApi<User>("/users", {
          method: "POST",
          body: JSON.stringify({
            name: userName,
            email: userEmail,
            role: userRole,
            departmentId: userDept || null,
            groupId: userGroup || null,
            password: userPassword || undefined,
          }),
        });
        if (newUser) {
          const freshUsers = await clientApi<User[]>("/users");
          setUsers(freshUsers);
          setIsUserModalOpen(false);
          setSelectedUserId(newUser.id);
          showFeedback(`User ${userName} created successfully.`);
        }
      } else {
        if (!selectedUserId) return;
        const updated = await clientApi<User>(`/users/${selectedUserId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: userName,
            email: userEmail,
            role: userRole,
            departmentId: userDept || null,
            groupId: userGroup || null,
          }),
        });
        if (updated) {
          const freshUsers = await clientApi<User[]>("/users");
          setUsers(freshUsers);
          setIsUserModalOpen(false);
          showFeedback(`User ${userName} updated successfully.`);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      showFeedback(`Error: ${getErrorMessage(err)}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;
    const u = users.find(x => x.id === selectedUserId);
    if (!u) return;

    const confirmDel = window.confirm(`Are you sure you want to delete user "${u.name}"? This will delete all their audit requests and documents.`);
    if (!confirmDel) return;

    try {
      const success = await clientApi<boolean>(`/users/${selectedUserId}`, { method: "DELETE" });
      if (success) {
        const freshUsers = await clientApi<User[]>("/users");
        setUsers(freshUsers);
        setSelectedUserId(null);
        showFeedback(`User "${u.name}" has been deleted.`);
      }
    } catch (err: unknown) {
      console.error(err);
      showFeedback(`Delete Error: ${getErrorMessage(err)}`);
    }
  };


  const openSetPasswordModal = () => {
    if (!selectedUserId) return;
    setNewPassword("");
    setIsPasswordModalOpen(true);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || newPassword.length < 8) return;

    try {
      await clientApi(`/users/${selectedUserId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      setIsPasswordModalOpen(false);
      setNewPassword("");
      const u = users.find((x) => x.id === selectedUserId);
      showFeedback(`Password updated for ${u?.name ?? "user"}.`);
    } catch (err: unknown) {
      showFeedback(`Error: ${getErrorMessage(err)}`);
    }
  };

  const openPermissionsModal = async (group: UserGroup) => {
    setPermissionsModalGroup(group);
    setPermissionsLoading(true);
    try {
      const keys = await clientApi<string[]>(`/user-groups/${group.id}/permissions`);
      setGroupPermissionKeys(new Set(keys));
    } catch (err: unknown) {
      showFeedback(`Error: ${getErrorMessage(err)}`);
      setPermissionsModalGroup(null);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const togglePermission = (key: string) => {
    setGroupPermissionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionsModalGroup) return;
    try {
      await clientApi(`/user-groups/${permissionsModalGroup.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissionKeys: Array.from(groupPermissionKeys) }),
      });
      showFeedback(`Permissions updated for "${permissionsModalGroup.name}".`);
      setPermissionsModalGroup(null);
    } catch (err: unknown) {
      showFeedback(`Error: ${getErrorMessage(err)}`);
    }
  };

  // Group permission keys by domain (text before ":") for a readable matrix.
  const permissionsByDomain = allPermissions.reduce<Record<string, PermissionDef[]>>((acc, perm) => {
    const domain = perm.key.split(":")[0];
    (acc[domain] ||= []).push(perm);
    return acc;
  }, {});

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const newGroup = await clientApi<UserGroup>("/user-groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc, role: newGroupRole }),
      });
      setUserGroups((groups) => [...groups, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupRole("AUDITEE");
      showFeedback(`User group "${newGroup.name}" created with ${formatRole(newGroup.role)} access.`);
    } catch (err: unknown) {
      showFeedback(`Error: ${getErrorMessage(err)}`);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Filter logic
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const formatRole = (role: UserRole) => role.replace("_", " ");

  const roleFilterOptions = [
    { label: "Admin", value: "ADMIN" },
    { label: "Lead Auditor", value: "LEAD_AUDITOR" },
    { label: "Auditor", value: "AUDITOR" },
    { label: "Auditee", value: "AUDITEE" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">User Scoping & Identity Management</h1>
        <p className="text-xs text-muted-foreground">
          Create governance groups, assign an RBAC role, and apply access instantly when users join.
        </p>
      </div>

      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-[#05375c] text-white px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-[#05375c] no-print">
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-sans font-bold uppercase">Users</span><Users className="h-4 w-4" /></div>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{users.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500"><span className="text-[10px] font-sans font-bold uppercase">Access groups</span><ShieldCheck className="h-4 w-4" /></div>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{userGroups.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400"><span className="text-[10px] font-sans font-bold uppercase">RBAC status</span><KeyRound className="h-4 w-4" /></div>
          <p className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">Instant inheritance enabled</p>
        </div>
      </div>
      {/* User Ledger Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: User table with ActionToolbar */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            
            {/* ActionToolbar */}
            <ActionToolbar
              onCreate={canManage ? openCreateUserModal : undefined}
              onEdit={canManage && selectedUserId ? openEditUserModal : undefined}
              onDelete={canManage && selectedUserId ? handleDeleteUser : undefined}
              onRefresh={() => {
                setSearchQuery("");
                setRoleFilter("ALL");
                setSelectedUserId(null);
              }}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchPlaceholder="Search users..."
              filterLabel="Role"
              filterValue={roleFilter}
              setFilterValue={setRoleFilter}
              filterOptions={roleFilterOptions}
              activeFilterCountLabel={roleFilter === "ALL" ? "ALL" : "FILTERED"}
            />

            {isAdmin && selectedUserId && (
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={openSetPasswordModal}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#05375c] dark:text-accent hover:underline cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Set Password for Selected User
                </button>
              </div>
            )}

            {/* Table roster */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-sans font-bold">
                  <tr>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">System Role</th>
                    <th className="px-6 py-4">Department Scope</th>
                    <th className="px-6 py-4">Governance Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUsers.map((u) => {
                    let roleColor = "text-slate-500";
                    if (u.role === "ADMIN") roleColor = "text-red-500";
                    else if (u.role === "LEAD_AUDITOR") roleColor = "text-amber-500 font-semibold";
                    else if (u.role === "AUDITOR") roleColor = "text-blue-500";

                    return (
                      <tr 
                        key={u.id} 
                        onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors select-none cursor-pointer ${
                          u.id === selectedUserId ? "bg-slate-100/80 dark:bg-slate-800/50 font-medium" : ""
                        }`}
                      >
                        <td className="px-6 py-4.5">
                          <div className="font-semibold text-[#0066cc] hover:text-[#004499] hover:underline cursor-pointer">{u.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </div>
                        </td>
                        <td className={`px-6 py-4.5 font-bold ${roleColor}`}>
                          {formatRole(u.role)}
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {u.departmentName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4.5">
                          {canManage ? (
                            <select
                              value={u.groupId || ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleAssignGroup(u.id, e.target.value || null)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded px-2 py-1 focus:outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                            >
                              <option value="">No Group</option>
                              {userGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name} - {formatRole(g.role)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {u.groupName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Right Column: Group Scopes creation forms */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-5 space-y-6">
            
            <div className="space-y-6">
              {/* List */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-sans uppercase text-slate-400 font-bold">Group Registers</h3>
                <div className="space-y-2">
                  {userGroups.map((group) => (
                    <div key={group.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-md space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                        <Users className="w-3.5 h-3.5 text-[#05375c] dark:text-accent" /> {group.name}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-500">{group.description || "No description provided."}</p>
                        <span className="shrink-0 rounded-full bg-[#05375c]/10 px-2 py-1 text-[9px] font-bold text-[#05375c] dark:bg-sky-400/10 dark:text-sky-300">{formatRole(group.role)}</span>
                      </div>
                      <p className="text-[9px] font-sans text-slate-400">{users.filter((user) => user.groupId === group.id).length} member(s) | role applies on assignment</p>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openPermissionsModal(group)}
                          className="flex items-center gap-1 text-[9px] font-bold text-[#05375c] dark:text-accent hover:underline cursor-pointer pt-1"
                        >
                          <ShieldQuestion className="w-3 h-3" /> Manage Permissions
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create Form */}
              {canManage ? (
                <form onSubmit={handleCreateGroup} className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4 animate-fade-in">
                  <h3 className="text-[10px] font-sans uppercase text-slate-400 font-bold">Add New User Group</h3>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-sans text-slate-400 uppercase font-semibold">Group Name</label>
                    <input
                      type="text"
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. Risk Oversight Panel"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-sans text-slate-400 uppercase font-semibold">Instant RBAC Role</label>
                    <select
                      value={newGroupRole}
                      onChange={(e) => setNewGroupRole(e.target.value as UserRole)}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="AUDITEE">Auditee</option>
                      <option value="AUDITOR">Auditor</option>
                      <option value="LEAD_AUDITOR">Lead Auditor</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                    <p className="text-[9px] leading-relaxed text-slate-400">Every user assigned to this group immediately inherits this system role.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-sans text-slate-400 uppercase font-semibold">Description</label>
                    <textarea
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="Describe group goals..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent h-16 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1 bg-[#05375c] text-white font-semibold text-xs py-2 rounded-md hover:bg-[#074776] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save User Group
                  </button>
                </form>
              ) : (
                <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/40 rounded text-[10px] text-slate-400 font-sans">
                  <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>Lacks governance permission to create user groups.</span>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* User Create/Edit Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-850">
            
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-xs font-sans uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {userModalMode === "create" ? "Create New User Identity" : "Edit User Identity"}
              </h3>
              <button 
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Full Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Michael Chen"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Email Address</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="e.g. michael.chen@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">System Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  disabled={Boolean(userGroup)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                >
                  <option value="AUDITEE">Auditee</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="LEAD_AUDITOR">Lead Auditor</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                {userGroup && <p className="text-[9px] text-emerald-600 dark:text-emerald-400">Role is inherited from the selected group.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">Department</label>
                  <select
                    value={userDept}
                    onChange={(e) => setUserDept(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                  >
                    <option value="">No Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">User Group</label>
                  <select
                    value={userGroup}
                    onChange={(e) => {
                      const groupId = e.target.value;
                      setUserGroup(groupId);
                      const group = userGroups.find((item) => item.id === groupId);
                      if (group) setUserRole(group.role);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                  >
                    <option value="">No Group</option>
                    {userGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} - {formatRole(g.role)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {userModalMode === "create" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                    Initial Password <span className="normal-case font-normal">(optional - can be set later)</span>
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="Leave blank to set later"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer"
                >
                  Save Identity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal (admin only) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-850">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-xs font-sans uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Set Password
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSetPassword} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-sans text-slate-400 uppercase font-semibold">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Permissions Matrix Modal (admin only) */}
      {permissionsModalGroup && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-850">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xs font-sans uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Permissions - {permissionsModalGroup.name}
              </h3>
              <button
                type="button"
                onClick={() => setPermissionsModalGroup(null)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {permissionsLoading ? (
                <p className="text-xs text-slate-400">Loading current grants...</p>
              ) : (
                Object.entries(permissionsByDomain).map(([domain, perms]) => (
                  <div key={domain} className="space-y-2">
                    <h4 className="text-[10px] font-sans uppercase text-slate-400 font-bold tracking-wide">
                      {domain.replace(/-/g, " ")}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.key}
                          className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={groupPermissionKeys.has(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            className="mt-0.5 cursor-pointer"
                          />
                          <span className="text-slate-700 dark:text-slate-300">{perm.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setPermissionsModalGroup(null)}
                className="px-4 py-2 border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={permissionsLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#05375c] text-white hover:bg-[#074776] text-xs font-bold rounded cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
