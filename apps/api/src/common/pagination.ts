import type { PaginatedResponse, PaginationQuery } from '@nugget/shared-types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Every list endpoint's page/pageSize handling in one place — clamps to
 * sane bounds (page >= 1, 1 <= pageSize <= 100) so a malformed or
 * adversarial query can't request an unbounded result set or a negative
 * skip.
 */
export function normalizePagination(
  query: PaginationQuery,
): NormalizedPagination {
  const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
  const pageSize =
    query.pageSize && query.pageSize > 0
      ? Math.min(Math.floor(query.pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
