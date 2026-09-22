"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Download,
  Info,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import type {
  AccessScope,
  ApiRoutePolicy,
  GroupGrant,
  PermissionCatalogEntry,
  PermissionRisk,
  User,
  UserGroup,
} from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import { RBAC } from "@/lib/auth";
import MultiSelect from "@/components/ui/multi-select";

interface Props {
  initialGroups: UserGroup[];
  catalog: PermissionCatalogEntry[];
  routes: ApiRoutePolicy[];
  currentUser: User;
  initialGroupId: string | null;
}

type Tab = "roles" | "policies";
type ModalMode = "create" | "edit" | "copy";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const SCOPE_LABEL: Record<AccessScope, string> = {
  ALL: "All records",
  BU: "Own Business Unit",
  DEPARTMENT: "Own department",
  MEMBER: "Plans I lead or join",
};

/** How wide a scope is; you can only hand on a scope as wide as your own or narrower. */
const SCOPE_RANK: Record<AccessScope, number> = { ALL: 4, BU: 3, DEPARTMENT: 2, MEMBER: 2 };

const RISK_LABEL: Record<PermissionRisk, string> = {
  HIGH_PRIVILEGE: "High privilege",
  CHANGES_DATA: "Changes data",
};

const RISK_STYLE: Record<PermissionRisk, string> = {
  HIGH_PRIVILEGE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  CHANGES_DATA: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
};

/** Permissions that only make sense together (findings are stored as execution schedules). */
const COMPANIONS: Record<string, string[]> = {
  "findings:view": ["execution-schedules:view"],
};

const chip = "inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-semibold leading-none";
const chipNeutral = `${chip} bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700`;
const inputCls =
  "bg-muted border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground";

interface PickProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

/** Single-choice dropdown (the project's custom select; no native select elements). */
function Pick({ value, onChange, options, disabled, className = "min-w-[150px]" }: PickProps) {
  return (
    <div className={className}>
      <MultiSelect
        singleSelect={true}
        selectedValues={[value]}
        options={options}
        disabled={disabled}
        onChange={(values) => {
          const next = values[0];
          if (next) onChange(next);
        }}
      />
    </div>
  );
}

