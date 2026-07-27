/** Shared envelope for every paginated list endpoint. */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Every paginated endpoint accepts at least these two. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
