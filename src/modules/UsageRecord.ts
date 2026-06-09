import dayjs from 'dayjs';
import { HttpClient } from '../client/HttpClient';
import {
  UsageRecord,
  UsageStats,
  ChangeNotice,
  CitationInfo,
  PaginationParams,
  CursorPaginationParams,
  CursorResponse,
  IncrementalPullParams,
  IncrementalResponse
} from '../types';
import {
  validateRequiredParams,
  validateParamRange,
  validateParamEnum,
  ParameterInvalidError,
  SDKError,
  ErrorCode
} from '../errors';

export class UsageRecordModule {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async getUsageRecords(params?: PaginationParams & {
    authorizationId?: string;
    productId?: string;
    status?: 'success' | 'failed';
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    list: UsageRecord[];
  }> {
    const queryParams: Record<string, unknown> = {};

    if (params?.authorizationId) {
      queryParams.authorizationId = params.authorizationId;
    }
    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.status) {
      validateParamEnum('status', params.status, ['success', 'failed']);
      queryParams.status = params.status;
    }
    if (params?.page !== undefined) {
      validateParamRange('page', params.page, 1, 10000);
      queryParams.page = params.page;
    }
    if (params?.pageSize !== undefined) {
      validateParamRange('pageSize', params.pageSize, 1, 100);
      queryParams.pageSize = params.pageSize;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<{
      total: number;
      page: number;
      pageSize: number;
      list: UsageRecord[];
    }>('/api/v1/usage/records', queryParams);

    return result;
  }

  public async getUsageStats(params?: {
    authorizationId?: string;
    productId?: string;
    startTime?: string;
    endTime?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<UsageStats> {
    const queryParams: Record<string, unknown> = {};

    if (params?.authorizationId) {
      queryParams.authorizationId = params.authorizationId;
    }
    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }
    if (params?.groupBy) {
      validateParamEnum('groupBy', params.groupBy, ['day', 'week', 'month']);
      queryParams.groupBy = params.groupBy;
    }

    const result = await this.client.get<UsageStats>('/api/v1/usage/stats', queryParams);

    return result;
  }

  public async recordCall(
    authorizationId: string,
    endpoint: string,
    status: 'success' | 'failed',
    responseTime: number,
    options?: {
      inputSize?: number;
      outputSize?: number;
      errorMessage?: string;
    }
  ): Promise<{
    recordId: string;
    recordedAt: string;
  }> {
    validateRequiredParams({ authorizationId, endpoint, status, responseTime }, [
      'authorizationId',
      'endpoint',
      'status',
      'responseTime'
    ]);

    validateParamRange('responseTime', responseTime, 0, 3600000);

    if (options?.inputSize !== undefined && options.inputSize < 0) {
      throw new ParameterInvalidError('inputSize', '输入数据大小不能为负数');
    }
    if (options?.outputSize !== undefined && options.outputSize < 0) {
      throw new ParameterInvalidError('outputSize', '输出数据大小不能为负数');
    }

    const result = await this.client.post<{
      recordId: string;
      recordedAt: string;
    }>('/api/v1/usage/record', {
      authorizationId,
      endpoint,
      status,
      responseTime,
      ...options
    });

    return result;
  }

  public async getChangeNotices(params?: PaginationParams & {
    productId?: string;
    type?: ChangeNotice['type'];
    level?: ChangeNotice['level'];
    unreadOnly?: boolean;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    list: ChangeNotice[];
    unreadCount: number;
  }> {
    const queryParams: Record<string, unknown> = {};

    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.type) {
      validateParamEnum('type', params.type, [
        'update',
        'deprecation',
        'price_change',
        'policy_change',
        'maintenance'
      ]);
      queryParams.type = params.type;
    }
    if (params?.level) {
      validateParamEnum('level', params.level, ['info', 'warning', 'critical']);
      queryParams.level = params.level;
    }
    if (params?.unreadOnly !== undefined) {
      queryParams.unreadOnly = params.unreadOnly;
    }
    if (params?.page !== undefined) {
      validateParamRange('page', params.page, 1, 10000);
      queryParams.page = params.page;
    }
    if (params?.pageSize !== undefined) {
      validateParamRange('pageSize', params.pageSize, 1, 100);
      queryParams.pageSize = params.pageSize;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<{
      total: number;
      page: number;
      pageSize: number;
      list: ChangeNotice[];
      unreadCount: number;
    }>('/api/v1/usage/notices', queryParams);

    return result;
  }

  public async markNoticeAsRead(noticeId: string): Promise<{
    noticeId: string;
    readAt: string;
  }> {
    validateRequiredParams({ noticeId }, ['noticeId']);

    const result = await this.client.post<{
      noticeId: string;
      readAt: string;
    }>(`/api/v1/usage/notices/${noticeId}/read`);

    return result;
  }

  public async markAllNoticesAsRead(productId?: string): Promise<{
    markedCount: number;
    readAt: string;
  }> {
    const body: Record<string, unknown> = {};
    if (productId) {
      body.productId = productId;
    }

    const result = await this.client.post<{
      markedCount: number;
      readAt: string;
    }>('/api/v1/usage/notices/read-all', body);

    return result;
  }

  public async getCitationInfo(productId: string, version?: string): Promise<CitationInfo> {
    validateRequiredParams({ productId }, ['productId']);

    const queryParams: Record<string, unknown> = {};
    if (version) {
      queryParams.version = version;
    }

    const result = await this.client.get<CitationInfo>(
      `/api/v1/usage/citation/${productId}`,
      queryParams
    );

    return this.enrichCitationInfo(result);
  }

  public async generateCitation(
    productId: string,
    format: 'apa' | 'gb' | 'bibtex' | 'text',
    version?: string
  ): Promise<{
    format: string;
    citation: string;
  }> {
    validateRequiredParams({ productId, format }, ['productId', 'format']);
    validateParamEnum('format', format, ['apa', 'gb', 'bibtex', 'text']);

    const queryParams: Record<string, unknown> = { format };
    if (version) {
      queryParams.version = version;
    }

    const result = await this.client.get<{
      format: string;
      citation: string;
    }>(`/api/v1/usage/citation/${productId}/generate`, queryParams);

    return result;
  }

  public async getExpireReminders(daysThreshold: number = 30): Promise<{
    total: number;
    expiring: Array<{
      authorizationId: string;
      productId: string;
      productName: string;
      daysRemaining: number;
      validTo: string;
      callCount: number;
      callLimit: number;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    }>;
  }> {
    validateParamRange('daysThreshold', daysThreshold, 1, 365);

    const result = await this.client.get<{
      total: number;
      expiring: Array<{
        authorizationId: string;
        productId: string;
        productName: string;
        daysRemaining: number;
        validTo: string;
        callCount: number;
        callLimit: number;
      }>;
    }>('/api/v1/usage/expire-reminders', { daysThreshold });

    return {
      ...result,
      expiring: result.expiring.map((item) => ({
        ...item,
        urgency: this.getUrgencyLevel(item.daysRemaining)
      }))
    };
  }

  public getChangeTypeName(type: ChangeNotice['type']): string {
    const names: Record<ChangeNotice['type'], string> = {
      update: '功能更新',
      deprecation: '即将弃用',
      price_change: '价格调整',
      policy_change: '政策变更',
      maintenance: '维护通知'
    };
    return names[type] || type;
  }

  public getChangeLevelName(level: ChangeNotice['level']): string {
    const names: Record<ChangeNotice['level'], string> = {
      info: '信息',
      warning: '警告',
      critical: '严重'
    };
    return names[level] || level;
  }

  public getUrgencyLevel(daysRemaining: number): 'low' | 'medium' | 'high' | 'critical' {
    if (daysRemaining <= 3) return 'critical';
    if (daysRemaining <= 7) return 'high';
    if (daysRemaining <= 15) return 'medium';
    return 'low';
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public formatResponseTime(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  private enrichCitationInfo(info: CitationInfo): CitationInfo {
    const accessDate = dayjs(info.accessDate || undefined).format('YYYY-MM-DD');
    const sourceUrl = info.sourceUrl || '';

    const apa = this.generateAPACitation(info, accessDate);
    const gb = this.generateGBCitation(info, accessDate);
    const bibtex = this.generateBibTeX(info, accessDate);

    return {
      ...info,
      accessDate,
      citationText: apa,
      formats: {
        apa,
        gb,
        bibtex
      }
    };
  }

  private generateAPACitation(info: CitationInfo, accessDate: string): string {
    return `${info.provider}. (${dayjs(info.accessDate).format('YYYY')}). ${info.productName} [Data set]. ${info.sourceUrl}. Accessed ${accessDate}.`;
  }

  private generateGBCitation(info: CitationInfo, accessDate: string): string {
    return `${info.provider}. ${info.productName}[DB/OL]. ${info.sourceUrl}. (${dayjs(info.accessDate).format('YYYY-MM-DD')})[${accessDate}].`;
  }

  public async getUsageRecordsWithCursor(
    params?: CursorPaginationParams & {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
    }
  ): Promise<CursorResponse<UsageRecord>> {
    const queryParams: Record<string, unknown> = {};

    if (params?.authorizationId) {
      queryParams.authorizationId = params.authorizationId;
    }
    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.status) {
      validateParamEnum('status', params.status, ['success', 'failed']);
      queryParams.status = params.status;
    }
    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }
    if (params?.limit !== undefined) {
      validateParamRange('limit', params.limit, 1, 1000);
      queryParams.limit = params.limit;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<CursorResponse<UsageRecord>>(
      '/api/v1/usage/records/cursor',
      queryParams
    );

    return result;
  }

  public async getUsageRecordsIncremental(
    params?: IncrementalPullParams & {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
    }
  ): Promise<IncrementalResponse<UsageRecord>> {
    const queryParams: Record<string, unknown> = {};

    if (params?.authorizationId) {
      queryParams.authorizationId = params.authorizationId;
    }
    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.status) {
      validateParamEnum('status', params.status, ['success', 'failed']);
      queryParams.status = params.status;
    }
    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }
    if (params?.limit !== undefined) {
      validateParamRange('limit', params.limit, 1, 1000);
      queryParams.limit = params.limit;
    }
    if (params?.lastSyncTime) {
      queryParams.lastSyncTime = params.lastSyncTime;
    }
    if (params?.includeDeleted !== undefined) {
      queryParams.includeDeleted = params.includeDeleted;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<IncrementalResponse<UsageRecord>>(
      '/api/v1/usage/records/incremental',
      queryParams
    );

    return result;
  }

  public async getChangeNoticesWithCursor(
    params?: CursorPaginationParams & {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      unreadOnly?: boolean;
    }
  ): Promise<CursorResponse<ChangeNotice>> {
    const queryParams: Record<string, unknown> = {};

    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.type) {
      validateParamEnum('type', params.type, [
        'update',
        'deprecation',
        'price_change',
        'policy_change',
        'maintenance'
      ]);
      queryParams.type = params.type;
    }
    if (params?.level) {
      validateParamEnum('level', params.level, ['info', 'warning', 'critical']);
      queryParams.level = params.level;
    }
    if (params?.unreadOnly !== undefined) {
      queryParams.unreadOnly = params.unreadOnly;
    }
    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }
    if (params?.limit !== undefined) {
      validateParamRange('limit', params.limit, 1, 1000);
      queryParams.limit = params.limit;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<CursorResponse<ChangeNotice>>(
      '/api/v1/usage/notices/cursor',
      queryParams
    );

    return result;
  }

  public async getChangeNoticesIncremental(
    params?: IncrementalPullParams & {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      unreadOnly?: boolean;
    }
  ): Promise<IncrementalResponse<ChangeNotice>> {
    const queryParams: Record<string, unknown> = {};

    if (params?.productId) {
      queryParams.productId = params.productId;
    }
    if (params?.type) {
      validateParamEnum('type', params.type, [
        'update',
        'deprecation',
        'price_change',
        'policy_change',
        'maintenance'
      ]);
      queryParams.type = params.type;
    }
    if (params?.level) {
      validateParamEnum('level', params.level, ['info', 'warning', 'critical']);
      queryParams.level = params.level;
    }
    if (params?.unreadOnly !== undefined) {
      queryParams.unreadOnly = params.unreadOnly;
    }
    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }
    if (params?.limit !== undefined) {
      validateParamRange('limit', params.limit, 1, 1000);
      queryParams.limit = params.limit;
    }
    if (params?.lastSyncTime) {
      queryParams.lastSyncTime = params.lastSyncTime;
    }
    if (params?.includeDeleted !== undefined) {
      queryParams.includeDeleted = params.includeDeleted;
    }
    if (params?.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params?.endTime) {
      queryParams.endTime = params.endTime;
    }

    const result = await this.client.get<IncrementalResponse<ChangeNotice>>(
      '/api/v1/usage/notices/incremental',
      queryParams
    );

    if (this.client.isCacheEnabled()) {
      const affectedProductIds = new Set(result.list.map((n) => n.productId));
      for (const productId of affectedProductIds) {
        this.client.invalidateCacheByProductId(productId);
      }
    }

    return result;
  }

  public async syncAllUsageRecords(
    params: {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
      lastSyncTime?: string;
      batchSize?: number;
      onBatch?: (batch: UsageRecord[], cursor: string, hasMore: boolean) => void | Promise<void>;
    }
  ): Promise<{
    totalRecords: number;
    batches: number;
    lastCursor: string | null;
    syncTime: string;
  }> {
    let cursor: string | undefined = params.lastSyncTime;
    let hasMore = true;
    let totalRecords = 0;
    let batches = 0;
    const batchSize = params.batchSize || 100;

    while (hasMore) {
      const result = await this.getUsageRecordsIncremental({
        authorizationId: params.authorizationId,
        productId: params.productId,
        status: params.status,
        cursor,
        limit: batchSize,
        lastSyncTime: params.lastSyncTime
      });

      batches++;
      totalRecords += result.list.length;

      if (params.onBatch) {
        await params.onBatch(result.list, result.nextCursor || '', result.hasMore);
      }

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;

      if (!hasMore) {
        break;
      }
    }

    return {
      totalRecords,
      batches,
      lastCursor: cursor || null,
      syncTime: new Date().toISOString()
    };
  }

  public async syncAllChangeNotices(
    params: {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      lastSyncTime?: string;
      batchSize?: number;
      onBatch?: (batch: ChangeNotice[], cursor: string, hasMore: boolean) => void | Promise<void>;
    }
  ): Promise<{
    totalNotices: number;
    batches: number;
    lastCursor: string | null;
    syncTime: string;
  }> {
    let cursor: string | undefined = params.lastSyncTime;
    let hasMore = true;
    let totalNotices = 0;
    let batches = 0;
    const batchSize = params.batchSize || 100;

    while (hasMore) {
      const result = await this.getChangeNoticesIncremental({
        productId: params.productId,
        type: params.type,
        level: params.level,
        cursor,
        limit: batchSize,
        lastSyncTime: params.lastSyncTime
      });

      batches++;
      totalNotices += result.list.length;

      if (params.onBatch) {
        await params.onBatch(result.list, result.nextCursor || '', result.hasMore);
      }

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;

      if (!hasMore) {
        break;
      }
    }

    return {
      totalNotices,
      batches,
      lastCursor: cursor || null,
      syncTime: new Date().toISOString()
    };
  }

  private generateBibTeX(info: CitationInfo, accessDate: string): string {
    const key = info.productName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `@misc{${key},
  author       = {${info.provider}},
  title        = {${info.productName}},
  howpublished = {${info.sourceUrl}},
  year         = {${dayjs(info.accessDate).format('YYYY')}},
  note         = {Accessed: ${accessDate}},
  version      = {${info.version}}
}`;
  }
}
