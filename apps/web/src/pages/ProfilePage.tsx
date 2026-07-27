import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type { ChangePasswordRequestBody, StaffDto, UpdateOwnProfileRequestBody } from "@nugget/shared-types";
import { api, ApiError } from "../lib/api-client";

const EMPTY_PASSWORD_FORM = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Self-service profile — every role lands here, unlike /settings (Super
 * Admin only, branch-level policy). Deliberately narrower than the admin
 * Staff edit form: no role, department, or active-status fields, so a
 * staff member editing their own profile can never touch their own
 * permissions.
 */
export function ProfilePage() {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["staff", "me"],
    queryFn: () => api.get<StaffDto>("/staff/me"),
  });

  return (
    <>
      <div className="page-header">
        <h2>My Profile</h2>
      </div>

      {me.isPending && <p className="muted">Loading…</p>}
      {me.isError && <div className="alert error">Could not load your profile.</div>}

      {me.data && (
        <>
          <ProfileDetailsForm
            staff={me.data}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["staff", "me"] })}
          />
          <ChangePasswordForm />
        </>
      )}
    </>
  );
}

function ProfileDetailsForm({ staff, onSaved }: { staff: StaffDto; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: staff.firstName,
    lastName: staff.lastName,
    phone: staff.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({ firstName: staff.firstName, lastName: staff.lastName, phone: staff.phone ?? "" });
  }, [staff]);

  const save = useMutation({
    mutationFn: (body: UpdateOwnProfileRequestBody) => api.patch<StaffDto>("/staff/me", body),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      onSaved();
    },
    onError: (err: unknown) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : "Could not save profile");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      ...(form.phone ? { phone: form.phone } : {}),
    });
  }

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h3>Profile details</h3>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {saved && !save.isPending && <div className="alert success">Profile saved.</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="profile-first-name">First name</label>
          <input
            id="profile-first-name"
            required
            minLength={1}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-last-name">Last name</label>
          <input
            id="profile-last-name"
            required
            minLength={1}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-phone">Phone</label>
          <input
            id="profile-phone"
            placeholder="e.g. +234 801 234 5678"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={staff.email} disabled />
        </div>
        <div className="field">
          <label htmlFor="profile-role">Role</label>
          <input id="profile-role" value={staff.role.label} disabled />
        </div>
        <div className="field">
          <label htmlFor="profile-branch">Branch</label>
          <input id="profile-branch" value={staff.branch.name} disabled />
        </div>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: (body: ChangePasswordRequestBody) => api.post<void>("/auth/change-password", body),
    onSuccess: () => {
      setError(null);
      setSuccess(true);
      setForm(EMPTY_PASSWORD_FORM);
    },
    onError: (err: unknown) => {
      setSuccess(false);
      setError(err instanceof ApiError ? err.message : "Could not change password");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess(false);
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }
    changePassword.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  }

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h3>Change password</h3>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {success && <div className="alert success">Password changed. Other signed-in sessions have been logged out.</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="profile-current-password">Current password</label>
          <input
            id="profile-current-password"
            type="password"
            required
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-new-password">New password</label>
          <input
            id="profile-new-password"
            type="password"
            required
            minLength={8}
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-confirm-password">Confirm new password</label>
          <input
            id="profile-confirm-password"
            type="password"
            required
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={changePassword.isPending}>
          {changePassword.isPending ? "Changing…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
