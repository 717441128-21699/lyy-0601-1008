import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { SDKConfig, ApiResponse } from '../types';
import { handleApiError, SDKError, ErrorCode } from '../errors';
import { IRequestAdapter, RequestOptions } from './adapter/IRequestAdapter';
import { ICache, CacheOptions } from '../cache/ICache';
import { MemoryCache } from '../cache/MemoryCache';

export interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number;
  maxEntries?: number;
  includePatterns?: RegExp[];
  excludePatterns?: RegExp[];
  autoInvalidateOnChange?: boolean;
}

export interface HttpClientOptions {
  adapter?: IRequestAdapter;
  cache?: ICache;
  cacheConfig?: CacheConfig;
}

export class HttpClient {
  private readonly client: AxiosInstance | null = null;
  private readonly config: SDKConfig;
  private readonly adapter: IRequestAdapter;
  private readonly cache: ICache;
  private readonly cacheConfig: Required<CacheConfig>;

  constructor(config: SDKConfig, options: HttpClientOptions = {}) {
    this.config = config;

    if (options.adapter) {
      this.adapter = options.adapter;
      if (this.adapter.setBaseUrl) {
        this.adapter.setBaseUrl(config.baseUrl);
      }
      if (this.adapter.setDefaultHeaders) {
        this.adapter.setDefaultHeaders({
          'Content-Type': 'application/json',
          'X-App-Key': config.appKey
        });
      }
      if (this.adapter.setTimeout) {
        this.adapter.setTimeout(config.timeout || 30000);
      }
    } else {
      this.client = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout || 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': config.appKey
        }
      });
      this.adapter = this.createAxiosAdapter();
      this.setupInterceptors();
    }

    this.cacheConfig = {
      enabled: options.cacheConfig?.enabled ?? true,
      defaultTTL: options.cacheConfig?.defaultTTL ?? 5 * 60 * 1000,
      maxEntries: options.cacheConfig?.maxEntries ?? 1000,
      includePatterns: options.cacheConfig?.includePatterns ?? [
        /\/catalog\/search/,
        /\/resources\/.*\/detail/,
        /\/resources\/.*\/basic/,
        /\/resources\/.*\/fields/,
        /\/resources\/.*\/sample/,
        /\/resources\/.*\/api-spec/,
        /\/resources\/.*\/service-level/,
        /\/resources\/.*\/pricing/,
        /\/apply\/products\/.*\/materials/
      ],
      excludePatterns: options.cacheConfig?.excludePatterns ?? [],
      autoInvalidateOnChange: options.cacheConfig?.autoInvalidateOnChange ?? true
    };

    if (options.cache) {
      this.cache = options.cache;
    } else {
      const cacheOptions: CacheOptions = {
        defaultTTL: this.cacheConfig.defaultTTL,
        maxEntries: this.cacheConfig.maxEntries,
        enabled: this.cacheConfig.enabled
      };
      this.cache = new MemoryCache(cacheOptions);
    }

    if (this.cacheConfig.autoInvalidateOnChange) {
      this.setupAutoInvalidation();
    }
  }

  private createAxiosAdapter(): IRequestAdapter {
    const self = this;
    return {
      request: async <T>(options: RequestOptions): Promise<ApiResponse<T>> => {
        const config: AxiosRequestConfig = {
          method: options.method,
          url: options.url,
          params: options.params,
          data: options.data,
          headers: options.headers
        };
        const response = await self.client!.request<ApiResponse<T>>(config);
        return response.data;
      },
      get: async <T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> => {
        const response = await self.client!.get<ApiResponse<T>>(url, { params, headers });
        return response.data;
      },
      post: async <T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> => {
        const response = await self.client!.post<ApiResponse<T>>(url, data, { headers });
        return response.data;
      },
      put: async <T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> => {
        const response = await self.client!.put<ApiResponse<T>>(url, data, { headers });
        return response.data;
      },
      delete: async <T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> => {
        const response = await self.client!.delete<ApiResponse<T>>(url, { params, headers });
        return response.data;
      }
    };
  }

  private setupInterceptors(): void {
    if (!this.client) return;

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
          .map((key) => `${key}=${config.params![key]}`)
          .join('&')
      : '';
    const dataStr = config.data ? JSON.stringify(config.data) : '';

    const signStr = `${this.config.appSecret}\n${method}\n${path}\n${timestamp}\n${nonce}\n${paramsStr}\n${dataStr}`;

    return crypto.createHash('sha256').update(signStr).digest('hex');
  }

  private generateCacheKey(method: string, url: string, params?: Record<string, unknown>): string {
    const paramsStr = params ? JSON.stringify(this.sortObject(params)) : '';
    return `${method}:${url}:${paramsStr}`;
  }

  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        const value = obj[key];
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.sortObject(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
        return result;
      }, {} as Record<string, unknown>);
  }

  private shouldCache(method: string, url: string): boolean {
    if (!this.cacheConfig.enabled) return false;
    if (method !== 'GET') return false;

    for (const pattern of this.cacheConfig.excludePatterns) {
      if (pattern.test(url)) return false;
    }

    for (const pattern of this.cacheConfig.includePatterns) {
      if (pattern.test(url)) return true;
    }

    return false;
  }

  private extractProductId(url: string): string | undefined {
    const patterns = [
      /\/resources\/([^/]+)/,
      /\/apply\/products\/([^/]+)/,
      /\/catalog\/products\/([^/]+)/,
      /\/authorization\/([^/]+)(?:\/|$)/,
      /\/([a-z0-9]+(?:-[a-z0-9]+)+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && !match[1].includes('?') && !match[1].includes('#')) {
        return match[1];
      }
    }

    return undefined;
  }

  private getCacheTags(url: string): string[] {
    const tags: string[] = [];
    const productId = this.extractProductId(url);
    if (productId) {
      tags.push(`product:${productId}`);
    }
    if (url.includes('/catalog/search')) {
      tags.push('catalog:search');
    }
    if (url.includes('/resources/')) {
      tags.push('resource:detail');
    }
    return tags;
  }

  private getTTLForUrl(url: string): number {
    if (url.includes('/catalog/search')) {
      return 5 * 60 * 1000;
    }
    if (url.includes('/sample') || url.includes('/fields')) {
      return 30 * 60 * 1000;
    }
    if (url.includes('/detail') || url.includes('/basic')) {
      return 15 * 60 * 1000;
    }
    return this.cacheConfig.defaultTTL;
  }

  private setupAutoInvalidation(): void {
    this.cache.onInvalidate?.((key, value) => {
      if (this.config.debug) {
        console.log('[SDK Cache] Invalidated:', key);
      }
    });
  }

  public async get<T>(url: string, params?: Record<string, unknown>, options?: { skipCache?: boolean }): Promise<T> {
    const cacheKey = this.generateCacheKey('GET', url, params);
    const shouldUseCache = this.shouldCache('GET', url) && !options?.skipCache;

    if (shouldUseCache) {
      const cached = this.cache.get<ApiResponse<T>>(cacheKey);
      if (cached) {
        if (this.config.debug) {
          console.log('[SDK Cache] Hit:', cacheKey);
        }
        if (cached.code === ErrorCode.SUCCESS) {
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }
    }

    const response = await this.adapter.get<T>(url, params);

    if (response.code === ErrorCode.SUCCESS) {
      if (shouldUseCache) {
        const ttl = this.getTTLForUrl(url);
        const tags = this.getCacheTags(url);
        this.cache.set(cacheKey, response, ttl, tags);
        if (this.config.debug) {
          console.log('[SDK Cache] Set:', cacheKey, 'TTL:', ttl);
        }
      }
      return response.data;
    }

    throw handleApiError(response);
  }

  public async post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.adapter.post<T>(url, data);

    if (response.code === ErrorCode.SUCCESS) {
      this.invalidateCacheAfterWrite(url);
      return response.data;
    }

    throw handleApiError(response);
  }

  public async put<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.adapter.put<T>(url, data);

    if (response.code === ErrorCode.SUCCESS) {
      this.invalidateCacheAfterWrite(url);
      return response.data;
    }

    throw handleApiError(response);
  }

  public async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.adapter.delete<T>(url, params);

    if (response.code === ErrorCode.SUCCESS) {
      this.invalidateCacheAfterWrite(url);
      return response.data;
    }

    throw handleApiError(response);
  }

  private invalidateCacheAfterWrite(url: string): void {
    const productId = this.extractProductId(url);
    if (productId) {
      this.invalidateCacheByProductId(productId);
    }
    this.cache.invalidateAllSearch?.();
  }

  public invalidateCacheByKey(key: string): boolean {
    return this.cache.delete(key);
  }

  public invalidateCacheByProductId(productId: string): number {
    return this.cache.invalidateByProductId?.(productId) ?? this.cache.deleteByTag(`product:${productId}`);
  }

  public invalidateCacheByTag(tag: string): number {
    return this.cache.deleteByTag(tag);
  }

  public invalidateCacheByPattern(pattern: RegExp | string): number {
    return this.cache.deleteByPattern(pattern);
  }

  public invalidateAllCache(): void {
    this.cache.clear();
  }

  public invalidateAllSearchCache(): number {
    return this.cache.invalidateAllSearch?.() ?? this.cache.deleteByPattern(/^GET:.*\/catalog\/search/);
  }

  public invalidateAllResourceCache(): number {
    return this.cache.invalidateAllResources?.() ?? this.cache.deleteByPattern(/^GET:.*\/resources\//);
  }

  public setCacheEnabled(enabled: boolean): void {
    this.cache.setEnabled(enabled);
    this.cacheConfig.enabled = enabled;
  }

  public isCacheEnabled(): boolean {
    return this.cache.isEnabled();
  }

  public getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    return this.cache.getStats();
  }

  public getAxiosInstance(): AxiosInstance | null {
    return this.client;
  }

  public getAdapter(): IRequestAdapter {
    return this.adapter;
  }

  public getCache(): ICache {
    return this.cache;
  }
}
