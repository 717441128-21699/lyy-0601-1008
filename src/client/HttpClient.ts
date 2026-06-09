import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { SDKConfig, ApiResponse } from '../types';
import { handleApiError, SDKError, ErrorCode } from '../errors';

export class HttpClient {
  private readonly client: AxiosInstance;
  private readonly config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Key': config.appKey
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        const signature = this.generateSignature(config, timestamp, nonce);

        config.headers = config.headers || {};
        config.headers['X-Timestamp'] = timestamp;
        config.headers['X-Nonce'] = nonce;
        config.headers['X-Signature'] = signature;

        if (this.config.debug) {
          console.log('[SDK Request]', {
            method: config.method,
            url: config.url,
            params: config.params,
            data: config.data
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(new SDKError(ErrorCode.UNKNOWN_ERROR, `请求失败: ${error.message}`));
      }
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        if (this.config.debug) {
          console.log('[SDK Response]', {
            status: response.status,
            data: response.data
          });
        }

        const apiResponse = response.data;
        if (apiResponse.code === ErrorCode.SUCCESS) {
          return response;
        }

        return Promise.reject(handleApiError(apiResponse));
      },
      (error) => {
        if (this.config.debug) {
          console.error('[SDK Error]', error);
        }

        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          if (data && typeof data === 'object' && 'code' in data) {
            return Promise.reject(handleApiError(data));
          }

          switch (status) {
            case 401:
              return Promise.reject(
                new SDKError(ErrorCode.UNAUTHORIZED, '未授权访问', data?.traceId || '')
              );
            case 403:
              return Promise.reject(
                new SDKError(ErrorCode.NO_PERMISSION, '无权限访问', data?.traceId || '')
              );
            case 404:
              return Promise.reject(
                new SDKError(ErrorCode.RESOURCE_NOT_FOUND, '资源不存在', data?.traceId || '')
              );
            case 429:
              return Promise.reject(
                new SDKError(ErrorCode.RATE_LIMIT_EXCEEDED, '超出调用频率限制', data?.traceId || '')
              );
            case 500:
              return Promise.reject(
                new SDKError(ErrorCode.INTERNAL_ERROR, '服务器内部错误', data?.traceId || '')
              );
            case 503:
              return Promise.reject(
                new SDKError(ErrorCode.SERVICE_UNAVAILABLE, '服务不可用', data?.traceId || '')
              );
            default:
              return Promise.reject(
                new SDKError(ErrorCode.UNKNOWN_ERROR, `请求失败: ${status}`, data?.traceId || '')
              );
          }
        }

        if (error.code === 'ECONNABORTED') {
          return Promise.reject(new SDKError(ErrorCode.UNKNOWN_ERROR, '请求超时'));
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return Promise.reject(new SDKError(ErrorCode.SERVICE_UNAVAILABLE, '无法连接到服务器'));
        }

        return Promise.reject(new SDKError(ErrorCode.UNKNOWN_ERROR, `网络错误: ${error.message}`));
      }
    );
  }

  private generateSignature(config: AxiosRequestConfig, timestamp: string, nonce: string): string {
    const method = (config.method || 'get').toUpperCase();
    const path = config.url || '';
    const paramsStr = config.params
      ? Object.keys(config.params)
          .sort()
          .map((key) => `${key}=${config.params[key]}`)
          .join('&')
      : '';
    const dataStr = config.data ? JSON.stringify(config.data) : '';

    const signStr = `${this.config.appSecret}\n${method}\n${path}\n${timestamp}\n${nonce}\n${paramsStr}\n${dataStr}`;

    return crypto.createHash('sha256').update(signStr).digest('hex');
  }

  public async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data.data;
  }

  public async post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  public async put<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  public async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, { params });
    return response.data.data;
  }

  public getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}
