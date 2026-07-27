import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { MenuCategoryDto, MenuItemDto, PaginatedResponse } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

type Tab = 'categories' | 'items';

const TABS: { key: Tab; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'items', label: 'Items' },
];

/** PRD §5.9 menu management — categories and items behind tabs on one page,
 * mirroring TourCatalogPage's small-co-located-catalogs pattern. */
export function MenuPage() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <>
      <div className="page-header">
        <h2>Menu</h2>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'items' && <ItemsTab />}
    </>
  );
}

const EMPTY_CATEGORY_FORM = { name: '', displayOrder: '0' };

function CategoriesTab() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const categories = useQuery({
    queryKey: ['menu-categories', page],
    queryFn: () => api.get<PaginatedResponse<MenuCategoryDto>>(`/menu-categories?page=${page}&pageSize=50`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<MenuCategoryDto>('/menu-categories', {
        branchId: staff?.branchId,
        name: form.name,
        displayOrder: Number(form.displayOrder),
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create category'),
  });

  const toggleActive = useMutation({
    mutationFn: (category: MenuCategoryDto) =>
      api.patch<MenuCategoryDto>(`/menu-categories/${category.id}`, { isActive: !category.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-categories'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_CATEGORY_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="page-header">
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add category
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add menu category" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="mc-name">Name</label>
              <input
                id="mc-name"
                required
                minLength={2}
                placeholder="e.g. Starters"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="mc-order">Display order</label>
              <input
                id="mc-order"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add category'}
            </button>
          </form>
        </Drawer>
      )}

      {categories.isPending && <p className="muted">Loading categories…</p>}
      {categories.isError && <div className="alert error">Could not load categories.</div>}

      {categories.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Order</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {categories.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="muted">
                      No menu categories yet.
                    </td>
                  </tr>
                )}
                {categories.data.data.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.displayOrder}</td>
                    <td>
                      <span className={`pill ${category.isActive ? 'success' : 'error'}`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(category)}
                          disabled={toggleActive.isPending}
                        >
                          {category.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={categories.data.page}
            totalPages={categories.data.totalPages}
            total={categories.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

const EMPTY_ITEM_FORM = { categoryId: '', name: '', description: '', price: '' };

function ItemsTab() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM_FORM);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const categories = useQuery({
    queryKey: ['menu-categories', 'all'],
    queryFn: () => api.get<PaginatedResponse<MenuCategoryDto>>('/menu-categories?pageSize=100'),
  });

  const items = useQuery({
    queryKey: ['menu-items', page, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (categoryFilter) params.set('categoryId', categoryFilter);
      return api.get<PaginatedResponse<MenuItemDto>>(`/menu-items?${params}`);
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<MenuItemDto>('/menu-items', {
        branchId: staff?.branchId,
        categoryId: form.categoryId,
        name: form.name,
        description: form.description || undefined,
        price: form.price,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create menu item'),
  });

  const toggleAvailable = useMutation({
    mutationFn: (item: MenuItemDto) =>
      api.patch<MenuItemDto>(`/menu-items/${item.id}`, { isAvailable: !item.isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_ITEM_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="page-header">
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add item
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add menu item" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="mi-category">Category</label>
              <select
                id="mi-category"
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select…</option>
                {categories.data?.data.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mi-name">Name</label>
              <input
                id="mi-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="mi-price">Price</label>
              <input
                id="mi-price"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="mi-description">Description (optional)</label>
              <input
                id="mi-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add item'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="mi-filter-category">Category</label>
          <select
            id="mi-filter-category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.data?.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.isPending && <p className="muted">Loading items…</p>}
      {items.isError && <div className="alert error">Could not load menu items.</div>}

      {items.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Availability</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {items.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      No menu items match these filters.
                    </td>
                  </tr>
                )}
                {items.data.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category.name}</td>
                    <td>{item.price}</td>
                    <td>
                      <span className={`pill ${item.isAvailable ? 'success' : 'warning'}`}>
                        {item.isAvailable ? 'Available' : '86\'d'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleAvailable.mutate(item)}
                          disabled={toggleAvailable.isPending}
                        >
                          {item.isAvailable ? 'Mark 86\'d' : 'Mark available'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={items.data.page}
            totalPages={items.data.totalPages}
            total={items.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
