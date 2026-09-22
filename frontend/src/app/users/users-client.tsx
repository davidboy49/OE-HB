"use client";

import { useState } from "react";

import Link from "next/link";
import { Users, Plus, Lock, Mail, X, KeyRound, Power, Save, ShieldCheck } from "lucide-react";
import type { User, Department, UserGroup, UserRole } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import ActionToolbar from "@/components/ui/action-toolbar";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

interface UsersClientProps {
  initialUsers: User[];
  initialDepartments: Department[];
  initialUserGroups: UserGroup[];
  currentUser: User;
}

type Tab = "users" | "groups";

export default function UsersClient({
  initialUsers,
  initialDepartments,
  initialUserGroups,
  currentUser
}: UsersClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [departments] = useState<Department[]>(initialDepartments);
  const [userGroups, setUserGroups] = useState<UserGroup[]>(initialUserGroups);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Group create form (Groups tab)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  // User Edit/Create state variables
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("DEPT_PIC");
  const [userDept, setUserDept] = useState("");
  const [userGroup, setUserGroup] = useState("");
  const [userPassword, setUserPassword] = useState("");

  // Set-password modal (admin only)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  const canCreateUser = RBAC.can(currentUser, "users:create");
  const canEditUser = RBAC.can(currentUser, "users:update");
  const canDeleteUser = RBAC.can(currentUser, "users:delete");
  const canSetPassword = RBAC.can(currentUser, "users:set-password");
  const canCreateGroup = RBAC.can(currentUser, "user-groups:create");
  const canManageGroupPermissions = RBAC.can(currentUser, "user-groups:manage-permissions");
  const canViewGroupPermissions = RBAC.can(currentUser, "user-groups:view");

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
      showFeedback(group ? `${user.name} assigned to "${group.name}".` : `Removed ${user.name} from their group.`);
    }
  };

  const openCreateUserModal = () => {
    setUserModalMode("create");
    setUserName("");
    setUserEmail("");
    setUserRole("DEPT_PIC");
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

    const confirmDel = window.confirm(`Are you sure you want to delete user "${u.name}"? This will delete all their OE requests and documents.`);
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

  const handleToggleActive = async () => {
    const u = users.find((x) => x.id === selectedUserId);
    if (!u) return;
    const makeActive = u.isActive === false;
    if (!makeActive && !window.confirm(`Deactivate ${u.name}? They will be signed out and unable to sign in until reactivated.`)) return;
    try {
      const updated = await clientApi<User>(`/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: makeActive }),
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: updated.isActive } : x)));
      showFeedback(makeActive ? `${u.name} reactivated.` : `${u.name} deactivated.`);
    } catch (err: unknown) {
      showFeedback(`Error: ${getErrorMessage(err)}`);
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const newGroup = await clientApi<UserGroup>("/user-groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc }),
      });
      setUserGroups((groups) => [...groups, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroupName("");
      setNewGroupDesc("");
      setIsCreateGroupOpen(false);
      showFeedback(`User group "${newGroup.name}" created.`);
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
    { label: "OE Leader", value: "OE_LEADER" },
    { label: "OE Member", value: "OE_MEMBER" },
    { label: "Department PIC", value: "DEPT_PIC" }
  ];

  return (
    <div className="space-y-6">

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">User & Access Management</h1>
        <p className="text-xs text-muted-foreground">
          Manage user accounts, governance groups, and per-group API permissions.
        </p>
      </div>

      {/* Feedback notifier */}
      {feedback && (
        <div className="fixed bottom-8 right-8 z-[1100] flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md shadow-md text-xs font-sans font-semibold animate-slide-up border border-primary no-print">
          <span>{feedback}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-semibold cursor-pointer border-b-2 -mb-px transition-colors ${
            activeTab === "users"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Users <span className="text-xs text-muted-foreground">({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`pb-3 text-sm font-semibold cursor-pointer border-b-2 -mb-px transition-colors ${
            activeTab === "groups"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Groups &amp; Permissions <span className="text-xs text-muted-foreground">({userGroups.length})</span>
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div className="border border-border rounded-lg shadow-sm bg-card overflow-hidden">
          <ActionToolbar
            onCreate={canCreateUser ? openCreateUserModal : undefined}
            onEdit={canEditUser && selectedUserId ? openEditUserModal : undefined}
            onDelete={canDeleteUser && selectedUserId ? handleDeleteUser : undefined}
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

          {selectedUserId && (canSetPassword || (canEditUser && selectedUserId !== currentUser.id)) && (
            <div className="px-4 py-2 border-b border-border bg-muted/40 flex flex-wrap items-center gap-x-5 gap-y-1">
              {canSetPassword && (
                <button
                  type="button"
                  onClick={openSetPasswordModal}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Set Password for Selected User
                </button>
              )}
              {canEditUser && selectedUserId !== currentUser.id && (
                <button
                  type="button"
                  onClick={handleToggleActive}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />{" "}
                  {users.find((x) => x.id === selectedUserId)?.isActive === false ? "Reactivate Selected User" : "Deactivate Selected User"}
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-sans font-bold">
                <tr>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">System Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Governance Group</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
                    className={`hover:bg-muted/40 transition-colors select-none cursor-pointer ${
                      u.id === selectedUserId ? "bg-muted/70 font-medium" : ""
                    }`}
                  >
                    <td className="px-6 py-4.5">
                      <div className="font-semibold text-foreground hover:underline cursor-pointer">{u.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {u.email}
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-foreground">
                        {formatRole(u.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="font-medium text-foreground">
                        {u.departmentName || <span className="text-muted-foreground font-normal italic">Unassigned</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      {canEditUser ? (
                        <select
                          value={u.groupId || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleAssignGroup(u.id, e.target.value || null)}
                          className="bg-muted border border-border text-xs rounded px-2 py-1 focus:outline-none cursor-pointer text-foreground"
                        >
                          <option value="">No Group</option>
                          {userGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-foreground">
                          {u.groupName || <span className="text-muted-foreground font-normal italic">Unassigned</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.isActive === false
                              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {u.isActive === false ? "Deactivated" : "Active"}
                        </span>
                        {u.ssoLinked && (
                          <span title="Has signed in through Keycloak SSO" className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                            SSO
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-xs italic">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GROUPS & PERMISSIONS TAB */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Each group grants its members a set of API permissions. Members with no group fall back to a default set for their role.
            </p>
            {canCreateGroup && (
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> New Group
              </button>
            )}
          </div>

          {!canCreateGroup && (
            <div className="flex gap-2 p-3 bg-muted/40 border border-border rounded text-[10px] text-muted-foreground font-sans">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Lacks governance permission to create user groups.</span>
            </div>
          )}

          {isCreateGroupOpen && (
            <form onSubmit={handleCreateGroup} className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-3 animate-fade-in">
              <h3 className="text-[10px] font-sans uppercase text-muted-foreground font-bold">Add New User Group</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-sans text-muted-foreground uppercase font-semibold">Group Name</label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Risk Oversight Panel"
                    className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-sans text-muted-foreground uppercase font-semibold">Description</label>
                  <input
                    type="text"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Describe group goals..."
                    className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <p className="text-[9px] leading-relaxed text-muted-foreground">A group grants its members whatever permissions you tick below - it doesn&apos;t affect anyone&apos;s system role. Set permissions after creating the group.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupOpen(false)}
                  className="px-4 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 bg-primary text-primary-foreground font-semibold text-xs px-4 py-2 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Save Group
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {userGroups.map((group) => {
              return (
                <div key={group.id} className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-3 h-fit">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" /> {group.name}
                  </div>
                  <p className="text-xs text-muted-foreground">{group.description || "No description provided."}</p>
                  <p className="text-[10px] font-sans text-muted-foreground">
                    {users.filter((user) => user.groupId === group.id).length} member(s)
                  </p>

                  {canViewGroupPermissions && (
                    <Link
                      href={`/access-control?group=${group.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {canManageGroupPermissions ? "Manage permissions" : "View permissions"}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-lg shadow-2xl flex flex-col overflow-hidden border border-border">

            <div className="px-6 py-4 bg-muted/50 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-xs font-sans uppercase tracking-wider text-foreground">
                {userModalMode === "create" ? "Create New User" : "Edit User"}
              </h3>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">Full Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Michael Chen"
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">Email Address</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="e.g. michael.chen@company.com"
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">System Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-foreground"
                >
                  <option value="DEPT_PIC">Department PIC</option>
                  <option value="OE_MEMBER">OE Member</option>
                  <option value="OE_LEADER">OE Leader</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">Department</label>
                  <select
                    value={userDept}
                    onChange={(e) => setUserDept(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-foreground"
                  >
                    <option value="">No Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.businessUnitName ? `${d.businessUnitName} - ${d.name}` : d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">User Group</label>
                  <select
                    value={userGroup}
                    onChange={(e) => setUserGroup(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none cursor-pointer text-foreground"
                  >
                    <option value="">No Group</option>
                    {userGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {userModalMode === "create" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">
                    Initial Password <span className="normal-case font-normal">(optional - can be set later)</span>
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="Leave blank to set later"
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold rounded cursor-pointer"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal (admin only) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-lg shadow-2xl flex flex-col overflow-hidden border border-border">
            <div className="px-6 py-4 bg-muted/50 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-xs font-sans uppercase tracking-wider text-foreground">
                Set Password
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSetPassword} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-sans text-muted-foreground uppercase font-semibold">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold rounded cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
