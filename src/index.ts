import { HttpClient, HttpClientOptions, CacheConfig } from './client/HttpClient';
import { CatalogSearch } from './modules/CatalogSearch';
import { ResourceDetailModule } from './modules/ResourceDetail';
import { ApplySubmit } from './modules/ApplySubmit';
import { AuthorizationStatus } from './modules/AuthorizationStatus';
import { UsageRecordModule } from './modules/UsageRecord';
import { SDKConfig } from './types';
import { SDKError, ParameterMissingError, isParameterError } from './errors';
import { IRequestAdapter } from './client/adapter/IRequestAdapter';
import { ICache } from './cache/ICache';
import { MemoryCache } from './cache/MemoryCache';
import { MockRequestAdapter } from './client/adapter/MockRequestAdapter';
import { MockDataGenerator } from './client/adapter/MockDataGenerator';

export interface DataCatalogSDKOptions {
  adapter?: IRequestAdapter;
  cache?: ICache;
  cacheConfig?: CacheConfig;
  enableMock?: boolean;
  mockConfig?: {
    delay?: number;
    failureRate?: number;
    failOnParamValidation?: boolean;
  };
}

export class DataCatalogSDK {
  private readonly config: SDKConfig;
  private readonly client: HttpClient;
  private readonly options: DataCatalogSDKOptions;

  public readonly catalog: CatalogSearch;
  public readonly resource: ResourceDetailModule;
  public readonly apply: ApplySubmit;
  public readonly authorization: AuthorizationStatus;
  public readonly usage: UsageRecordModule;

  constructor(config: SDKConfig, options: DataCatalogSDKOptions = {}) {
    this.validateConfig(config);
    this.config = config;
    this.options = options;

    let adapter: IRequestAdapter | undefined = options.adapter;
    if (options.enableMock && !adapter) {
      adapter = new MockRequestAdapter({
        baseUrl: config.baseUrl,
        timeout: config.timeout || 30000,
        delay: options.mockConfig?.delay ?? 100,
        failureRate: options.mockConfig?.failureRate ?? 0,
        failOnParamValidation: options.mockConfig?.failOnParamValidation ?? true
      });
    }

    const httpClientOptions: HttpClientOptions = {
      adapter,
      cache: options.cache,
      cacheConfig: options.cacheConfig
    };

    this.client = new HttpClient(config, httpClientOptions);

    this.catalog = new CatalogSearch(this.client);
    this.resource = new ResourceDetailModule(this.client);
    this.apply = new ApplySubmit(this.client);
    this.authorization = new AuthorizationStatus(this.client);
    this.usage = new UsageRecordModule(this.client);
  }

  private validateConfig(config: SDKConfig): void {
    if (!config.baseUrl) {
      throw new ParameterMissingError('baseUrl');
    }
    if (!config.appKey) {
      throw new ParameterMissingError('appKey');
    }
    if (!config.appSecret) {
      throw new ParameterMissingError('appSecret');
    }

    try {
      new URL(config.baseUrl);
    } catch {
      throw new SDKError(40002, 'baseUrl 格式不正确');
    }

    if (config.timeout !== undefined && (config.timeout < 1000 || config.timeout > 300000)) {
      throw new SDKError(40002, 'timeout 必须在 1000 到 300000 毫秒之间');
    }
  }

  public getConfig(): SDKConfig {
    return { ...this.config };
  }

  public getHttpClient(): HttpClient {
    return this.client;
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    version: string;
  }> {
    try {
      const result = await this.client.get<{
        status: string;
        timestamp: string;
        version: string;
      }>('/api/v1/health');

      return {
        status: result.status === 'ok' ? 'healthy' : 'unhealthy',
        timestamp: result.timestamp,
        version: result.version
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: 'unknown'
      };
    }
  }

  public setCacheEnabled(enabled: boolean): void {
    this.client.setCacheEnabled(enabled);
  }

  public isCacheEnabled(): boolean {
    return this.client.isCacheEnabled();
  }

  public invalidateCacheByProductId(productId: string): number {
    return this.client.invalidateCacheByProductId(productId);
  }

  public invalidateCacheByTag(tag: string): number {
    return this.client.invalidateCacheByTag(tag);
  }

  public invalidateCacheByPattern(pattern: RegExp | string): number {
    return this.client.invalidateCacheByPattern(pattern);
  }

  public invalidateAllCache(): void {
    this.client.invalidateAllCache();
  }

  public invalidateAllSearchCache(): number {
    return this.client.invalidateAllSearchCache();
  }

  public invalidateAllResourceCache(): number {
    return this.client.invalidateAllResourceCache();
  }

  public getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    return this.client.getCacheStats();
  }

  public getAdapter(): IRequestAdapter {
    return this.client.getAdapter();
  }

  public getCache(): ICache {
    return this.client.getCache();
  }

  public static createMockSDK(
    config: Partial<SDKConfig> = {},
    mockConfig?: DataCatalogSDKOptions['mockConfig']
  ): DataCatalogSDK {
    const defaultConfig: SDKConfig = {
      baseUrl: 'https://mock-api.example.com',
      appKey: 'mock-app-key',
      appSecret: 'mock-app-secret',
      ...config
    };

    return new DataCatalogSDK(defaultConfig, {
      enableMock: true,
      mockConfig
    });
  }

  public static isParameterError = isParameterError;
}

export * from './types';
export type {
  SyncCheckpoint,
  SyncResultWithCheckpoint,
  AuthorizationCheckResult,
  AuthorizationInvalidReason,
  BatchQueryStatus,
  DetailedBatchResult,
  DetailedBatchResponse,
  SyncTaskState,
  SyncTaskStatus,
  RetryPolicy,
  SyncTaskOptions,
  SyncWithTaskResult
} from './types';
export { DEFAULT_RETRY_POLICY } from './types';
export * from './errors';
export { HttpClient, HttpClientOptions, CacheConfig } from './client/HttpClient';
export { CatalogSearch } from './modules/CatalogSearch';
export { ResourceDetailModule } from './modules/ResourceDetail';
export { ApplySubmit } from './modules/ApplySubmit';
export { AuthorizationStatus } from './modules/AuthorizationStatus';
export { UsageRecordModule } from './modules/UsageRecord';
export { IRequestAdapter, RequestOptions } from './client/adapter/IRequestAdapter';
export { MockRequestAdapter } from './client/adapter/MockRequestAdapter';
export { MockDataGenerator } from './client/adapter/MockDataGenerator';
export { ICache, CacheEntry, CacheOptions } from './cache/ICache';
export { MemoryCache } from './cache/MemoryCache';

export default DataCatalogSDK;
