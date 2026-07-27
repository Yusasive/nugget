import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type { BranchDto, PaginatedResponse, UpdateBranchRequestBody } from "@nugget/shared-types";
import { api, ApiError } from "../lib/api-client";

type BranchForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
  standardCheckInTime: string;
  standardCheckOutTime: string;
  earlyCheckInFeeAmount: string;
  lateCheckOutFeeAmount: string;
};

function toForm(branch: BranchDto): BranchForm {
  return {
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    standardCheckInTime: branch.standardCheckInTime,
    standardCheckOutTime: branch.standardCheckOutTime,
    earlyCheckInFeeAmount: branch.earlyCheckInFeeAmount ?? "",
    lateCheckOutFeeAmount: branch.lateCheckOutFeeAmount ?? "",
  };
}

/**
 * PRD §5.17 Settings — Super Admin only (§7 role matrix: "Branch & System
 * Settings" is F for Super Admin, "–" for every other role). Room rates,
 * restaurant categories, staff roles, and the audit log already have their
 * own pages (Room Types, Menu, Staff, Audit Log); this page covers the one
 * gap — branch contact info and check-in/out policy, which BranchesPage
 * exposes for create but never surfaces an edit form for.
 */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<BranchForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const branches = useQuery({
    queryKey: ["settings", "branches"],
    queryFn: () => api.get<PaginatedResponse<BranchDto>>("/branches?pageSize=100"),
  });

  useEffect(() => {
    if (!selectedId && branches.data && branches.data.data.length > 0) {
      setSelectedId(branches.data.data[0].id);
    }
  }, [branches.data, selectedId]);

  const selectedBranch = branches.data?.data.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedBranch) setForm(toForm(selectedBranch));
  }, [selectedBranch]);

  const save = useMutation({
    mutationFn: (body: UpdateBranchRequestBody) => api.patch<BranchDto>(`/branches/${selectedId}`, body),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (err: unknown) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : "Could not save settings");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaved(false);
    save.mutate({
      name: form.name,
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      standardCheckInTime: form.standardCheckInTime,
      standardCheckOutTime: form.standardCheckOutTime,
      ...(form.earlyCheckInFeeAmount ? { earlyCheckInFeeAmount: form.earlyCheckInFeeAmount } : {}),
      ...(form.lateCheckOutFeeAmount ? { lateCheckOutFeeAmount: form.lateCheckOutFeeAmount } : {}),
    });
  }

  return (
    <>
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {branches.isPending && <p className="muted">Loading branches…</p>}
      {branches.isError && <div className="alert error">Could not load branches.</div>}

      {branches.data && branches.data.data.length === 0 && (
        <p className="muted">No branches yet — add one from the Branches page first.</p>
      )}

      {branches.data && branches.data.data.length > 0 && (
        <>
          <div className="filter-bar">
            <div className="field">
              <label htmlFor="settings-branch">Branch</label>
              <select
                id="settings-branch"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
              >
                {branches.data.data.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {!branch.isActive ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form && (
            <>
              {error && (
                <div className="alert error" role="alert">
                  {error}
                </div>
              )}
              {saved && !save.isPending && <div className="alert success">Settings saved.</div>}

              <form className="form-card" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="settings-name">Branch name</label>
                  <input
                    id="settings-name"
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-address">Address</label>
                  <input
                    id="settings-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-phone">Phone</label>
                  <input
                    id="settings-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-email">Email</label>
                  <input
                    id="settings-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-checkin">Standard check-in time</label>
                  <input
                    id="settings-checkin"
                    type="time"
                    required
                    value={form.standardCheckInTime}
                    onChange={(e) => setForm({ ...form, standardCheckInTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-checkout">Standard check-out time</label>
                  <input
                    id="settings-checkout"
                    type="time"
                    required
                    value={form.standardCheckOutTime}
                    onChange={(e) => setForm({ ...form, standardCheckOutTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-early-fee">Early check-in fee</label>
                  <input
                    id="settings-early-fee"
                    inputMode="decimal"
                    placeholder="e.g. 50.00"
                    value={form.earlyCheckInFeeAmount}
                    onChange={(e) => setForm({ ...form, earlyCheckInFeeAmount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="settings-late-fee">Late check-out fee</label>
                  <input
                    id="settings-late-fee"
                    inputMode="decimal"
                    placeholder="e.g. 50.00"
                    value={form.lateCheckOutFeeAmount}
                    onChange={(e) => setForm({ ...form, lateCheckOutFeeAmount: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save settings"}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </>
  );
}
