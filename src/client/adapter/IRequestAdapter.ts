import { ApiResponse } from '../../types';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface IRequestAdapter {
  request<T>(options: RequestOptions): Promise<ApiResponse<T>>;

  get<T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>>;
  delete<T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>>;

  setBaseUrl?(baseUrl: string): void;
  setDefaultHeaders?(headers: Record<string, string>): void;
  setTimeout?(timeout: number): void;
}
