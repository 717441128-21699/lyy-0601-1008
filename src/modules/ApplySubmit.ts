import { HttpClient } from '../client/HttpClient';
import {
  ApplyRequest,
  ApplyResponse,
  ApplyMaterial,
  MaterialValidationResult,
  ApplyPurpose,
  AuditStatus
} from '../types';
import {
  validateRequiredParams,
  validateParamEnum,
  validateParamRange,
  validateEmail,
  validatePhone,
  ParameterInvalidError,
  MaterialMissingError,
  MaterialInvalidError,
  isParameterError
} from '../errors';

export class ApplySubmit {
  private readonly client: HttpClient;
  private readonly purposeNames: Record<ApplyPurpose, string> = {
    [ApplyPurpose.RESEARCH]: '科学研究',
    [ApplyPurpose.COMMERCIAL]: '商业用途',
    [ApplyPurpose.PUBLIC_SERVICE]: '公共服务',
    [ApplyPurpose.INTERNAL_MANAGEMENT]: '内部管理',
    [ApplyPurpose.OTHER]: '其他'
  };

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async getRequiredMaterials(productId: string): Promise<ApplyMaterial[]> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<ApplyMaterial[]>(
      `/api/v1/apply/products/${productId}/materials`
    );

    return result;
  }

  public validateMaterials(
    materials: ApplyMaterial[],
    requiredMaterials: ApplyMaterial[]
  ): MaterialValidationResult {
    const missingMaterials: string[] = [];
    const invalidMaterials: Array<{ name: string; reason: string }> = [];
    const warnings: string[] = [];

    const materialMap = new Map(materials.map((m) => [m.name, m]));

    for (const required of requiredMaterials) {
      if (!required.required) continue;

      const uploaded = materialMap.get(required.name);

      if (!uploaded || !uploaded.uploaded) {
        missingMaterials.push(required.name);
      } else {
        const validation = this.validateSingleMaterial(uploaded, required);
        if (!validation.valid) {
          invalidMaterials.push({
            name: required.name,
            reason: validation.reason || '材料无效'
          });
        } else if (validation.warning) {
          warnings.push(validation.warning);
        }
      }
    }

    for (const material of materials) {
      const required = requiredMaterials.find((r) => r.name === material.name);
      if (!required) {
        warnings.push(`材料 ${material.name} 不在所需材料列表中`);
      }
    }

    return {
      valid: missingMaterials.length === 0 && invalidMaterials.length === 0,
      missingMaterials,
      invalidMaterials,
      warnings
    };
  }

  public async submitApplication(request: ApplyRequest): Promise<ApplyResponse> {
    try {
      this.validateApplyRequest(request);

      const requiredMaterials = await this.getRequiredMaterials(request.productId);
      const validation = this.validateMaterials(request.materials, requiredMaterials);

      if (!validation.valid) {
        if (validation.missingMaterials.length > 0) {
          throw new MaterialMissingError(validation.missingMaterials[0]);
        }
        if (validation.invalidMaterials.length > 0) {
          const firstInvalid = validation.invalidMaterials[0];
          throw new MaterialInvalidError(firstInvalid.name, firstInvalid.reason);
        }
      }

      const result = await this.client.post<ApplyResponse>('/api/v1/apply/submit', {
        ...request,
        purpose: request.purpose,
        purposeName: this.purposeNames[request.purpose]
      } as unknown as Record<string, unknown>);

      return result;
    } catch (error) {
      if (isParameterError(error)) {
        throw error;
      }
      if (error instanceof Error && isParameterError(error)) {
        throw error;
      }
      throw error;
    }
  }

  public async getApplicationList(params?: {
    status?: AuditStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    list: Array<{
      applyId: string;
      productId: string;
      productName: string;
      status: AuditStatus;
      purpose: ApplyPurpose;
      submitTime: string;
      updateTime: string;
    }>;
  }> {
    const queryParams: Record<string, unknown> = {};

    if (params?.status) {
      validateParamEnum('status', params.status, Object.values(AuditStatus));
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

    const result = await this.client.get<{
      total: number;
      page: number;
      pageSize: number;
      list: Array<{
        applyId: string;
        productId: string;
        productName: string;
        status: AuditStatus;
        purpose: ApplyPurpose;
        submitTime: string;
        updateTime: string;
      }>;
    }>('/api/v1/apply/list', queryParams);

    return result;
  }

  public async getApplicationDetail(applyId: string): Promise<{
    applyId: string;
    productId: string;
    productName: string;
    status: AuditStatus;
    purpose: ApplyPurpose;
    purposeDescription: string;
    usageDuration: number;
    usageScope: string;
    expectedCallVolume: number;
    materials: ApplyMaterial[];
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    organization: string;
    department: string;
    submitTime: string;
    updateTime: string;
    auditRecords: Array<{
      id: string;
      status: AuditStatus;
      operator: string;
      operationTime: string;
      comment: string;
    }>;
  }> {
    validateRequiredParams({ applyId }, ['applyId']);

    const result = await this.client.get<{
      applyId: string;
      productId: string;
      productName: string;
      status: AuditStatus;
      purpose: ApplyPurpose;
      purposeDescription: string;
      usageDuration: number;
      usageScope: string;
      expectedCallVolume: number;
      materials: ApplyMaterial[];
      contactName: string;
      contactPhone: string;
      contactEmail: string;
      organization: string;
      department: string;
      submitTime: string;
      updateTime: string;
      auditRecords: Array<{
        id: string;
        status: AuditStatus;
        operator: string;
        operationTime: string;
        comment: string;
      }>;
    }>(`/api/v1/apply/${applyId}`);

    return result;
  }

  public async cancelApplication(applyId: string, reason: string): Promise<{
    applyId: string;
    status: AuditStatus;
    cancelTime: string;
  }> {
    validateRequiredParams({ applyId, reason }, ['applyId', 'reason']);

    if (reason.length < 10 || reason.length > 500) {
      throw new ParameterInvalidError('reason', '取消原因长度必须在 10 到 500 个字符之间');
    }

    const result = await this.client.post<{
      applyId: string;
      status: AuditStatus;
      cancelTime: string;
    }>(`/api/v1/apply/${applyId}/cancel`, { reason });

    return result;
  }

  public async updateApplication(
    applyId: string,
    updates: Partial<Pick<ApplyRequest, 'purposeDescription' | 'usageScope' | 'materials'>>
  ): Promise<{
    applyId: string;
    status: AuditStatus;
    updateTime: string;
  }> {
    validateRequiredParams({ applyId }, ['applyId']);

    if (Object.keys(updates).length === 0) {
      throw new ParameterInvalidError('updates', '至少需要更新一个字段');
    }

    if (updates.purposeDescription !== undefined) {
      if (updates.purposeDescription.length < 10 || updates.purposeDescription.length > 1000) {
        throw new ParameterInvalidError(
          'purposeDescription',
          '使用目的描述长度必须在 10 到 1000 个字符之间'
        );
      }
    }

    if (updates.usageScope !== undefined) {
      if (updates.usageScope.length < 10 || updates.usageScope.length > 1000) {
        throw new ParameterInvalidError(
          'usageScope',
          '使用范围长度必须在 10 到 1000 个字符之间'
        );
      }
    }

    const result = await this.client.put<{
      applyId: string;
      status: AuditStatus;
      updateTime: string;
    }>(`/api/v1/apply/${applyId}`, updates as Record<string, unknown>);

    return result;
  }

  public getPurposeName(purpose: ApplyPurpose): string {
    return this.purposeNames[purpose] || purpose;
  }

  public getPurposeList(): Array<{ code: ApplyPurpose; name: string }> {
    return Object.entries(this.purposeNames).map(([code, name]) => ({
      code: code as ApplyPurpose,
      name
    }));
  }

  public getUsageDurationOptions(): Array<{ value: number; label: string }> {
    return [
      { value: 30, label: '1个月' },
      { value: 90, label: '3个月' },
      { value: 180, label: '6个月' },
      { value: 365, label: '1年' },
      { value: 730, label: '2年' },
      { value: 1095, label: '3年' }
    ];
  }

  private validateSingleMaterial(
    material: ApplyMaterial,
    required: ApplyMaterial
  ): { valid: boolean; reason?: string; warning?: string } {
    if (!material.uploaded) {
      return { valid: false, reason: '材料未上传' };
    }

    if (!material.fileUrl) {
      return { valid: false, reason: '缺少文件地址' };
    }

    const allowedTypes = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    const fileExt = material.fileUrl.split('.').pop()?.toLowerCase();

    if (fileExt && !allowedTypes.includes(fileExt)) {
      return {
        valid: false,
        reason: `不支持的文件格式 ${fileExt}，支持格式: ${allowedTypes.join(', ')}`
      };
    }

    if (material.type !== required.type) {
      return {
        valid: true,
        warning: `材料类型不匹配，期望 ${required.type}，实际 ${material.type}`
      };
    }

    return { valid: true };
  }

  private validateApplyRequest(request: ApplyRequest): void {
    validateRequiredParams(
      {
        productId: request.productId,
        purpose: request.purpose,
        purposeDescription: request.purposeDescription,
        usageDuration: request.usageDuration,
        usageScope: request.usageScope,
        expectedCallVolume: request.expectedCallVolume,
        contactName: request.contactName,
        contactPhone: request.contactPhone,
        contactEmail: request.contactEmail,
        organization: request.organization,
        department: request.department
      },
      [
        'productId',
        'purpose',
        'purposeDescription',
        'usageDuration',
        'usageScope',
        'expectedCallVolume',
        'contactName',
        'contactPhone',
        'contactEmail',
        'organization',
        'department'
      ]
    );

    validateParamEnum('purpose', request.purpose, Object.values(ApplyPurpose));

    validateParamRange('usageDuration', request.usageDuration, 1, 3650);

    validateParamRange('expectedCallVolume', request.expectedCallVolume, 1, 1000000000);

    if (request.purposeDescription.length < 10 || request.purposeDescription.length > 1000) {
      throw new ParameterInvalidError(
        'purposeDescription',
        '使用目的描述长度必须在 10 到 1000 个字符之间'
      );
    }

    if (request.usageScope.length < 10 || request.usageScope.length > 1000) {
      throw new ParameterInvalidError(
        'usageScope',
        '使用范围长度必须在 10 到 1000 个字符之间'
      );
    }

    if (request.contactName.length < 2 || request.contactName.length > 50) {
      throw new ParameterInvalidError('contactName', '联系人姓名长度必须在 2 到 50 个字符之间');
    }

    validatePhone('contactPhone', request.contactPhone);
    validateEmail('contactEmail', request.contactEmail);

    if (request.organization.length < 2 || request.organization.length > 200) {
      throw new ParameterInvalidError('organization', '单位名称长度必须在 2 到 200 个字符之间');
    }

    if (request.department.length < 2 || request.department.length > 100) {
      throw new ParameterInvalidError('department', '部门名称长度必须在 2 到 100 个字符之间');
    }
  }
}
