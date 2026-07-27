import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { BranchDto, PaginatedResponse } from "@nugget/shared-types";
import { Drawer } from "../components/Drawer";
import { Pagination } from "../components/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api, ApiError } from "../lib/api-client";

const EMPTY_FILTERS = { search: "", isActive: "" };

export function BranchesPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const branches = useQuery({
    queryKey: ["branches", page, debouncedSearch, filters.isActive],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.isActive) params.set("isActive", filters.isActive);
      return api.get<PaginatedResponse<BranchDto>>(`/branches?${params}`);
    },
  });

  const createBranch = useMutation({
    mutationFn: (body: { name: string; address?: string }) =>
      api.post<BranchDto>("/branches", body),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError ? err.message : "Could not create branch",
      );
    },
  });

  const toggleActive = useMutation({
    mutationFn: (branch: BranchDto) =>
      api.patch<BranchDto>(`/branches/${branch.id}`, {
        isActive: !branch.isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setName("");
    setAddress("");
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createBranch.mutate({ name, address: address || undefined });
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
        <h2>Branches</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setDrawerOpen(true)}
        >
          Add branch
        </button>
      </div>

      <Drawer open={drawerOpen} title="Add branch" onClose={closeDrawer}>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="branch-name">Branch name</label>
            <input
              id="branch-name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="branch-address">Address (optional)</label>
            <input
              id="branch-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={createBranch.isPending}
          >
            {createBranch.isPending ? "Adding…" : "Add branch"}
          </button>
        </form>
      </Drawer>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="branch-search">Search</label>
          <input
            id="branch-search"
            placeholder="Name…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="branch-status">Status</label>
          <select
            id="branch-status"
            value={filters.isActive}
            onChange={(e) => updateFilter({ isActive: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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

      {branches.isPending && <p className="muted">Loading branches…</p>}
      {branches.isError && (
        <div className="alert error">Could not load branches.</div>
      )}

      {branches.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {branches.data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No branches match these filters.
                    </td>
                  </tr>
                )}
                {branches.data.data.map((branch) => (
                  <tr key={branch.id}>
                    <td>{branch.name}</td>
                    <td>
                      {branch.address ?? <span className="muted">Not set</span>}
                    </td>
                    <td>
                      <span
                        className={`pill ${branch.isActive ? "success" : "error"}`}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => toggleActive.mutate(branch)}
                        disabled={toggleActive.isPending}
                      >
                        {branch.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={branches.data.page}
            totalPages={branches.data.totalPages}
            total={branches.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
