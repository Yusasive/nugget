import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  PaginatedResponse,
  RoomDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const STATUS_LABELS: Record<HousekeepingTaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

/** PRD §5.12 housekeeping task assignment and completion tracking.
 * Completing a task (status → DONE) automatically marks the room CLEAN
 * server-side, which gates it back into availability for check-in/transfer. */
export function HousekeepingPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canCreate =
    staff?.role === 'SUPER_ADMIN' ||
    staff?.role === 'BRANCH_MANAGER' ||
    staff?.role === 'FRONT_DESK';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ roomId: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<HousekeepingTaskStatus | ''>('');
  const [page, setPage] = useState(1);

  const tasks = useQuery({
    queryKey: ['housekeeping-tasks', page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      return api.get<PaginatedResponse<HousekeepingTaskDto>>(
        `/housekeeping-tasks?${params}`,
      );
    },
  });

  const rooms = useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: () =>
      api.get<PaginatedResponse<RoomDto>>('/rooms?pageSize=100&isActive=true'),
    enabled: drawerOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<HousekeepingTaskDto>('/housekeeping-tasks', {
        branchId: staff?.branchId,
        roomId: form.roomId,
        description: form.description,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create task'),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: HousekeepingTaskStatus;
    }) =>
      api.patch<HousekeepingTaskDto>(`/housekeeping-tasks/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['housekeeping-tasks'] });
      // Completing a task marks the room CLEAN — invalidate the room board too.
      await queryClient.invalidateQueries({ queryKey: ['room-status-board'] });
    },
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm({ roomId: '', description: '' });
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  function nextStatus(
    current: HousekeepingTaskStatus,
  ): HousekeepingTaskStatus | null {
    if (current === 'PENDING') return 'IN_PROGRESS';
    if (current === 'IN_PROGRESS') return 'DONE';
    return null;
  }

  return (
    <>
      <div className="page-header">
        <h2>Housekeeping</h2>
        {canCreate && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDrawerOpen(true)}
          >
            Assign task
          </button>
        )}
      </div>

      {canCreate && (
        <Drawer open={drawerOpen} title="Assign housekeeping task" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="hk-room">Room</label>
              <select
                id="hk-room"
                required
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
              >
                <option value="">Select room…</option>
                {rooms.data?.data.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="hk-desc">Description</label>
              <input
                id="hk-desc"
                required
                placeholder="e.g. Full clean after checkout"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Assigning…' : 'Assign task'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="hk-status">Status</label>
          <select
            id="hk-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as HousekeepingTaskStatus | '');
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      </div>

      {tasks.isPending && <p className="muted">Loading tasks…</p>}
      {tasks.isError && <div className="alert error">Could not load tasks.</div>}

      {tasks.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Description</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No tasks match these filters.
                    </td>
                  </tr>
                )}
                {tasks.data.data.map((task) => {
                  const next = nextStatus(task.status);
                  return (
                    <tr key={task.id}>
                      <td>{task.room.roomNumber}</td>
                      <td>{task.description}</td>
                      <td className="muted">
                        {task.assignedToStaff
                          ? `${task.assignedToStaff.firstName} ${task.assignedToStaff.lastName}`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            task.status === 'DONE'
                              ? 'success'
                              : task.status === 'IN_PROGRESS'
                                ? 'warning'
                                : 'info'
                          }`}
                        >
                          {STATUS_LABELS[task.status]}
                        </span>
                      </td>
                      <td className="muted">
                        {task.completedAt
                          ? new Date(task.completedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        {next && (
                          <button
                            type="button"
                            className="btn-link"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              updateStatus.mutate({ id: task.id, status: next })
                            }
                          >
                            Mark {STATUS_LABELS[next].toLowerCase()}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={tasks.data.page}
            totalPages={tasks.data.totalPages}
            total={tasks.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
