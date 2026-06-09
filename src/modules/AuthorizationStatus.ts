import dayjs from 'dayjs';
import { HttpClient } from '../client/HttpClient';
import {
  Authorization,
  ExpireReminder,
  AuditRecord,
  AuditStatus,
  PaginationParams
} from '../types';
import {
  validateRequiredParams,
  validateParamRange,
  validateParamEnum,
  ParameterInvalidError
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

  public async checkAuthorizationValid(authorizationId: string): Promise<{
    valid: boolean;
    reason?: string;
    authorization?: Authorization;
  }> {
    validateRequiredParams({ authorizationId }, ['authorizationId']);

    try {
      const auth = await this.getAuthorizationDetail(authorizationId);

      if (auth.status !== 'active') {
        return {
          valid: false,
          reason: `授权状态为 ${auth.status}，不可用`,
          authorization: auth
        };
      }

      if (dayjs(auth.validTo).isBefore(dayjs())) {
        return {
          valid: false,
          reason: '授权已过期',
          authorization: auth
        };
      }

      if (auth.scope.callCount >= auth.scope.callLimit) {
        return {
          valid: false,
          reason: '调用次数已用尽',
          authorization: auth
        };
      }

      return {
        valid: true,
        authorization: auth
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : '未知错误'
      };
    }
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
