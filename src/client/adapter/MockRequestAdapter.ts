import { IRequestAdapter, RequestOptions } from './IRequestAdapter';
import { ApiResponse, ErrorCode } from '../../types';
import { mockDataGenerator } from './MockDataGenerator';
import dayjs from 'dayjs';

export interface MockResponseOverride {
  urlPattern: RegExp | string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  response: ApiResponse | (() => ApiResponse);
  delay?: number;
}

export class MockRequestAdapter implements IRequestAdapter {
  private baseUrl: string = '';
  private defaultHeaders: Record<string, string> = {};
  private timeout: number = 30000;
  private responseOverrides: MockResponseOverride[] = [];
  private delayMs: number = 100;
  private failureRate: number = 0;
  private failOnParamValidation: boolean = true;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    delayMs?: number;
    delay?: number;
    failureRate?: number;
    failOnParamValidation?: boolean;
  }) {
    if (options?.baseUrl) this.baseUrl = options.baseUrl;
    if (options?.timeout !== undefined) this.timeout = options.timeout;
    if (options?.delayMs !== undefined) {
      this.delayMs = options.delayMs;
    } else if (options?.delay !== undefined) {
      this.delayMs = options.delay;
    }
    if (options?.failureRate !== undefined) this.failureRate = options.failureRate;
    if (options?.failOnParamValidation !== undefined) {
      this.failOnParamValidation = options.failOnParamValidation;
    }
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  public setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  public setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  public setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  public setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  public addResponseOverride(override: MockResponseOverride): void {
    this.responseOverrides.push(override);
  }

  public clearResponseOverrides(): void {
    this.responseOverrides = [];
  }

  private async simulateDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  private shouldFail(): boolean {
    return Math.random() < this.failureRate;
  }

  private generateErrorResponse(code: number, message: string): ApiResponse {
    return {
      code,
      message,
      data: null,
      traceId: 'mock-' + dayjs().valueOf(),
      timestamp: dayjs().valueOf()
    };
  }

  private generateSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      code: ErrorCode.SUCCESS,
      message: 'success',
      data,
      traceId: 'mock-' + dayjs().valueOf(),
      timestamp: dayjs().valueOf()
    };
  }

  private findOverride(url: string, method: string): MockResponseOverride | undefined {
    return this.responseOverrides.find((override) => {
      const methodMatch = !override.method || override.method === method;
      const urlMatch =
        override.urlPattern instanceof RegExp
          ? override.urlPattern.test(url)
          : url.includes(override.urlPattern);
      return methodMatch && urlMatch;
    });
  }

  private validateParams(params: Record<string, unknown> | undefined, required: string[]): string[] {
    if (!this.failOnParamValidation) return [];
    if (!params) return required;
    return required.filter((key) => {
      const value = params[key];
      return value === undefined || value === null || value === '';
    });
  }

  private extractProductId(url: string): string | undefined {
    const match = url.match(/\/([a-z]+-?[a-z]*-?\d+)/i);
    return match ? match[1] : undefined;
  }

  async request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
    await this.simulateDelay();

    if (this.shouldFail()) {
      return this.generateErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Mock simulated random failure'
      ) as ApiResponse<T>;
    }

    const override = this.findOverride(options.url, options.method);
    if (override) {
      if (override.delay) {
        await new Promise((resolve) => setTimeout(resolve, override.delay));
      }
      const response =
        typeof override.response === 'function' ? override.response() : override.response;
      return response as ApiResponse<T>;
    }

    return this.routeRequest(options);
  }

  private async routeRequest<T>(options: RequestOptions): Promise<ApiResponse<T>> {
    const { method, url, params } = options;

    if (url.includes('/health')) {
      return this.generateSuccessResponse({
        status: 'ok',
        timestamp: dayjs().toISOString(),
        version: '1.0.0-mock'
      }) as ApiResponse<T>;
    }

    if (url.includes('/catalog/search')) {
      const missing = this.validateParams(params, []);
      if (missing.length > 0) {
        return this.generateErrorResponse(
          ErrorCode.PARAM_MISSING,
          `缺少必填参数: ${missing.join(', ')}`
        ) as ApiResponse<T>;
      }
      const page = (params?.page as number) || 1;
      const pageSize = (params?.pageSize as number) || 10;
      return this.generateSuccessResponse(
        mockDataGenerator.generateSearchResult(page, pageSize)
      ) as ApiResponse<T>;
    }

    if (url.includes('/catalog/products/') && !url.includes('/hot') && !url.includes('/new') && !url.includes('/recommendations')) {
      const productId = this.extractProductId(url);
      return this.generateSuccessResponse(
        mockDataGenerator.generateDataProduct({ id: productId })
      ) as ApiResponse<T>;
    }

    if (url.includes('/catalog/hot')) {
      const limit = (params?.limit as number) || 10;
      const list = Array.from({ length: limit }, () => mockDataGenerator.generateDataProduct());
      return this.generateSuccessResponse(list) as ApiResponse<T>;
    }

    if (url.includes('/catalog/new')) {
      const limit = (params?.limit as number) || 10;
      const list = Array.from({ length: limit }, () => mockDataGenerator.generateDataProduct());
      return this.generateSuccessResponse(list) as ApiResponse<T>;
    }

    if (url.includes('/catalog/recommendations')) {
      const limit = (params?.limit as number) || 10;
      const list = Array.from({ length: limit }, () => mockDataGenerator.generateDataProduct());
      return this.generateSuccessResponse(list) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/detail')) {
      const productId = this.extractProductId(url);
      return this.generateSuccessResponse(
        mockDataGenerator.generateResourceDetail(productId)
      ) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/basic')) {
      const productId = this.extractProductId(url);
      return this.generateSuccessResponse(
        mockDataGenerator.generateDataProduct({ id: productId })
      ) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/fields')) {
      const fields = Array.from({ length: 10 }, () => mockDataGenerator.generateDataField());
      return this.generateSuccessResponse(fields) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/sample')) {
      return this.generateSuccessResponse(
        mockDataGenerator.generateSampleData()
      ) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/guide')) {
      return this.generateSuccessResponse({
        guide: '这是数据资源的使用指南...',
        examples: [
          {
            title: '基础查询示例',
            description: '展示如何进行简单的数据查询',
            code: 'sdk.catalog.search({ keyword: "test" })'
          }
        ],
        faqs: [
          { question: '如何申请授权？', answer: '请在资源详情页点击申请按钮' }
        ]
      }) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/api-spec')) {
      return this.generateSuccessResponse({
        baseUrl: 'https://api.example.com',
        authentication: 'API Key + Signature',
        endpoints: [
          {
            path: '/api/v1/data/query',
            method: 'POST',
            summary: '数据查询',
            description: '根据条件查询数据',
            parameters: [],
            responses: {
              '200': { description: '成功', schema: {} }
            }
          }
        ]
      }) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/service-level')) {
      return this.generateSuccessResponse({
        availability: 0.999,
        avgResponseTime: 100,
        p95ResponseTime: 200,
        p99ResponseTime: 500,
        supportChannels: ['在线客服', '邮件', '电话'],
        uptimeLast30Days: 0.9995,
        incidentsLast30Days: 1
      }) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/pricing')) {
      return this.generateSuccessResponse({
        productId: this.extractProductId(url),
        pricingModel: 'pay_per_call',
        freeTier: { dailyLimit: 100, monthlyLimit: 3000 },
        payPerCall: {
          price: 0.1,
          unit: '元/千次',
          volumeDiscounts: [
            { minVolume: 10000, price: 0.08 },
            { minVolume: 100000, price: 0.05 }
          ]
        },
        currency: 'CNY'
      }) as ApiResponse<T>;
    }

    if (url.includes('/resources/') && url.includes('/related')) {
      const limit = (params?.limit as number) || 10;
      const list = Array.from({ length: limit }, () => mockDataGenerator.generateDataProduct());
      return this.generateSuccessResponse(list) as ApiResponse<T>;
    }

    if (url.includes('/apply/products/') && url.includes('/materials')) {
      const missing = this.validateParams(params, []);
      if (missing.length > 0) {
        return this.generateErrorResponse(
          ErrorCode.PARAM_MISSING,
          `缺少必填参数: ${missing.join(', ')}`
        ) as ApiResponse<T>;
      }
      return this.generateSuccessResponse(
        mockDataGenerator.generateRequiredMaterials()
      ) as ApiResponse<T>;
    }

    if (url.includes('/apply/submit')) {
      const data = options.data;
      const missing = this.validateParams(data, [
        'productId',
        'purpose',
        'purposeDescription',
        'usageDuration',
        'usageScope',
        'expectedCallVolume',
        'materials',
        'contactName',
        'contactPhone',
        'contactEmail',
        'organization',
        'department'
      ]);
      if (missing.length > 0) {
        return this.generateErrorResponse(
          ErrorCode.PARAM_MISSING,
          `缺少必填参数: ${missing.join(', ')}`
        ) as ApiResponse<T>;
      }
      return this.generateSuccessResponse(
        mockDataGenerator.generateApplyResponse(data?.productId as string)
      ) as ApiResponse<T>;
    }

    if (url.includes('/apply/list')) {
      return this.generateSuccessResponse({
        total: 5,
        page: 1,
        pageSize: 10,
        list: Array.from({ length: 5 }, () => ({
          applyId: mockDataGenerator['generateId']('apply'),
          productId: mockDataGenerator['generateId']('prod'),
          productName: mockDataGenerator.randomFromArray(['企业信用数据集', '交通流量数据']),
          status: mockDataGenerator.randomFromArray(Object.values(['pending', 'approved', 'rejected'])),
          purpose: mockDataGenerator.randomFromArray(Object.values(['research', 'commercial'])),
          submitTime: dayjs().toISOString(),
          updateTime: dayjs().toISOString()
        }))
      }) as ApiResponse<T>;
    }

    if (url.match(/\/apply\/[^/]+$/) && method === 'GET') {
      const applyId = this.extractProductId(url);
      return this.generateSuccessResponse({
        applyId,
        productId: mockDataGenerator['generateId']('prod'),
        productName: '企业信用数据集',
        status: 'pending',
        purpose: 'research',
        purposeDescription: '用于科学研究',
        usageDuration: 365,
        usageScope: '学术研究',
        expectedCallVolume: 10000,
        materials: mockDataGenerator.generateRequiredMaterials().map(m => ({ ...m, uploaded: true, fileUrl: 'https://example.com/' + m.name + '.pdf' })),
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'test@example.com',
        organization: '某某大学',
        department: '计算机学院',
        submitTime: dayjs().toISOString(),
        updateTime: dayjs().toISOString(),
        auditRecords: mockDataGenerator.generateAuditRecords()
      }) as ApiResponse<T>;
    }

    if (url.includes('/apply/') && url.includes('/cancel')) {
      return this.generateSuccessResponse({
        applyId: this.extractProductId(url),
        status: 'cancelled',
        cancelTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.match(/\/apply\/[^/]+$/) && method === 'PUT') {
      return this.generateSuccessResponse({
        applyId: this.extractProductId(url),
        status: 'pending',
        updateTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/list')) {
      return this.generateSuccessResponse({
        total: 3,
        page: 1,
        pageSize: 10,
        list: Array.from({ length: 3 }, () => mockDataGenerator.generateAuthorization())
      }) as ApiResponse<T>;
    }

    if (url.match(/\/authorization\/[^/]+$/) && !url.includes('/scope') && !url.includes('/audit-progress')) {
      const authId = this.extractProductId(url);
      return this.generateSuccessResponse(
        mockDataGenerator.generateAuthorization()
      ) as ApiResponse<T>;
    }

    if (url.includes('/authorization/audit-progress')) {
      return this.generateSuccessResponse({
        applyId: this.extractProductId(url),
        currentStatus: 'reviewing',
        estimatedCompleteTime: dayjs().add(1, 'day').toISOString(),
        auditRecords: mockDataGenerator.generateAuditRecords()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/scope')) {
      const auth = mockDataGenerator.generateAuthorization();
      return this.generateSuccessResponse({
        authorizationId: auth.id,
        productId: auth.productId,
        productName: auth.productName,
        scope: auth.scope,
        validFrom: auth.validFrom,
        validTo: auth.validTo
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/expire-reminders')) {
      const threshold = (params?.daysThreshold as number) || 30;
      const count = Math.floor(Math.random() * 5) + 1;
      return this.generateSuccessResponse(
        Array.from({ length: count }, () => mockDataGenerator.generateExpireReminder())
      ) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/renew')) {
      return this.generateSuccessResponse({
        applyId: mockDataGenerator['generateId']('apply'),
        authorizationId: this.extractProductId(url),
        status: 'pending',
        submitTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/suspend')) {
      return this.generateSuccessResponse({
        authorizationId: this.extractProductId(url),
        status: 'suspended',
        suspendTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/resume')) {
      return this.generateSuccessResponse({
        authorizationId: this.extractProductId(url),
        status: 'active',
        resumeTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/revoke')) {
      return this.generateSuccessResponse({
        authorizationId: this.extractProductId(url),
        status: 'revoked',
        revokeTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/authorization/') && url.includes('/ip-whitelist')) {
      return this.generateSuccessResponse({
        authorizationId: this.extractProductId(url),
        ipWhitelist: options.data?.ipWhitelist || ['192.168.1.1'],
        updateTime: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/records')) {
      const page = (params?.page as number) || 1;
      const pageSize = (params?.pageSize as number) || 20;
      return this.generateSuccessResponse({
        total: 100,
        page,
        pageSize,
        list: Array.from({ length: pageSize }, () => mockDataGenerator.generateUsageRecord())
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/stats')) {
      return this.generateSuccessResponse(
        mockDataGenerator.generateUsageStats()
      ) as ApiResponse<T>;
    }

    if (url.includes('/usage/record') && method === 'POST') {
      return this.generateSuccessResponse({
        recordId: mockDataGenerator['generateId']('usage'),
        recordedAt: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/notices') && method === 'GET') {
      const count = Math.floor(Math.random() * 10) + 1;
      return this.generateSuccessResponse({
        total: count,
        page: 1,
        pageSize: 20,
        list: Array.from({ length: count }, () => mockDataGenerator.generateChangeNotice()),
        unreadCount: Math.floor(Math.random() * count)
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/notices/') && url.includes('/read')) {
      return this.generateSuccessResponse({
        noticeId: this.extractProductId(url),
        readAt: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/notices/read-all')) {
      return this.generateSuccessResponse({
        markedCount: 5,
        readAt: dayjs().toISOString()
      }) as ApiResponse<T>;
    }

    if (url.includes('/usage/citation/')) {
      const productId = this.extractProductId(url);
      return this.generateSuccessResponse(
        mockDataGenerator.generateCitationInfo(productId)
      ) as ApiResponse<T>;
    }

    if (url.includes('/usage/expire-reminders')) {
      return this.generateSuccessResponse({
        total: 2,
        expiring: [mockDataGenerator.generateExpireReminder(), mockDataGenerator.generateExpireReminder()]
      }) as ApiResponse<T>;
    }

    return this.generateErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Mock adapter: 未匹配的路由 ${method} ${url}`
    ) as ApiResponse<T>;
  }

  async get<T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }

  async post<T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }

  async put<T>(url: string, data?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }

  async delete<T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      params,
      headers: { ...this.defaultHeaders, ...headers }
    });
  }
}
