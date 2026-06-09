import { HttpClient } from '../client/HttpClient';
import { ResourceDetail, DataField, SampleData, DataProduct, BatchResponse, BatchResult } from '../types';
import { validateRequiredParams, validateParamRange, SDKError, ErrorCode, isParameterError } from '../errors';

export class ResourceDetailModule {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async getDetail(productId: string): Promise<ResourceDetail> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<ResourceDetail>(
      `/api/v1/resources/${productId}/detail`
    );

    return result;
  }

  public async getBasicInfo(productId: string): Promise<DataProduct> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<DataProduct>(
      `/api/v1/resources/${productId}/basic`
    );

    return result;
  }

  public async getFields(productId: string): Promise<DataField[]> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<DataField[]>(
      `/api/v1/resources/${productId}/fields`
    );

    return result;
  }

  public async getFieldDetail(productId: string, fieldName: string): Promise<DataField> {
    validateRequiredParams({ productId, fieldName }, ['productId', 'fieldName']);

    const result = await this.client.get<DataField>(
      `/api/v1/resources/${productId}/fields/${encodeURIComponent(fieldName)}`
    );

    return result;
  }

  public async getSampleData(productId: string, limit: number = 10): Promise<SampleData> {
    validateRequiredParams({ productId }, ['productId']);

    if (limit < 1 || limit > 100) {
      throw new Error('limit 必须在 1 到 100 之间');
    }

    const result = await this.client.get<SampleData>(
      `/api/v1/resources/${productId}/sample`,
      { limit }
    );

    return result;
  }

  public async getUsageGuide(productId: string): Promise<{
    guide: string;
    examples: Array<{
      title: string;
      description: string;
      code: string;
    }>;
    faqs: Array<{
      question: string;
      answer: string;
    }>;
  }> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<{
      guide: string;
      examples: Array<{
        title: string;
        description: string;
        code: string;
      }>;
      faqs: Array<{
        question: string;
        answer: string;
      }>;
    }>(`/api/v1/resources/${productId}/guide`);

    return result;
  }

  public async getApiSpec(productId: string): Promise<{
    baseUrl: string;
    authentication: string;
    endpoints: Array<{
      path: string;
      method: string;
      summary: string;
      description: string;
      parameters: Array<{
        name: string;
        in: 'query' | 'body' | 'path' | 'header';
        required: boolean;
        type: string;
        description: string;
      }>;
      responses: Record<
        string,
        {
          description: string;
          schema: Record<string, unknown>;
        }
      >;
    }>;
  }> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<{
      baseUrl: string;
      authentication: string;
      endpoints: Array<{
        path: string;
        method: string;
        summary: string;
        description: string;
        parameters: Array<{
          name: string;
          in: 'query' | 'body' | 'path' | 'header';
          required: boolean;
          type: string;
          description: string;
        }>;
        responses: Record<
          string,
          {
            description: string;
            schema: Record<string, unknown>;
          }
        >;
      }>;
    }>(`/api/v1/resources/${productId}/api-spec`);

    return result;
  }

  public async getServiceLevel(productId: string): Promise<{
    availability: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    supportChannels: string[];
    uptimeLast30Days: number;
    incidentsLast30Days: number;
  }> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<{
      availability: number;
      avgResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      supportChannels: string[];
      uptimeLast30Days: number;
      incidentsLast30Days: number;
    }>(`/api/v1/resources/${productId}/service-level`);

    return result;
  }

  public async getPricingInfo(productId: string): Promise<{
    productId: string;
    pricingModel: 'free' | 'pay_per_call' | 'subscription' | 'volume';
    freeTier?: {
      dailyLimit: number;
      monthlyLimit: number;
    };
    payPerCall?: {
      price: number;
      unit: string;
      volumeDiscounts?: Array<{
        minVolume: number;
        price: number;
      }>;
    };
    subscription?: Array<{
      period: 'monthly' | 'quarterly' | 'yearly';
      price: number;
      callLimit: number;
      overagePrice: number;
    }>;
    currency: string;
  }> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<{
      productId: string;
      pricingModel: 'free' | 'pay_per_call' | 'subscription' | 'volume';
      freeTier?: {
        dailyLimit: number;
        monthlyLimit: number;
      };
      payPerCall?: {
        price: number;
        unit: string;
        volumeDiscounts?: Array<{
          minVolume: number;
          price: number;
        }>;
      };
      subscription?: Array<{
        period: 'monthly' | 'quarterly' | 'yearly';
        price: number;
        callLimit: number;
        overagePrice: number;
      }>;
      currency: string;
    }>(`/api/v1/resources/${productId}/pricing`);

    return result;
  }

  public async getRelatedProducts(productId: string, limit: number = 10): Promise<DataProduct[]> {
    validateRequiredParams({ productId }, ['productId']);

    if (limit < 1 || limit > 50) {
      throw new Error('limit 必须在 1 到 50 之间');
    }

    const result = await this.client.get<DataProduct[]>(
      `/api/v1/resources/${productId}/related`,
      { limit }
    );

    return result;
  }

  public generateFieldMarkdown(fields: DataField[]): string {
    if (fields.length === 0) {
      return '暂无字段说明';
    }

    const header = '| 字段名 | 类型 | 说明 | 是否可空 | 是否加密 | 示例值 |\n| --- | --- | --- | --- | --- | --- |\n';

    const rows = fields
      .map((field) => {
        const constraints = field.constraints
          ? Object.entries(field.constraints)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          : '';
        const description = constraints
          ? `${field.description} (${constraints})`
          : field.description;

        return `| ${field.name} | ${field.type} | ${description} | ${field.isNullable ? '是' : '否'} | ${field.isEncrypted ? '是' : '否'} | ${field.sampleValue} |`;
      })
      .join('\n');

    return header + rows;
  }

  public generateSampleSummary(sampleData: SampleData): string {
    const { summary, recordCount, dataQuality } = sampleData;

    const qualityItems = Object.entries(dataQuality)
      .map(([key, value]) => {
        const names: Record<string, string> = {
          completeness: '完整性',
          accuracy: '准确性',
          timeliness: '时效性',
          uniqueness: '唯一性'
        };
        return `${names[key] || key}: ${(value * 100).toFixed(2)}%`;
      })
      .join(', ');

    return `## 数据样例摘要\n\n${summary}\n\n**数据记录数**: ${recordCount} 条\n\n**数据质量**: ${qualityItems}\n\n**包含字段**: ${sampleData.fields.join(', ')}`;
  }

  public async batchGetDetails(
    productIds: string[],
    options?: {
      skipCache?: boolean;
      concurrency?: number;
    }
  ): Promise<BatchResponse<ResourceDetail>> {
    if (!productIds || productIds.length === 0) {
      throw new SDKError(ErrorCode.PARAM_MISSING, 'productIds 不能为空');
    }

    validateParamRange('productIds.length', productIds.length, 1, 100);

    const concurrency = options?.concurrency || 10;
    const results: BatchResponse<ResourceDetail>['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < productIds.length; i += concurrency) {
      const batch = productIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (productId) => {
        try {
          validateRequiredParams({ productId }, ['productId']);

          const data = await this.client.get<ResourceDetail>(
            `/api/v1/resources/${productId}/detail`,
            undefined,
            { skipCache: options?.skipCache }
          );

          successCount++;
          return {
            id: productId,
            success: true as const,
            data,
            error: undefined
          };
        } catch (error) {
          failedCount++;
          let errorInfo = {
            code: ErrorCode.UNKNOWN_ERROR,
            message: '未知错误',
            traceId: ''
          };

          if (error instanceof SDKError) {
            errorInfo = {
              code: error.code,
              message: error.message,
              traceId: error.traceId
            };
          } else if (error instanceof Error) {
            errorInfo.message = error.message;
          }

          return {
            id: productId,
            success: false as const,
            data: null,
            error: errorInfo
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: productIds.length,
      successCount,
      failedCount,
      results
    };
  }

  public async batchGetBasicInfos(
    productIds: string[],
    options?: {
      skipCache?: boolean;
      concurrency?: number;
    }
  ): Promise<BatchResponse<DataProduct>> {
    if (!productIds || productIds.length === 0) {
      throw new SDKError(ErrorCode.PARAM_MISSING, 'productIds 不能为空');
    }

    validateParamRange('productIds.length', productIds.length, 1, 100);

    const concurrency = options?.concurrency || 10;
    const results: BatchResponse<DataProduct>['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < productIds.length; i += concurrency) {
      const batch = productIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (productId) => {
        try {
          validateRequiredParams({ productId }, ['productId']);

          const data = await this.client.get<DataProduct>(
            `/api/v1/resources/${productId}/basic`,
            undefined,
            { skipCache: options?.skipCache }
          );

          successCount++;
          return {
            id: productId,
            success: true as const,
            data,
            error: undefined
          };
        } catch (error) {
          failedCount++;
          let errorInfo = {
            code: ErrorCode.UNKNOWN_ERROR,
            message: '未知错误',
            traceId: ''
          };

          if (error instanceof SDKError) {
            errorInfo = {
              code: error.code,
              message: error.message,
              traceId: error.traceId
            };
          } else if (error instanceof Error) {
            errorInfo.message = error.message;
          }

          return {
            id: productId,
            success: false as const,
            data: null,
            error: errorInfo
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: productIds.length,
      successCount,
      failedCount,
      results
    };
  }

  public async batchGetFields(
    productIds: string[],
    options?: {
      skipCache?: boolean;
      concurrency?: number;
    }
  ): Promise<BatchResponse<DataField[]>> {
    if (!productIds || productIds.length === 0) {
      throw new SDKError(ErrorCode.PARAM_MISSING, 'productIds 不能为空');
    }

    validateParamRange('productIds.length', productIds.length, 1, 100);

    const concurrency = options?.concurrency || 10;
    const results: BatchResponse<DataField[]>['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < productIds.length; i += concurrency) {
      const batch = productIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (productId) => {
        try {
          validateRequiredParams({ productId }, ['productId']);

          const data = await this.client.get<DataField[]>(
            `/api/v1/resources/${productId}/fields`,
            undefined,
            { skipCache: options?.skipCache }
          );

          successCount++;
          return {
            id: productId,
            success: true as const,
            data,
            error: undefined
          };
        } catch (error) {
          failedCount++;
          let errorInfo = {
            code: ErrorCode.UNKNOWN_ERROR,
            message: '未知错误',
            traceId: ''
          };

          if (error instanceof SDKError) {
            errorInfo = {
              code: error.code,
              message: error.message,
              traceId: error.traceId
            };
          } else if (error instanceof Error) {
            errorInfo.message = error.message;
          }

          return {
            id: productId,
            success: false as const,
            data: null,
            error: errorInfo
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return {
      total: productIds.length,
      successCount,
      failedCount,
      results
    };
  }
}
