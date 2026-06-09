import dayjs from 'dayjs';
import { HttpClient } from '../client/HttpClient';
import {
  Authorization,
  ExpireReminder,
  AuditRecord,
  AuditStatus,
  PaginationParams,
  BatchResponse,
  AuthorizationCheckResult,
  AuthorizationInvalidReason,
  DetailedBatchResponse,
  DetailedBatchResult,
  BatchQueryStatus
} from '../types';
import {
  validateRequiredParams,
  validateParamRange,
  validateParamEnum,
  ParameterInvalidError,
  SDKError,
  ErrorCode
} from '../errors';

export class AuthorizationStatus {
  private readonly client: HttpClient;
  private readonly statusNames: Record<AuditStatus, string> = {
    [AuditStatus.PENDING]: '待审核',
    [AuditStatus.REVIEWING]: '审核中',
    [AuditStatus.APPROVED]: '已通过',
    [AuditStatus.REJECTED]: '已拒绝',
    [AuditStatus.EXPIRED]: '已过期',
    [AuditStatus.CANCELLED]: '已取消'
  };

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async getAuthorizationList(params?: PaginationParams & {
    status?: 'active' | 'expired' | 'revoked' | 'suspended';
    productId?: string;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    list: Authorization[];
  }> {
    const queryParams: Record<string, unknown> = {};

    if (params?.status) {
      validateParamEnum('status', params.status, ['active', 'expired', 'revoked', 'suspended']);
      queryParams.status = params.status;
    }
    if (params?.productId) {
      queryParams.productId = params.productId;
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
      list: Authorization[];
    }>('/api/v1/authorization/list', queryParams);

    return result;
  }

  public async getAuthorizationDetail(authorizationId: string): Promise<Authorization> {
    validateRequiredParams({ authorizationId }, ['authorizationId']);

    const result = await this.client.get<Authorization>(
      `/api/v1/authorization/${authorizationId}`
    );

    return result;
  }

  public async getAuthorizationByApplyId(applyId: string): Promise<Authorization> {
    validateRequiredParams({ applyId }, ['applyId']);

    const result = await this.client.get<Authorization>(
      `/api/v1/authorization/apply/${applyId}`
    );

    return result;
  }

  public async getAuditProgress(applyId: string): Promise<{
    applyId: string;
    currentStatus: AuditStatus;
    currentStatusName: string;
    progress: number;
    estimatedCompleteTime?: string;
    auditRecords: AuditRecord[];
  }> {
    validateRequiredParams({ applyId }, ['applyId']);

    const result = await this.client.get<{
      applyId: string;
      currentStatus: AuditStatus;
      estimatedCompleteTime?: string;
      auditRecords: AuditRecord[];
    }>(`/api/v1/authorization/audit-progress/${applyId}`);

    return {
      ...result,
      currentStatusName: this.getStatusName(result.currentStatus),
      progress: this.calculateProgress(result.currentStatus)
    };
  }

  public async getAuthorizationScope(authorizationId: string): Promise<{
    authorizationId: string;
    productId: string;
    productName: string;
    scope: {
      callLimit: number;
      callCount: number;
      remainingCalls: number;
      ipWhitelist?: string[];
      dataRange?: string[];
      features?: string[];
    };
    validFrom: string;
    validTo: string;
    daysRemaining: number;
  }> {
    validateRequiredParams({ authorizationId }, ['authorizationId']);

    const result = await this.client.get<{
      authorizationId: string;
      productId: string;
      productName: string;
      scope: {
        callLimit: number;
        callCount: number;
        ipWhitelist?: string[];
        dataRange?: string[];
        features?: string[];
      };
      validFrom: string;
      validTo: string;
    }>(`/api/v1/authorization/${authorizationId}/scope`);

    const daysRemaining = dayjs(result.validTo).diff(dayjs(), 'day');

    return {
      ...result,
      scope: {
        ...result.scope,
        remainingCalls: Math.max(0, result.scope.callLimit - result.scope.callCount)
      },
      daysRemaining
    };
  }

  public async getExpireReminders(daysThreshold: number = 30): Promise<ExpireReminder[]> {
    validateParamRange('daysThreshold', daysThreshold, 1, 365);

    const result = await this.client.get<ExpireReminder[]>(
      '/api/v1/authorization/expire-reminders',
      { daysThreshold }
    );

    return result;
  }

  public async checkAuthorizationValid(authorizationId: string): Promise<AuthorizationCheckResult> {
    validateRequiredParams({ authorizationId }, ['authorizationId']);

    const auth = await this.getAuthorizationDetail(authorizationId);

    let reason: AuthorizationInvalidReason | undefined;
    let reasonMessage: string | undefined;

    const status = auth.status as string;

    if (status === 'expired' || dayjs(auth.validTo).isBefore(dayjs())) {
      reason = 'expired';
      reasonMessage = '授权已过期';
    } else if (auth.scope.callCount >= auth.scope.callLimit) {
      reason = 'calls_exhausted';
      reasonMessage = '调用次数已用尽';
    } else if (status === 'suspended') {
      reason = 'status_suspended';
      reasonMessage = '授权已暂停';
    } else if (status === 'revoked') {
      reason = 'status_revoked';
      reasonMessage = '授权已撤销';
    } else if (status === 'pending') {
      reason = 'status_pending';
      reasonMessage = '授权待审核';
    } else if (status === 'rejected') {
      reason = 'status_rejected';
      reasonMessage = '授权已拒绝';
    } else if (status === 'cancelled') {
      reason = 'status_cancelled';
      reasonMessage = '授权已取消';
    } else if (status !== 'active') {
      reason = 'unknown';
      reasonMessage = `授权状态为 ${status}，不可用`;
    }

    return {
      valid: reason === undefined,
      reason,
      reasonMessage,
      authorization: auth
    };
  }

  public async renewAuthorization(
    authorizationId: string,
    durationDays: number,
    reason?: string
  ): Promise<{
    applyId: string;
    authorizationId: string;
    status: AuditStatus;
    submitTime: string;
  }> {
    validateRequiredParams({ authorizationId, durationDays }, ['authorizationId', 'durationDays']);
    validateParamRange('durationDays', durationDays, 30, 3650);

    if (reason !== undefined && (reason.length < 10 || reason.length > 500)) {
      throw new ParameterInvalidError('reason', '续期原因长度必须在 10 到 500 个字符之间');
    }

    const result = await this.client.post<{
      applyId: string;
      authorizationId: string;
      status: AuditStatus;
      submitTime: string;
    }>(`/api/v1/authorization/${authorizationId}/renew`, {
      durationDays,
      reason
    });

    return result;
  }

  public async suspendAuthorization(
    authorizationId: string,
    reason: string
  ): Promise<{
    authorizationId: string;
    status: 'suspended';
    suspendTime: string;
  }> {
    validateRequiredParams({ authorizationId, reason }, ['authorizationId', 'reason']);

    if (reason.length < 10 || reason.length > 500) {
      throw new ParameterInvalidError('reason', '暂停原因长度必须在 10 到 500 个字符之间');
    }

    const result = await this.client.post<{
      authorizationId: string;
      status: 'suspended';
      suspendTime: string;
    }>(`/api/v1/authorization/${authorizationId}/suspend`, { reason });

    return result;
  }

  public async resumeAuthorization(
    authorizationId: string,
    reason: string
  ): Promise<{
    authorizationId: string;
    status: 'active';
    resumeTime: string;
  }> {
    validateRequiredParams({ authorizationId, reason }, ['authorizationId', 'reason']);

    if (reason.length < 10 || reason.length > 500) {
      throw new ParameterInvalidError('reason', '恢复原因长度必须在 10 到 500 个字符之间');
    }

    const result = await this.client.post<{
      authorizationId: string;
      status: 'active';
      resumeTime: string;
    }>(`/api/v1/authorization/${authorizationId}/resume`, { reason });

    return result;
  }

  public async revokeAuthorization(
    authorizationId: string,
    reason: string
  ): Promise<{
    authorizationId: string;
    status: 'revoked';
    revokeTime: string;
  }> {
    validateRequiredParams({ authorizationId, reason }, ['authorizationId', 'reason']);

    if (reason.length < 10 || reason.length > 500) {
      throw new ParameterInvalidError('reason', '撤销原因长度必须在 10 到 500 个字符之间');
    }

    const result = await this.client.post<{
      authorizationId: string;
      status: 'revoked';
      revokeTime: string;
    }>(`/api/v1/authorization/${authorizationId}/revoke`, { reason });

    return result;
  }

  public async updateIpWhitelist(
    authorizationId: string,
    ipWhitelist: string[]
  ): Promise<{
    authorizationId: string;
    ipWhitelist: string[];
    updateTime: string;
  }> {
    validateRequiredParams({ authorizationId, ipWhitelist }, ['authorizationId', 'ipWhitelist']);

    if (ipWhitelist.length === 0) {
      throw new ParameterInvalidError('ipWhitelist', 'IP白名单不能为空');
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    for (const ip of ipWhitelist) {
      if (!ipRegex.test(ip)) {
        throw new ParameterInvalidError('ipWhitelist', `IP格式不正确: ${ip}`);
      }
    }

    const result = await this.client.put<{
      authorizationId: string;
      ipWhitelist: string[];
      updateTime: string;
    }>(`/api/v1/authorization/${authorizationId}/ip-whitelist`, { ipWhitelist });

    return result;
  }

  public getStatusName(status: AuditStatus): string {
    return this.statusNames[status] || status;
  }

  public getAuthorizationStatusName(
    status: 'active' | 'expired' | 'revoked' | 'suspended'
  ): string {
    const names: Record<string, string> = {
      active: '有效',
      expired: '已过期',
      revoked: '已撤销',
      suspended: '已暂停'
    };
    return names[status] || status;
  }

  public getRemainingDays(validTo: string): number {
    return Math.max(0, dayjs(validTo).diff(dayjs(), 'day'));
  }

  public isExpiringSoon(validTo: string, daysThreshold: number = 30): boolean {
    const remaining = this.getRemainingDays(validTo);
    return remaining > 0 && remaining <= daysThreshold;
  }

  public isExpired(validTo: string): boolean {
    return dayjs(validTo).isBefore(dayjs());
  }

  private classifyError(error: unknown): {
    status: BatchQueryStatus;
    code: number;
    message: string;
    traceId?: string;
  } {
    let status: BatchQueryStatus = 'unknown_error';
    let code = ErrorCode.UNKNOWN_ERROR;
    let message = '未知错误';
    let traceId: string | undefined;

    if (error instanceof SDKError) {
      code = error.code;
      message = error.message;
      traceId = error.traceId;

      switch (error.code) {
        case ErrorCode.PARAM_MISSING:
        case ErrorCode.PARAM_INVALID:
        case ErrorCode.MATERIAL_MISSING:
        case ErrorCode.MATERIAL_INVALID:
          status = 'invalid_request';
          break;
        case ErrorCode.RESOURCE_NOT_FOUND:
          status = 'platform_error';
          break;
        case ErrorCode.UNAUTHORIZED:
        case ErrorCode.TOKEN_EXPIRED:
        case ErrorCode.NO_PERMISSION:
          status = 'platform_error';
          break;
        case ErrorCode.RATE_LIMIT_EXCEEDED:
        case ErrorCode.SERVICE_UNAVAILABLE:
        case ErrorCode.INTERNAL_ERROR:
          status = 'platform_error';
          break;
        default:
          status = 'platform_error';
      }
    } else if (error instanceof Error) {
      message = error.message;

      if (
        error.message.includes('timeout') ||
        error.message.includes('TIMEOUT') ||
        error.message.includes('ETIMEDOUT')
      ) {
        status = 'timeout';
        code = ErrorCode.UNKNOWN_ERROR;
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNABORTED')
      ) {
        status = 'network_error';
        code = ErrorCode.SERVICE_UNAVAILABLE;
      } else {
        status = 'unknown_error';
      }
    }

    return { status, code, message, traceId };
  }

  public async batchCheckAuthorizationValid(
    authorizationIds: string[],
    options?: {
      concurrency?: number;
    }
  ): Promise<DetailedBatchResponse<AuthorizationCheckResult>> {
    if (!authorizationIds || authorizationIds.length === 0) {
      throw new SDKError(ErrorCode.PARAM_MISSING, 'authorizationIds 不能为空');
    }

    validateParamRange('authorizationIds.length', authorizationIds.length, 1, 100);

    const concurrency = options?.concurrency || 10;
    const results: DetailedBatchResult<AuthorizationCheckResult>[] = [];

    const summary: DetailedBatchResponse<AuthorizationCheckResult>['summary'] = {
      success: 0,
      networkError: 0,
      platformError: 0,
      invalidRequest: 0,
      timeout: 0,
      unknownError: 0
    };

    const authSummary: Required<DetailedBatchResponse<AuthorizationCheckResult>['authorizationSummary']> = {
      valid: 0,
      expired: 0,
      callsExhausted: 0,
      suspended: 0,
      revoked: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      notFound: 0,
      unknown: 0
    };

    for (let i = 0; i < authorizationIds.length; i += concurrency) {
      const batch = authorizationIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (authorizationId) => {
        try {
          validateRequiredParams({ authorizationId }, ['authorizationId']);

          const data = await this.checkAuthorizationValid(authorizationId);

          summary.success++;

          if (data.valid) {
            authSummary.valid++;
          } else if (data.reason) {
            switch (data.reason) {
              case 'expired':
                authSummary.expired++;
                break;
              case 'calls_exhausted':
                authSummary.callsExhausted++;
                break;
              case 'status_suspended':
                authSummary.suspended++;
                break;
              case 'status_revoked':
                authSummary.revoked++;
                break;
              case 'status_pending':
                authSummary.pending++;
                break;
              case 'status_rejected':
                authSummary.rejected++;
                break;
              case 'status_cancelled':
                authSummary.cancelled++;
                break;
              case 'not_found':
                authSummary.notFound++;
                break;
              default:
                authSummary.unknown++;
            }
          }

          return {
            id: authorizationId,
            status: 'success' as const,
            data,
            error: undefined
          };
        } catch (error) {
          const errorInfo = this.classifyError(error);

          switch (errorInfo.status) {
            case 'network_error':
              summary.networkError++;
              break;
            case 'platform_error':
              summary.platformError++;
              break;
            case 'invalid_request':
              summary.invalidRequest++;
              break;
            case 'timeout':
              summary.timeout++;
              break;
            default:
              summary.unknownError++;
          }

          return {
            id: authorizationId,
            status: errorInfo.status,
            data: null,
            error: {
              code: errorInfo.code,
              message: errorInfo.message,
              traceId: errorInfo.traceId
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = summary.success;
    const failedCount = authorizationIds.length - successCount;

    return {
      total: authorizationIds.length,
      successCount,
      failedCount,
      summary,
      authorizationSummary: authSummary,
      results
    };
  }

  public async batchGetAuthorizationScopes(
    authorizationIds: string[],
    options?: {
      concurrency?: number;
    }
  ): Promise<BatchResponse<{
    authorizationId: string;
    productId: string;
    productName: string;
    scope: {
      callLimit: number;
      callCount: number;
      remainingCalls: number;
      ipWhitelist?: string[];
      dataRange?: string[];
      features?: string[];
    };
    validFrom: string;
    validTo: string;
    daysRemaining: number;
  }>> {
    if (!authorizationIds || authorizationIds.length === 0) {
      throw new SDKError(ErrorCode.PARAM_MISSING, 'authorizationIds 不能为空');
    }

    validateParamRange('authorizationIds.length', authorizationIds.length, 1, 100);

    const concurrency = options?.concurrency || 10;
    const results: BatchResponse<{
      authorizationId: string;
      productId: string;
      productName: string;
      scope: {
        callLimit: number;
        callCount: number;
        remainingCalls: number;
        ipWhitelist?: string[];
        dataRange?: string[];
        features?: string[];
      };
      validFrom: string;
      validTo: string;
      daysRemaining: number;
    }>['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < authorizationIds.length; i += concurrency) {
      const batch = authorizationIds.slice(i, i + concurrency);
      const batchPromises = batch.map(async (authorizationId) => {
        try {
          validateRequiredParams({ authorizationId }, ['authorizationId']);

          const data = await this.getAuthorizationScope(authorizationId);

          successCount++;
          return {
            id: authorizationId,
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
            id: authorizationId,
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
      total: authorizationIds.length,
      successCount,
      failedCount,
      results
    };
  }

  private calculateProgress(status: AuditStatus): number {
    const progressMap: Record<AuditStatus, number> = {
      [AuditStatus.PENDING]: 0,
      [AuditStatus.REVIEWING]: 50,
      [AuditStatus.APPROVED]: 100,
      [AuditStatus.REJECTED]: 100,
      [AuditStatus.EXPIRED]: 100,
      [AuditStatus.CANCELLED]: 100
    };
    return progressMap[status] || 0;
  }
}
