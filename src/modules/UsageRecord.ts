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
  IncrementalResponse,
  SyncCheckpoint,
  SyncResultWithCheckpoint,
  SyncTaskState,
  SyncTaskStatus,
  RetryPolicy,
  SyncTaskOptions,
  SyncWithTaskResult,
  DEFAULT_RETRY_POLICY
} from '../types';
import {
  validateRequiredParams,
  validateParamRange,
  validateParamEnum,
  ParameterInvalidError,
  SDKError,
  ErrorCode
} from '../errors';

function generateTaskId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class UsageRecordModule {
  private readonly client: HttpClient;
  private readonly taskStates: Map<string, SyncTaskState> = new Map();

  constructor(client: HttpClient) {
    this.client = client;
  }

  public getSyncTaskStatus(taskId: string): SyncTaskState | undefined {
    return this.taskStates.get(taskId);
  }

  public getAllSyncTaskStatuses(): SyncTaskState[] {
    return Array.from(this.taskStates.values());
  }

  public clearSyncTask(taskId: string): boolean {
    return this.taskStates.delete(taskId);
  }

  public clearAllSyncTasks(): void {
    this.taskStates.clear();
  }

  private createInitialTaskState(
    syncType: 'usage_records' | 'change_notices',
    options: SyncTaskOptions,
    filters: Record<string, unknown>,
    checkpoint?: SyncCheckpoint
  ): SyncTaskState {
    const taskId = options.taskId || generateTaskId();
    const retryPolicy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...options.retryPolicy
    };

    const state: SyncTaskState = {
      taskId,
      syncType,
      status: 'idle',
      startTime: new Date().toISOString(),
      currentBatch: checkpoint?.batchCount || 0,
      totalSynced: checkpoint?.totalSynced || 0,
      lastCursor: checkpoint?.cursor || null,
      lastSyncTime: checkpoint?.lastSyncTime || new Date().toISOString(),
      hasMore: true,
      filters,
      retryPolicy,
      statistics: {
        totalBatches: checkpoint?.batchCount || 0,
        successfulBatches: 0,
        failedBatches: 0,
        totalRetries: 0,
        averageBatchTimeMs: 0
      }
    };

    this.taskStates.set(taskId, state);
    return state;
  }

  private updateTaskState(taskId: string, updates: Partial<SyncTaskState>): SyncTaskState {
    const state = this.taskStates.get(taskId);
    if (!state) {
      throw new SDKError(ErrorCode.UNKNOWN_ERROR, `同步任务 ${taskId} 不存在`);
    }

    const updated: SyncTaskState = { ...state, ...updates };
    this.taskStates.set(taskId, updated);
    return updated;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateRetryDelay(retryCount: number, policy: RetryPolicy): number {
    const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount);
    return Math.min(delay, policy.maxDelayMs);
  }

  private isRetryableError(error: unknown, policy: RetryPolicy): boolean {
    if (error instanceof SDKError) {
      return policy.retryableErrorCodes?.includes(error.code) ?? true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('econnaborted') ||
        msg.includes('service unavailable') ||
        msg.includes('internal server error') ||
        msg.includes('bad gateway')
      );
    }
    return false;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy,
    onRetry?: (retryCount: number, error: Error, delayMs: number) => void
  ): Promise<T> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= policy.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (retryCount >= policy.maxRetries || !this.isRetryableError(error, policy)) {
          throw err;
        }

        const delay = this.calculateRetryDelay(retryCount, policy);
        if (onRetry) {
          onRetry(retryCount, err, delay);
        }

        await this.sleep(delay);
        retryCount++;
      }
    }

    throw lastError || new Error('未知错误');
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

    if (this.client.isCacheEnabled() && result.list.length > 0) {
      let affectedProductIds = new Set(result.list.map((n) => n.productId));

      if (params?.productId) {
        affectedProductIds = new Set(
          Array.from(affectedProductIds).filter((id) => id === params.productId)
        );
      }

      if (params?.type) {
        affectedProductIds = new Set(
          result.list
            .filter((n) => n.type === params.type)
            .map((n) => n.productId)
        );
      }

      if (params?.level) {
        affectedProductIds = new Set(
          result.list
            .filter((n) => n.level === params.level)
            .map((n) => n.productId)
        );
      }

      for (const productId of affectedProductIds) {
        const cleared = this.client.invalidateCacheByProductId(productId);
        if (this.client.getAxiosInstance()) {
          console.debug(`[SDK Cache] Invalidated ${cleared} entries for product ${productId}`);
        }
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

  public async syncUsageRecordsWithCheckpoint(
    params: {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
      lastSyncTime?: string;
      batchSize?: number;
      checkpoint?: SyncCheckpoint;
      maxBatches?: number;
      onBatch?: (
        batch: UsageRecord[],
        checkpoint: SyncCheckpoint,
        hasMore: boolean
      ) => void | Promise<void>;
      onError?: (error: Error, checkpoint: SyncCheckpoint) => void | Promise<void>;
    }
  ): Promise<SyncResultWithCheckpoint<UsageRecord>> {
    let cursor: string | undefined;
    let lastSyncTime: string | undefined;
    let totalSynced = 0;
    let batchCount = 0;
    const batchSize = params.batchSize || 100;
    const maxBatches = params.maxBatches || Infinity;

    const filters: SyncCheckpoint['filters'] = {
      productId: params.productId,
      authorizationId: params.authorizationId,
      status: params.status
    };

    if (params.checkpoint) {
      if (params.checkpoint.syncType !== 'usage_records') {
        throw new ParameterInvalidError(
          'checkpoint',
          `检查点类型不匹配，期望 usage_records，实际 ${params.checkpoint.syncType}`
        );
      }
      cursor = params.checkpoint.cursor || undefined;
      lastSyncTime = params.checkpoint.lastSyncTime;
      totalSynced = params.checkpoint.totalSynced || 0;
      batchCount = params.checkpoint.batchCount || 0;
    } else {
      lastSyncTime = params.lastSyncTime;
    }

    const createCheckpoint = (
      currentCursor: string | null,
      currentBatchCount: number,
      currentTotal: number,
      error?: { message: string; batchNumber: number }
    ): SyncCheckpoint => ({
      syncType: 'usage_records',
      cursor: currentCursor,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      totalSynced: currentTotal,
      batchCount: currentBatchCount,
      lastBatchTime: new Date().toISOString(),
      filters,
      error: error
        ? {
            ...error,
            timestamp: new Date().toISOString()
          }
        : undefined
    });

    let hasMore = true;
    let lastResult: IncrementalResponse<UsageRecord> | null = null;

    while (hasMore && batchCount < maxBatches) {
      try {
        const result = await this.getUsageRecordsIncremental({
          authorizationId: params.authorizationId,
          productId: params.productId,
          status: params.status,
          cursor,
          limit: batchSize,
          lastSyncTime
        });

        lastResult = result;
        batchCount++;
        totalSynced += result.list.length;

        const checkpoint = createCheckpoint(
          result.nextCursor,
          batchCount,
          totalSynced
        );

        if (params.onBatch) {
          await params.onBatch(result.list, checkpoint, result.hasMore);
        }

        hasMore = result.hasMore;
        cursor = result.nextCursor || undefined;

        if (!hasMore) {
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const checkpoint = createCheckpoint(
          cursor || null,
          batchCount,
          totalSynced,
          {
            message: err.message,
            batchNumber: batchCount
          }
        );

        if (params.onError) {
          await params.onError(err, checkpoint);
        }

        return {
          list: lastResult?.list || [],
          nextCursor: cursor || null,
          hasMore: true,
          total: lastResult?.total,
          syncTime: new Date().toISOString(),
          updatedCount: totalSynced,
          deletedCount: 0,
          checkpoint
        };
      }
    }

    const finalCheckpoint = createCheckpoint(
      cursor || null,
      batchCount,
      totalSynced
    );

    return {
      list: lastResult?.list || [],
      nextCursor: cursor || null,
      hasMore,
      total: lastResult?.total,
      syncTime: new Date().toISOString(),
      updatedCount: totalSynced,
      deletedCount: 0,
      checkpoint: finalCheckpoint
    };
  }

  public async syncChangeNoticesWithCheckpoint(
    params: {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      lastSyncTime?: string;
      batchSize?: number;
      checkpoint?: SyncCheckpoint;
      maxBatches?: number;
      invalidateCache?: boolean;
      onBatch?: (
        batch: ChangeNotice[],
        checkpoint: SyncCheckpoint,
        hasMore: boolean
      ) => void | Promise<void>;
      onError?: (error: Error, checkpoint: SyncCheckpoint) => void | Promise<void>;
    }
  ): Promise<SyncResultWithCheckpoint<ChangeNotice>> {
    let cursor: string | undefined;
    let lastSyncTime: string | undefined;
    let totalSynced = 0;
    let batchCount = 0;
    const batchSize = params.batchSize || 100;
    const maxBatches = params.maxBatches || Infinity;
    const invalidateCache = params.invalidateCache !== false;

    const filters: SyncCheckpoint['filters'] = {
      productId: params.productId,
      type: params.type,
      level: params.level
    };

    if (params.checkpoint) {
      if (params.checkpoint.syncType !== 'change_notices') {
        throw new ParameterInvalidError(
          'checkpoint',
          `检查点类型不匹配，期望 change_notices，实际 ${params.checkpoint.syncType}`
        );
      }
      cursor = params.checkpoint.cursor || undefined;
      lastSyncTime = params.checkpoint.lastSyncTime;
      totalSynced = params.checkpoint.totalSynced || 0;
      batchCount = params.checkpoint.batchCount || 0;
    } else {
      lastSyncTime = params.lastSyncTime;
    }

    const createCheckpoint = (
      currentCursor: string | null,
      currentBatchCount: number,
      currentTotal: number,
      error?: { message: string; batchNumber: number }
    ): SyncCheckpoint => ({
      syncType: 'change_notices',
      cursor: currentCursor,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      totalSynced: currentTotal,
      batchCount: currentBatchCount,
      lastBatchTime: new Date().toISOString(),
      filters,
      error: error
        ? {
            ...error,
            timestamp: new Date().toISOString()
          }
        : undefined
    });

    let hasMore = true;
    let lastResult: IncrementalResponse<ChangeNotice> | null = null;
    const allAffectedProductIds = new Set<string>();

    while (hasMore && batchCount < maxBatches) {
      try {
        const result = await this.getChangeNoticesIncremental({
          productId: params.productId,
          type: params.type,
          level: params.level,
          cursor,
          limit: batchSize,
          lastSyncTime
        });

        lastResult = result;
        batchCount++;
        totalSynced += result.list.length;

        if (invalidateCache) {
          result.list.forEach((n) => allAffectedProductIds.add(n.productId));
        }

        const checkpoint = createCheckpoint(
          result.nextCursor,
          batchCount,
          totalSynced
        );

        if (params.onBatch) {
          await params.onBatch(result.list, checkpoint, result.hasMore);
        }

        hasMore = result.hasMore;
        cursor = result.nextCursor || undefined;

        if (!hasMore) {
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const checkpoint = createCheckpoint(
          cursor || null,
          batchCount,
          totalSynced,
          {
            message: err.message,
            batchNumber: batchCount
          }
        );

        if (invalidateCache && this.client.isCacheEnabled()) {
          for (const productId of allAffectedProductIds) {
            this.client.invalidateCacheByProductId(productId);
          }
        }

        if (params.onError) {
          await params.onError(err, checkpoint);
        }

        return {
          list: lastResult?.list || [],
          nextCursor: cursor || null,
          hasMore: true,
          total: lastResult?.total,
          syncTime: new Date().toISOString(),
          updatedCount: totalSynced,
          deletedCount: 0,
          checkpoint
        };
      }
    }

    if (invalidateCache && this.client.isCacheEnabled()) {
      for (const productId of allAffectedProductIds) {
        this.client.invalidateCacheByProductId(productId);
      }
    }

    const finalCheckpoint = createCheckpoint(
      cursor || null,
      batchCount,
      totalSynced
    );

    return {
      list: lastResult?.list || [],
      nextCursor: cursor || null,
      hasMore,
      total: lastResult?.total,
      syncTime: new Date().toISOString(),
      updatedCount: totalSynced,
      deletedCount: 0,
      checkpoint: finalCheckpoint
    };
  }

  public createUsageRecordsCheckpoint(
    params: {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
      cursor?: string;
      lastSyncTime?: string;
      totalSynced?: number;
      batchCount?: number;
    }
  ): SyncCheckpoint {
    return {
      syncType: 'usage_records',
      cursor: params.cursor || null,
      lastSyncTime: params.lastSyncTime || new Date().toISOString(),
      totalSynced: params.totalSynced || 0,
      batchCount: params.batchCount || 0,
      lastBatchTime: new Date().toISOString(),
      filters: {
        productId: params.productId,
        authorizationId: params.authorizationId,
        status: params.status
      }
    };
  }

  public createChangeNoticesCheckpoint(
    params: {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      cursor?: string;
      lastSyncTime?: string;
      totalSynced?: number;
      batchCount?: number;
    }
  ): SyncCheckpoint {
    return {
      syncType: 'change_notices',
      cursor: params.cursor || null,
      lastSyncTime: params.lastSyncTime || new Date().toISOString(),
      totalSynced: params.totalSynced || 0,
      batchCount: params.batchCount || 0,
      lastBatchTime: new Date().toISOString(),
      filters: {
        productId: params.productId,
        type: params.type,
        level: params.level
      }
    };
  }

  public async syncUsageRecordsWithTask(
    params: {
      authorizationId?: string;
      productId?: string;
      status?: 'success' | 'failed';
      lastSyncTime?: string;
      batchSize?: number;
      checkpoint?: SyncCheckpoint;
      maxBatches?: number;
      onBatch?: (
        batch: UsageRecord[],
        checkpoint: SyncCheckpoint,
        hasMore: boolean
      ) => void | Promise<void>;
      onError?: (error: Error, checkpoint: SyncCheckpoint) => void | Promise<void>;
    } & SyncTaskOptions
  ): Promise<SyncWithTaskResult<UsageRecord>> {
    const batchSize = params.batchSize || 100;
    const maxBatches = params.maxBatches || Infinity;

    const filters: Record<string, unknown> = {
      productId: params.productId,
      authorizationId: params.authorizationId,
      status: params.status
    };

    const taskState = this.createInitialTaskState('usage_records', params, filters, params.checkpoint);
    const taskId = taskState.taskId;
    const policy = taskState.retryPolicy!;

    this.updateTaskState(taskId, { status: 'running' });
    if (params.onStateChange) {
      await params.onStateChange(this.taskStates.get(taskId)!);
    }

    let cursor: string | undefined = params.checkpoint?.cursor || undefined;
    let lastSyncTime: string | undefined = params.checkpoint?.lastSyncTime || params.lastSyncTime;
    let totalSynced = taskState.totalSynced;
    let batchCount = taskState.currentBatch;
    let hasMore = true;
    let lastResult: IncrementalResponse<UsageRecord> | null = null;
    const batchTimes: number[] = [];

    const createCheckpoint = (
      currentCursor: string | null,
      currentBatchCount: number,
      currentTotal: number,
      error?: { message: string; batchNumber: number }
    ): SyncCheckpoint => ({
      syncType: 'usage_records',
      cursor: currentCursor,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      totalSynced: currentTotal,
      batchCount: currentBatchCount,
      lastBatchTime: new Date().toISOString(),
      filters: params.checkpoint?.filters || filters,
      error: error
        ? {
            ...error,
            timestamp: new Date().toISOString()
          }
        : undefined
    });

    while (hasMore && batchCount < maxBatches) {
      const batchStartTime = Date.now();
      let retryCount = 0;

      try {
        const result = await this.executeWithRetry(
          async () => {
            this.updateTaskState(taskId, { status: retryCount > 0 ? 'retrying' : 'running' });
            return await this.getUsageRecordsIncremental({
              authorizationId: params.authorizationId,
              productId: params.productId,
              status: params.status,
              cursor,
              limit: batchSize,
              lastSyncTime
            });
          },
          policy,
          (count, err, delay) => {
            retryCount = count + 1;
            this.updateTaskState(taskId, {
              status: 'retrying',
              lastError: {
                message: err.message,
                batchNumber: batchCount + 1,
                timestamp: new Date().toISOString(),
                retryCount
              },
              statistics: {
                ...this.taskStates.get(taskId)!.statistics,
                totalRetries: this.taskStates.get(taskId)!.statistics.totalRetries + 1
              }
            });
            if (params.onStateChange) {
              params.onStateChange(this.taskStates.get(taskId)!);
            }
          }
        );

        lastResult = result;
        batchCount++;
        totalSynced += result.list.length;

        const batchTime = Date.now() - batchStartTime;
        batchTimes.push(batchTime);
        const avgBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;

        const checkpoint = createCheckpoint(result.nextCursor, batchCount, totalSynced);

        this.updateTaskState(taskId, {
          currentBatch: batchCount,
          totalSynced,
          lastCursor: result.nextCursor,
          lastSyncTime: new Date().toISOString(),
          hasMore: result.hasMore,
          lastError: undefined,
          statistics: {
            totalBatches: batchCount,
            successfulBatches: this.taskStates.get(taskId)!.statistics.successfulBatches + 1,
            failedBatches: this.taskStates.get(taskId)!.statistics.failedBatches,
            totalRetries: this.taskStates.get(taskId)!.statistics.totalRetries,
            averageBatchTimeMs: avgBatchTime
          }
        });

        if (params.onStateChange) {
          await params.onStateChange(this.taskStates.get(taskId)!);
        }

        if (params.onBatch) {
          await params.onBatch(result.list, checkpoint, result.hasMore);
        }

        hasMore = result.hasMore;
        cursor = result.nextCursor || undefined;

        if (!hasMore) {
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const checkpoint = createCheckpoint(cursor || null, batchCount, totalSynced, {
          message: err.message,
          batchNumber: batchCount + 1
        });

        this.updateTaskState(taskId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          lastError: {
            message: err.message,
            batchNumber: batchCount + 1,
            timestamp: new Date().toISOString(),
            retryCount
          },
          hasMore: true,
          statistics: {
            ...this.taskStates.get(taskId)!.statistics,
            failedBatches: this.taskStates.get(taskId)!.statistics.failedBatches + 1
          }
        });

        if (params.onStateChange) {
          await params.onStateChange(this.taskStates.get(taskId)!);
        }

        if (params.onError) {
          await params.onError(err, checkpoint);
        }

        return {
          list: lastResult?.list || [],
          nextCursor: cursor || null,
          hasMore: true,
          total: lastResult?.total,
          syncTime: new Date().toISOString(),
          updatedCount: totalSynced,
          deletedCount: 0,
          checkpoint,
          taskState: this.taskStates.get(taskId)!
        };
      }
    }

    const finalCheckpoint = createCheckpoint(cursor || null, batchCount, totalSynced);

    this.updateTaskState(taskId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      hasMore,
      lastCursor: cursor || null
    });

    if (params.onStateChange) {
      await params.onStateChange(this.taskStates.get(taskId)!);
    }

    return {
      list: lastResult?.list || [],
      nextCursor: cursor || null,
      hasMore,
      total: lastResult?.total,
      syncTime: new Date().toISOString(),
      updatedCount: totalSynced,
      deletedCount: 0,
      checkpoint: finalCheckpoint,
      taskState: this.taskStates.get(taskId)!
    };
  }

  public async syncChangeNoticesWithTask(
    params: {
      productId?: string;
      type?: ChangeNotice['type'];
      level?: ChangeNotice['level'];
      lastSyncTime?: string;
      batchSize?: number;
      checkpoint?: SyncCheckpoint;
      maxBatches?: number;
      invalidateCache?: boolean;
      onBatch?: (
        batch: ChangeNotice[],
        checkpoint: SyncCheckpoint,
        hasMore: boolean
      ) => void | Promise<void>;
      onError?: (error: Error, checkpoint: SyncCheckpoint) => void | Promise<void>;
    } & SyncTaskOptions
  ): Promise<SyncWithTaskResult<ChangeNotice>> {
    const batchSize = params.batchSize || 100;
    const maxBatches = params.maxBatches || Infinity;
    const invalidateCache = params.invalidateCache !== false;

    const filters: Record<string, unknown> = {
      productId: params.productId,
      type: params.type,
      level: params.level
    };

    const taskState = this.createInitialTaskState('change_notices', params, filters, params.checkpoint);
    const taskId = taskState.taskId;
    const policy = taskState.retryPolicy!;

    this.updateTaskState(taskId, { status: 'running' });
    if (params.onStateChange) {
      await params.onStateChange(this.taskStates.get(taskId)!);
    }

    let cursor: string | undefined = params.checkpoint?.cursor || undefined;
    let lastSyncTime: string | undefined = params.checkpoint?.lastSyncTime || params.lastSyncTime;
    let totalSynced = taskState.totalSynced;
    let batchCount = taskState.currentBatch;
    let hasMore = true;
    let lastResult: IncrementalResponse<ChangeNotice> | null = null;
    const batchTimes: number[] = [];
    const allAffectedProductIds = new Set<string>();

    const createCheckpoint = (
      currentCursor: string | null,
      currentBatchCount: number,
      currentTotal: number,
      error?: { message: string; batchNumber: number }
    ): SyncCheckpoint => ({
      syncType: 'change_notices',
      cursor: currentCursor,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      totalSynced: currentTotal,
      batchCount: currentBatchCount,
      lastBatchTime: new Date().toISOString(),
      filters: params.checkpoint?.filters || filters,
      error: error
        ? {
            ...error,
            timestamp: new Date().toISOString()
          }
        : undefined
    });

    const filterNotices = (notices: ChangeNotice[]): ChangeNotice[] => {
      return notices.filter((notice) => {
        if (params.productId && notice.productId !== params.productId) {
          return false;
        }
        if (params.type && notice.type !== params.type) {
          return false;
        }
        if (params.level && notice.level !== params.level) {
          return false;
        }
        return true;
      });
    };

    const invalidateAffectedCache = (productIds: Set<string>) => {
      if (!invalidateCache || !this.client.isCacheEnabled()) return;

      let affectedIds = productIds;
      if (params.productId) {
        affectedIds = new Set(Array.from(affectedIds).filter((id) => id === params.productId));
      }

      for (const productId of affectedIds) {
        this.client.invalidateCacheByProductId(productId);
      }
    };

    while (hasMore && batchCount < maxBatches) {
      const batchStartTime = Date.now();
      let retryCount = 0;

      try {
        const result = await this.executeWithRetry(
          async () => {
            this.updateTaskState(taskId, { status: retryCount > 0 ? 'retrying' : 'running' });
            return await this.getChangeNoticesIncremental({
              productId: params.productId,
              type: params.type,
              level: params.level,
              cursor,
              limit: batchSize,
              lastSyncTime
            });
          },
          policy,
          (count, err, delay) => {
            retryCount = count + 1;
            this.updateTaskState(taskId, {
              status: 'retrying',
              lastError: {
                message: err.message,
                batchNumber: batchCount + 1,
                timestamp: new Date().toISOString(),
                retryCount
              },
              statistics: {
                ...this.taskStates.get(taskId)!.statistics,
                totalRetries: this.taskStates.get(taskId)!.statistics.totalRetries + 1
              }
            });
            if (params.onStateChange) {
              params.onStateChange(this.taskStates.get(taskId)!);
            }
          }
        );

        const filteredList = filterNotices(result.list);
        lastResult = { ...result, list: filteredList };

        batchCount++;
        totalSynced += filteredList.length;

        if (invalidateCache) {
          filteredList.forEach((n) => allAffectedProductIds.add(n.productId));
        }

        const batchTime = Date.now() - batchStartTime;
        batchTimes.push(batchTime);
        const avgBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;

        const checkpoint = createCheckpoint(result.nextCursor, batchCount, totalSynced);

        this.updateTaskState(taskId, {
          currentBatch: batchCount,
          totalSynced,
          lastCursor: result.nextCursor,
          lastSyncTime: new Date().toISOString(),
          hasMore: result.hasMore,
          lastError: undefined,
          statistics: {
            totalBatches: batchCount,
            successfulBatches: this.taskStates.get(taskId)!.statistics.successfulBatches + 1,
            failedBatches: this.taskStates.get(taskId)!.statistics.failedBatches,
            totalRetries: this.taskStates.get(taskId)!.statistics.totalRetries,
            averageBatchTimeMs: avgBatchTime
          }
        });

        if (params.onStateChange) {
          await params.onStateChange(this.taskStates.get(taskId)!);
        }

        if (params.onBatch) {
          await params.onBatch(filteredList, checkpoint, result.hasMore);
        }

        hasMore = result.hasMore;
        cursor = result.nextCursor || undefined;

        if (!hasMore) {
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const checkpoint = createCheckpoint(cursor || null, batchCount, totalSynced, {
          message: err.message,
          batchNumber: batchCount + 1
        });

        invalidateAffectedCache(allAffectedProductIds);

        this.updateTaskState(taskId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          lastError: {
            message: err.message,
            batchNumber: batchCount + 1,
            timestamp: new Date().toISOString(),
            retryCount
          },
          hasMore: true,
          statistics: {
            ...this.taskStates.get(taskId)!.statistics,
            failedBatches: this.taskStates.get(taskId)!.statistics.failedBatches + 1
          }
        });

        if (params.onStateChange) {
          await params.onStateChange(this.taskStates.get(taskId)!);
        }

        if (params.onError) {
          await params.onError(err, checkpoint);
        }

        return {
          list: lastResult?.list || [],
          nextCursor: cursor || null,
          hasMore: true,
          total: lastResult?.total,
          syncTime: new Date().toISOString(),
          updatedCount: totalSynced,
          deletedCount: 0,
          checkpoint,
          taskState: this.taskStates.get(taskId)!
        };
      }
    }

    invalidateAffectedCache(allAffectedProductIds);

    const finalCheckpoint = createCheckpoint(cursor || null, batchCount, totalSynced);

    this.updateTaskState(taskId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      hasMore,
      lastCursor: cursor || null
    });

    if (params.onStateChange) {
      await params.onStateChange(this.taskStates.get(taskId)!);
    }

    return {
      list: lastResult?.list || [],
      nextCursor: cursor || null,
      hasMore,
      total: lastResult?.total,
      syncTime: new Date().toISOString(),
      updatedCount: totalSynced,
      deletedCount: 0,
      checkpoint: finalCheckpoint,
      taskState: this.taskStates.get(taskId)!
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
