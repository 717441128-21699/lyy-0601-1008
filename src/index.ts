import { HttpClient } from './client/HttpClient';
import { CatalogSearch } from './modules/CatalogSearch';
import { ResourceDetailModule } from './modules/ResourceDetail';
import { ApplySubmit } from './modules/ApplySubmit';
import { AuthorizationStatus } from './modules/AuthorizationStatus';
import { UsageRecordModule } from './modules/UsageRecord';
import { SDKConfig } from './types';
import { SDKError, ParameterMissingError } from './errors';

export class DataCatalogSDK {
  private readonly config: SDKConfig;
  private readonly client: HttpClient;

  public readonly catalog: CatalogSearch;
  public readonly resource: ResourceDetailModule;
  public readonly apply: ApplySubmit;
  public readonly authorization: AuthorizationStatus;
  public readonly usage: UsageRecordModule;

  constructor(config: SDKConfig) {
    this.validateConfig(config);
    this.config = config;
    this.client = new HttpClient(config);

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
}

export * from './types';
export * from './errors';
export { HttpClient } from './client/HttpClient';
export { CatalogSearch } from './modules/CatalogSearch';
export { ResourceDetailModule } from './modules/ResourceDetail';
export { ApplySubmit } from './modules/ApplySubmit';
export { AuthorizationStatus } from './modules/AuthorizationStatus';
export { UsageRecordModule } from './modules/UsageRecord';

export default DataCatalogSDK;