export default function AccessControlClient({
  initialGroups,
  catalog,
  routes,
  currentUser,
  initialGroupId,
}: Props) {
  const [tab, setTab] = useState<Tab>("roles");
  const [groups, setGroups] = useState<UserGroup[]>(initialGroups);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialGroups.find((g) => g.id === initialGroupId)?.id ?? initialGroups[0]?.id ?? null,
  );
  const [groupSearch, setGroupSearch] = useState("");

  // The selected group's saved grants and the draft being edited.
  const [saved, setSaved] = useState<Map<string, AccessScope>>(new Map());
  const [draft, setDraft] = useState<Map<string, AccessScope>>(new Map());
  // Which group the saved/draft grants below belong to; "loading" is just "not that group yet".
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [riskFilter, setRiskFilter] = useState<"ALL" | PermissionRisk>("ALL");

  const [modal, setModal] = useState<ModalMode | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalKeycloakGroup, setModalKeycloakGroup] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canManage = RBAC.can(currentUser, "user-groups:manage-permissions");
  const canCreate = RBAC.can(currentUser, "user-groups:create");
  const canUpdate = RBAC.can(currentUser, "user-groups:update");
  const canDelete = RBAC.can(currentUser, "user-groups:delete");
  const mine = currentUser.grants ?? {};

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const catalogByKey = useMemo(() => new Map(catalog.map((c) => [c.key, c])), [catalog]);
  const modules = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of catalog) seen.set(c.module, c.moduleLabel);
    return [...seen.entries()];
  }, [catalog]);

  // Load the selected group's grants.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    clientApi<GroupGrant[]>(`/user-groups/${selectedId}/permissions`)
      .then((grants) => {
        if (cancelled) return;
        const map = new Map(grants.map((g) => [g.key, g.scope]));
        setSaved(map);
        setDraft(new Map(map));
        setLoadedId(selectedId);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadedId(selectedId);
        showFeedback(`Error: ${errorMessage(e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  const loading = selectedId !== null && selectedId !== loadedId;

  // --- what may this admin hand out? (never more than they hold themselves) ---
  const maySet = (key: string, scope: AccessScope) => {
    const held = mine[key];
    return !!held && SCOPE_RANK[scope] <= SCOPE_RANK[held];
  };
  const widestAllowed = (entry: PermissionCatalogEntry): AccessScope =>
    entry.scopes.find((s) => maySet(entry.key, s)) ?? "ALL";

  // --- draft editing ---
  const assign = (next: Map<string, AccessScope>, entry: PermissionCatalogEntry) => {
    if (next.has(entry.key)) return;
    next.set(entry.key, widestAllowed(entry));
    // Writing needs to see the records, and some views need a companion view.
    const view = catalogByKey.get(`${entry.module}:view`);
    if (view && entry.action !== "view" && !next.has(view.key) && maySet(view.key, "ALL")) {
      next.set(view.key, widestAllowed(view));
    }
    for (const companion of COMPANIONS[entry.key] ?? []) {
      const c = catalogByKey.get(companion);
      if (c && !next.has(c.key) && maySet(c.key, "ALL")) next.set(c.key, widestAllowed(c));
    }
  };

  const unassign = (next: Map<string, AccessScope>, entry: PermissionCatalogEntry) => {
    next.delete(entry.key);
    // Without view access none of the module's other permissions can work.
    if (entry.action === "view") {
      for (const c of catalog) {
        if (c.module === entry.module && c.action !== "view") next.delete(c.key);
      }
    }
    for (const [key, companions] of Object.entries(COMPANIONS)) {
      if (companions.includes(entry.key)) next.delete(key);
    }
  };

  const toggle = (entry: PermissionCatalogEntry) => {
    setDraft((prev) => {
      const next = new Map(prev);
      if (next.has(entry.key)) unassign(next, entry);
      else assign(next, entry);
      return next;
    });
  };

  const setScope = (key: string, scope: AccessScope) =>
    setDraft((prev) => new Map(prev).set(key, scope));

  const canToggleOn = (entry: PermissionCatalogEntry) => maySet(entry.key, "MEMBER") || maySet(entry.key, "ALL");

  const visible = catalog.filter((c) => {
    if (moduleFilter !== "ALL" && c.module !== moduleFilter) return false;
    const assigned = draft.has(c.key);
    if (statusFilter === "ASSIGNED" && !assigned) return false;
    if (statusFilter === "UNASSIGNED" && assigned) return false;
    if (riskFilter !== "ALL" && !c.risks.includes(riskFilter)) return false;
    const q = search.trim().toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.key.toLowerCase().includes(q);
  });

  const setAllVisible = (on: boolean) => {
    setDraft((prev) => {
      const next = new Map(prev);
      for (const entry of visible) {
        if (on && canToggleOn(entry)) assign(next, entry);
        if (!on) unassign(next, entry);
      }
      return next;
    });
  };

  const changes = useMemo(() => {
    let n = 0;
    for (const [k, s] of draft) if (saved.get(k) !== s) n++;
    for (const k of saved.keys()) if (!draft.has(k)) n++;
    return n;
  }, [draft, saved]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await clientApi(`/user-groups/${selected.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ grants: [...draft.entries()].map(([key, scope]) => ({ key, scope })) }),
      });
      setSaved(new Map(draft));
      setGroups((gs) => gs.map((g) => (g.id === selected.id ? { ...g, permissionCount: draft.size } : g)));
      showFeedback(`Permissions saved for "${selected.name}".`);
    } catch (e) {
      showFeedback(`Error: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  // --- role create / edit / copy / delete ---
  const openModal = (mode: ModalMode) => {
    setModal(mode);
    setModalName(mode === "copy" && selected ? `${selected.name} (copy)` : mode === "edit" && selected ? selected.name : "");
    setModalDesc(mode === "create" ? "" : selected?.description ?? "");
    setModalKeycloakGroup(mode === "edit" ? selected?.keycloakGroup ?? "" : "");
  };

  const submitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal || !modalName.trim()) return;
    try {
      if (modal === "create") {
        const g = await clientApi<UserGroup>("/user-groups", {
          method: "POST",
          body: JSON.stringify({ name: modalName, description: modalDesc, keycloakGroup: modalKeycloakGroup || null }),
        });
        setGroups((gs) => [...gs, g].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedId(g.id);
        showFeedback(`Role "${g.name}" created. Assign its permissions below.`);
      } else if (modal === "edit" && selected) {
        const g = await clientApi<UserGroup>(`/user-groups/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: modalName, description: modalDesc, keycloakGroup: modalKeycloakGroup || null }),
        });
        setGroups((gs) => gs.map((x) => (x.id === g.id ? g : x)).sort((a, b) => a.name.localeCompare(b.name)));
        showFeedback("Role updated.");
      } else if (modal === "copy" && selected) {
        const g = await clientApi<UserGroup>(`/user-groups/${selected.id}/clone`, {
          method: "POST",
          body: JSON.stringify({ name: modalName }),
        });
        setGroups((gs) => [...gs, g].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedId(g.id);
        showFeedback(`Copied to "${g.name}" with all ${g.permissionCount ?? 0} permissions.`);
      }
      setModal(null);
    } catch (err) {
      showFeedback(`Error: ${errorMessage(err)}`);
    }
  };

  const doDelete = async () => {
    if (!selected) return;
    try {
      await clientApi(`/user-groups/${selected.id}`, { method: "DELETE" });
      const remaining = groups.filter((g) => g.id !== selected.id);
      setGroups(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setConfirmDelete(false);
      showFeedback(`Role "${selected.name}" deleted. Its members now use their role defaults.`);
    } catch (err) {
      showFeedback(`Error: ${errorMessage(err)}`);
    }
  };

  const shownGroups = groups.filter((g) => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" /> Access Control
          </h1>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Roles (user groups) decide what each person can see and do. View access is denied unless granted, and can be
            limited to a person&apos;s own department or Business Unit.
          </p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-md self-start">
          {(
            [
              ["roles", "Roles"],
              ["policies", "API Resource Policies"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-md bg-card border border-border text-xs text-foreground shadow-sm">{feedback}</div>
      )}

      {tab === "roles" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          {/* Role list */}
          <aside className="bg-card border border-border rounded-lg shadow-sm p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search roles"
                  className={`${inputCls} w-full pl-8 py-1.5`}
                />
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => openModal("create")}
                  title="New role"
                  className="p-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {shownGroups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (g.id === selectedId) return;
                      if (changes > 0 && !window.confirm("Discard your unsaved permission changes?")) return;
                      setSelectedId(g.id);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                      g.id === selectedId
                        ? "bg-primary/10 border-primary/40 text-foreground"
                        : "border-transparent hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {g.memberCount ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="w-3 h-3" /> {g.permissionCount ?? 0}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {shownGroups.length === 0 && <li className="text-xs text-muted-foreground px-3 py-2">No roles found.</li>}
            </ul>
          </aside>

          {/* Selected role */}
          <section className="space-y-4 min-w-0">
            {!selected ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center text-xs text-muted-foreground">
                Select or create a role to manage its permissions.
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h2 className="text-sm font-bold text-foreground">{selected.name}</h2>
                      <p className="text-xs text-muted-foreground">{selected.description || "No description provided."}</p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-bold text-foreground">{draft.size}</span> of {catalog.length} permissions
                        assigned · {selected.memberCount ?? 0} member(s)
                      </p>
                      {selected.keycloakGroup && (
                        <p className="text-[10px] text-muted-foreground">
                          Synced from Keycloak group <span className={`${chipNeutral} font-mono`}>{selected.keycloakGroup}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => openModal("copy")}
                          title="Copy role with all permissions"
                          className="p-2 rounded-md border border-border hover:bg-muted text-foreground cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => openModal("edit")}
                          title="Edit name and description"
                          className="p-2 rounded-md border border-border hover:bg-muted text-foreground cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          title="Delete role"
                          className="p-2 rounded-md border border-border hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search permissions"
                        className={`${inputCls} w-full pl-8`}
                      />
                    </div>
                    <Pick
                      value={moduleFilter}
                      onChange={setModuleFilter}
                      options={[{ value: "ALL", label: "All modules" }, ...modules.map(([m, label]) => ({ value: m, label }))]}
                    />
                    <Pick
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                      options={[
                        { value: "ALL", label: "All status" },
                        { value: "ASSIGNED", label: "Assigned" },
                        { value: "UNASSIGNED", label: "Unassigned" },
                      ]}
                    />
                    <Pick
                      value={riskFilter}
                      onChange={(v) => setRiskFilter(v as typeof riskFilter)}
                      options={[
                        { value: "ALL", label: "Any risk" },
                        { value: "HIGH_PRIVILEGE", label: "High privilege" },
                        { value: "CHANGES_DATA", label: "Changes data" },
                      ]}
                    />
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-muted-foreground">{visible.length} shown:</span>
                      <button type="button" onClick={() => setAllVisible(true)} className="font-semibold text-primary hover:underline cursor-pointer">
                        Assign all
                      </button>
                      <button type="button" onClick={() => setAllVisible(false)} className="font-semibold text-primary hover:underline cursor-pointer">
                        Unassign all
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <p className="text-xs text-muted-foreground px-1">Loading permissions…</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {visible.map((entry) => {
                      const scope = draft.get(entry.key);
                      const assigned = scope !== undefined;
                      const blocked = !assigned && !canToggleOn(entry);
                      const disabled = !canManage || blocked;
                      return (
                        <div
                          key={entry.key}
                          className={`bg-card border rounded-lg p-3.5 space-y-2.5 ${
                            assigned ? "border-primary/40" : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground">{entry.title}</div>
                              <div className="text-[10px] font-mono text-muted-foreground break-all">{entry.key}</div>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={assigned}
                              aria-label={`${assigned ? "Unassign" : "Assign"} ${entry.title}`}
                              disabled={disabled}
                              title={blocked ? "You don't hold this permission yourself, so you can't grant it." : undefined}
                              onClick={() => toggle(entry)}
                              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                                assigned ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                  assigned ? "translate-x-4" : ""
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className={chipNeutral}>{entry.moduleLabel}</span>
                            <span className={`${chip} bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900`}>
                              {entry.action}
                            </span>
                            {entry.risks.map((r) => (
                              <span key={r} className={`${chip} ${RISK_STYLE[r]}`}>
                                {RISK_LABEL[r]}
                              </span>
                            ))}
                          </div>
                          {entry.scopes.length > 1 && assigned && (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="shrink-0">Can see</span>
                              <Pick
                                className="flex-1 min-w-0"
                                value={scope}
                                disabled={!canManage}
                                onChange={(v) => setScope(entry.key, v as AccessScope)}
                                options={entry.scopes
                                  .filter((sc) => maySet(entry.key, sc) || sc === scope)
                                  .map((sc) => ({ value: sc, label: SCOPE_LABEL[sc] }))}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {visible.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-full px-1">No permissions match these filters.</p>
                    )}
                  </div>
                )}

                {canManage && changes > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,520px)] flex items-center justify-between gap-3 bg-card border border-primary/40 rounded-lg shadow-2xl px-4 py-3">
                    <span className="text-xs text-foreground">
                      <span className="font-bold">{changes}</span> unsaved change{changes === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft(new Map(saved))}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Discard
                      </button>
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded cursor-pointer hover:opacity-90 disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save permissions"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      ) : (
        <PoliciesTab routes={routes} catalog={catalog} />
      )}

      {/* Create / edit / copy role */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-fade-in">
          <form
            onSubmit={submitModal}
            className="bg-card w-full max-w-md rounded-lg shadow-2xl border border-border overflow-hidden"
          >
            <div className="px-6 py-4 bg-muted/50 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                {modal === "create" ? "New role" : modal === "edit" ? "Edit role" : "Copy role"}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Name</label>
                <input required autoFocus value={modalName} onChange={(e) => setModalName(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Description</label>
                <input value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              {modal !== "copy" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold">Keycloak group (optional)</label>
                  <input
                    value={modalKeycloakGroup}
                    onChange={(e) => setModalKeycloakGroup(e.target.value)}
                    placeholder="e.g. /finance"
                    className={`${inputCls} w-full font-mono`}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    On SSO sign-in, a person whose Keycloak groups include this name is moved into this role. Leave blank to manage membership by hand.
                  </p>
                </div>
              )}
              {modal === "copy" && (
                <p className="text-[11px] text-muted-foreground">
                  The copy gets every permission and scope of &quot;{selected?.name}&quot;, but none of its members.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 border border-border hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded cursor-pointer hover:opacity-90">
                  {modal === "edit" ? "Save" : modal === "copy" ? "Copy role" : "Create role"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && selected && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-lg shadow-2xl border border-border p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Delete &quot;{selected.name}&quot;?</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.memberCount ?? 0} member(s) will be left without a role and fall back to their role defaults.
                  This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 border border-border hover:bg-muted text-foreground text-xs font-bold rounded cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={doDelete} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded cursor-pointer hover:bg-red-700">
                Delete role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// API Resource Policies: every API route and what protects it (read-only, generated from code)
// ---------------------------------------------------------------------------------------------

const ACCESS_LABEL: Record<ApiRoutePolicy["access"], string> = {
  PUBLIC: "Public (no login)",
  AUTHENTICATED: "Any signed-in user",
  PERMISSION: "Needs permission",
  UNDECLARED: "Undeclared",
};

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  POST: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  PATCH: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  PUT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  DELETE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

function PoliciesTab({ routes, catalog }: { routes: ApiRoutePolicy[]; catalog: PermissionCatalogEntry[] }) {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("ALL");
  const [module, setModule] = useState("ALL");
  const [access, setAccess] = useState("ALL");

  const moduleLabels = useMemo(() => new Map(catalog.map((c) => [c.module, c.moduleLabel])), [catalog]);
  const modules = useMemo(() => [...new Set(routes.map((r) => r.module).filter((m): m is string => !!m))].sort(), [routes]);

  const rows = routes.filter((r) => {
    if (method !== "ALL" && r.method !== method) return false;
    if (module !== "ALL" && r.module !== module) return false;
    if (access !== "ALL" && r.access !== access) return false;
    const q = search.trim().toLowerCase();
    return !q || r.path.toLowerCase().includes(q) || r.permissions.some((p) => p.toLowerCase().includes(q)) || (r.title ?? "").toLowerCase().includes(q);
  });

  const exportCsv = () => {
    const header = ["Method", "Path", "Access", "Permissions", "Module", "Description", "Risk"];
    const lines = [header.map(csvCell).join(",")].concat(
      rows.map((r) =>
        [
          r.method,
          r.path,
          ACCESS_LABEL[r.access],
          r.permissions.join(" | "),
          r.module ? moduleLabels.get(r.module) ?? r.module : "",
          r.title ?? "",
          r.risks.map((x) => RISK_LABEL[x]).join(" | "),
        ]
          .map(csvCell)
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oe-portal-api-policies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-card border border-border text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          This list is read from the server&apos;s own route declarations, so it always matches what is really enforced. A
          route needs one of its listed permissions; assign them to a role on the Roles tab. Routes marked{" "}
          <span className="font-semibold text-foreground">Any signed-in user</span> only ever return the caller&apos;s own data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search path or permission" className={`${inputCls} w-full pl-8`} />
        </div>
        <Pick
          value={method}
          onChange={setMethod}
          options={[{ value: "ALL", label: "All methods" }, ...["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => ({ value: m, label: m }))]}
        />
        <Pick
          value={module}
          onChange={setModule}
          options={[{ value: "ALL", label: "All modules" }, ...modules.map((m) => ({ value: m, label: moduleLabels.get(m) ?? m }))]}
        />
        <Pick
          value={access}
          onChange={setAccess}
          options={[
            { value: "ALL", label: "Any access" },
            ...(Object.keys(ACCESS_LABEL) as ApiRoutePolicy["access"][]).map((x) => ({ value: x, label: ACCESS_LABEL[x] })),
          ]}
        />
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded-md cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-muted/60 border-b border-border text-muted-foreground font-bold uppercase">
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Permission</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={`${r.method} ${r.path}`} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <span className={`${chip} ${METHOD_STYLE[r.method] ?? chipNeutral}`}>{r.method}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-foreground">{r.path}</td>
                <td className="px-4 py-2.5 text-foreground">{ACCESS_LABEL[r.access]}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {r.permissions.map((p) => (
                      <span key={p} className="font-mono text-[10px] text-foreground">
                        {p}
                      </span>
                    ))}
                    {r.dynamic && <span className="text-[10px] text-muted-foreground">(one of these, by request)</span>}
                    {r.permissions.length === 0 && <span className="text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-foreground">{r.module ? moduleLabels.get(r.module) ?? r.module : "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.risks.map((x) => (
                      <span key={x} className={`${chip} ${RISK_STYLE[x]}`}>
                        {RISK_LABEL[x]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No routes match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">{rows.length} of {routes.length} routes</p>
    </div>
  );
}
