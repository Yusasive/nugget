import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type {
  BranchDto,
  CreateStaffRequestBody,
  DepartmentDto,
  PaginatedResponse,
  RoleDto,
  StaffDto,
} from "@nugget/shared-types";
import { useAuth } from "../auth/auth-context";
import { Drawer } from "../components/Drawer";
import { Pagination } from "../components/Pagination";
import { PasswordInput } from "../components/PasswordInput";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api, ApiError } from "../lib/api-client";

const EMPTY_FORM = {
  branchId: "",
  roleId: "",
  departmentId: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
};

const EMPTY_FILTERS = { search: "", roleId: "", isActive: "" };

export function StaffPage() {
  const { staff: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const canManage = currentUser?.role === "SUPER_ADMIN";

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const staffList = useQuery({
    queryKey: ["staff", page, debouncedSearch, filters.roleId, filters.isActive],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.roleId) params.set("roleId", filters.roleId);
      if (filters.isActive) params.set("isActive", filters.isActive);
      return api.get<PaginatedResponse<StaffDto>>(`/staff?${params}`);
    },
  });

  // Only Super Admin can read these, and only they see the create form.
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<RoleDto[]>("/roles"),
    enabled: canManage,
  });

  const branches = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => api.get<PaginatedResponse<BranchDto>>("/branches?pageSize=100"),
    enabled: canManage,
  });

  const departments = useQuery({
    queryKey: ["departments", form.branchId],
    queryFn: () =>
      api.get<DepartmentDto[]>(`/departments?branchId=${form.branchId}&isActive=true`),
    enabled: canManage && !!form.branchId,
  });

  const createStaff = useMutation({
    mutationFn: (body: CreateStaffRequestBody) =>
      api.post<StaffDto>("/staff", body),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError ? err.message : "Could not create staff member",
      );
    },
  });

  const toggleActive = useMutation({
    mutationFn: (member: StaffDto) =>
      api.patch<StaffDto>(`/staff/${member.id}`, {
        isActive: !member.isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createStaff.mutate({ ...form, departmentId: form.departmentId || undefined });
  }

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <div className="page-header">
        <h2>Staff</h2>
        {canManage && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDrawerOpen(true)}
          >
            Add staff member
          </button>
        )}
      </div>

      {canManage && (
        <Drawer
          open={drawerOpen}
          title="Add staff member"
          onClose={closeDrawer}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="staff-first">First name</label>
              <input
                id="staff-first"
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="staff-last">Last name</label>
              <input
                id="staff-last"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-email">Email</label>
              <input
                id="staff-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-password">Temporary password</label>
              <PasswordInput
                id="staff-password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-branch">Branch</label>
              <select
                id="staff-branch"
                required
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">Select…</option>
                {branches.data?.data.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff-role">Role</label>
              <select
                id="staff-role"
                required
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              >
                <option value="">Select…</option>
                {roles.data?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff-department">Department (optional)</label>
              <select
                id="staff-department"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                disabled={!form.branchId}
              >
                <option value="">None</option>
                {departments.data?.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={createStaff.isPending}
            >
              {createStaff.isPending ? "Creating…" : "Add staff member"}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="staff-search">Search</label>
          <input
            id="staff-search"
            placeholder="Name or email…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        {canManage && (
          <div className="field">
            <label htmlFor="staff-filter-role">Role</label>
            <select
              id="staff-filter-role"
              value={filters.roleId}
              onChange={(e) => updateFilter({ roleId: e.target.value })}
            >
              <option value="">All roles</option>
              {roles.data?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="staff-filter-status">Status</label>
          <select
            id="staff-filter-status"
            value={filters.isActive}
            onChange={(e) => updateFilter({ isActive: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
        </div>
        {hasActiveFilters && (
          <div className="field clear-filters">
            <label>&nbsp;</label>
            <button type="button" className="btn-link" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {staffList.isPending && <p className="muted">Loading staff…</p>}
      {staffList.isError && (
        <div className="alert error">Could not load staff.</div>
      )}

      {staffList.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {staffList.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="muted">
                      No staff match these filters.
                    </td>
                  </tr>
                )}
                {staffList.data.data.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.firstName} {member.lastName}
                    </td>
                    <td>{member.email}</td>
                    <td>{member.role.label}</td>
                    <td>{member.branch.name}</td>
                    <td>
                      <span
                        className={`pill ${member.isActive ? "success" : "error"}`}
                      >
                        {member.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(member)}
                          disabled={
                            toggleActive.isPending ||
                            member.id === currentUser?.id
                          }
                          title={
                            member.id === currentUser?.id
                              ? "You cannot deactivate yourself"
                              : undefined
                          }
                        >
                          {member.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={staffList.data.page}
            totalPages={staffList.data.totalPages}
            total={staffList.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
