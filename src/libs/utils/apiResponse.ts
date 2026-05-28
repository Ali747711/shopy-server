export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  code: number;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta;
}

export const ok = <T>(data: T, meta?: ApiMeta): ApiResponse<T> => ({
  success: true,
  data,
  error: null,
  ...(meta ? { meta } : {}),
});

export const fail = (code: number, message: string): ApiResponse<null> => ({
  success: false,
  data: null,
  error: { code, message },
});
