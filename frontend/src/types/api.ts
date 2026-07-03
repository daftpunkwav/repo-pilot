export interface ApiError {
  code: string;
  message: string;
  details?: Array<Record<string, unknown>>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}
