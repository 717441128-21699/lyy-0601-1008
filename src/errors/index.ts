export enum ErrorCode {
  SUCCESS = 0,
  PARAM_MISSING = 40001,
  PARAM_INVALID = 40002,
  UNAUTHORIZED = 40101,
  TOKEN_EXPIRED = 40102,
  NO_PERMISSION = 40301,
  RESOURCE_NOT_FOUND = 40401,
  RESOURCE_EXPIRED = 41001,
  APPLY_NOT_FOUND = 40402,
  AUTHORIZATION_NOT_FOUND = 40403,
  MATERIAL_MISSING = 40003,
  MATERIAL_INVALID = 40004,
  RATE_LIMIT_EXCEEDED = 42901,
  INTERNAL_ERROR = 50001,
  SERVICE_UNAVAILABLE = 50301,
  UNKNOWN_ERROR = 99999
}

export class SDKError extends Error {
  public readonly code: number;
  public readonly traceId: string;
  public readonly raw?: unknown;

  constructor(code: number, message: string, traceId: string = '', raw?: unknown) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.traceId = traceId;
    this.raw = raw;
    Object.setPrototypeOf(this, SDKError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      traceId: this.traceId
    };
  }
}

export class ParameterMissingError extends SDKError {
  constructor(paramName: string, traceId?: string) {
    super(ErrorCode.PARAM_MISSING, `缺少必填参数: ${paramName}`, traceId);
    this.name = 'ParameterMissingError';
    Object.setPrototypeOf(this, ParameterMissingError.prototype);
  }
}

export class ParameterInvalidError extends SDKError {
  constructor(paramName: string, reason: string, traceId?: string) {
    super(ErrorCode.PARAM_INVALID, `参数 ${paramName} 无效: ${reason}`, traceId);
    this.name = 'ParameterInvalidError';
    Object.setPrototypeOf(this, ParameterInvalidError.prototype);
  }
}

export class UnauthorizedError extends SDKError {
  constructor(message: string = '未授权访问', traceId?: string) {
    super(ErrorCode.UNAUTHORIZED, message, traceId);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class TokenExpiredError extends SDKError {
  constructor(message: string = 'Token 已过期', traceId?: string) {
    super(ErrorCode.TOKEN_EXPIRED, message, traceId);
    this.name = 'TokenExpiredError';
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

export class NoPermissionError extends SDKError {
  constructor(resource: string, traceId?: string) {
    super(ErrorCode.NO_PERMISSION, `无权限访问资源: ${resource}`, traceId);
    this.name = 'NoPermissionError';
    Object.setPrototypeOf(this, NoPermissionError.prototype);
  }
}

export class ResourceNotFoundError extends SDKError {
  constructor(resourceId: string, resourceType: string = '资源', traceId?: string) {
    super(ErrorCode.RESOURCE_NOT_FOUND, `${resourceType}不存在: ${resourceId}`, traceId);
    this.name = 'ResourceNotFoundError';
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

export class ResourceExpiredError extends SDKError {
  constructor(resourceId: string, traceId?: string) {
    super(ErrorCode.RESOURCE_EXPIRED, `资源已过期: ${resourceId}`, traceId);
    this.name = 'ResourceExpiredError';
    Object.setPrototypeOf(this, ResourceExpiredError.prototype);
  }
}

export class RateLimitExceededError extends SDKError {
  constructor(limit: number, resetTime: string, traceId?: string) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `超出调用频率限制 ${limit} 次/分钟，将在 ${resetTime} 后重置`,
      traceId
    );
    this.name = 'RateLimitExceededError';
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

export class InternalServerError extends SDKError {
  constructor(message: string, traceId?: string) {
    super(ErrorCode.INTERNAL_ERROR, `服务器内部错误: ${message}`, traceId);
    this.name = 'InternalServerError';
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export class MaterialMissingError extends SDKError {
  constructor(materialName: string, traceId?: string) {
    super(ErrorCode.MATERIAL_MISSING, `缺少申请材料: ${materialName}`, traceId);
    this.name = 'MaterialMissingError';
    Object.setPrototypeOf(this, MaterialMissingError.prototype);
  }
}

export class MaterialInvalidError extends SDKError {
  constructor(materialName: string, reason: string, traceId?: string) {
    super(ErrorCode.MATERIAL_INVALID, `申请材料 ${materialName} 无效: ${reason}`, traceId);
    this.name = 'MaterialInvalidError';
    Object.setPrototypeOf(this, MaterialInvalidError.prototype);
  }
}

export function isParameterError(error: unknown): error is ParameterMissingError | ParameterInvalidError | MaterialMissingError | MaterialInvalidError {
  return (
    error instanceof ParameterMissingError ||
    error instanceof ParameterInvalidError ||
    error instanceof MaterialMissingError ||
    error instanceof MaterialInvalidError ||
    (error instanceof SDKError &&
      (error.code === ErrorCode.PARAM_MISSING ||
        error.code === ErrorCode.PARAM_INVALID ||
        error.code === ErrorCode.MATERIAL_MISSING ||
        error.code === ErrorCode.MATERIAL_INVALID))
  );
}

export function handleApiError(response: {
  code: number;
  message: string;
  traceId: string;
  data?: unknown;
}): SDKError {
  switch (response.code) {
    case ErrorCode.PARAM_MISSING: {
      const paramMatch = response.message.match(/缺少必填参数[：: ]*([^\s,，]+)/);
      if (paramMatch && paramMatch[1]) {
        return new ParameterMissingError(paramMatch[1], response.traceId);
      }
      const materialMatch = response.message.match(/缺少材料[：: ]*([^\s,，]+)/);
      if (materialMatch && materialMatch[1]) {
        return new MaterialMissingError(materialMatch[1], response.traceId);
      }
      return new ParameterMissingError('request', response.traceId);
    }
    case ErrorCode.MATERIAL_MISSING: {
      const match = response.message.match(/材料[：: ]*([^\s,，]+)/);
      const materialName = match ? match[1] : 'unknown';
      return new MaterialMissingError(materialName, response.traceId);
    }
    case ErrorCode.PARAM_INVALID: {
      const paramMatch = response.message.match(/参数[：: ]*([^\s,，]+)[^:：]*[：: ]*(.+)/);
      if (paramMatch && paramMatch[1] && paramMatch[2]) {
        return new ParameterInvalidError(paramMatch[1], paramMatch[2].trim(), response.traceId);
      }
      const materialMatch = response.message.match(/材料[：: ]*([^\s,，]+)[^:：]*[：: ]*(.+)/);
      if (materialMatch && materialMatch[1] && materialMatch[2]) {
        return new MaterialInvalidError(materialMatch[1], materialMatch[2].trim(), response.traceId);
      }
      return new ParameterInvalidError('request', response.message, response.traceId);
    }
    case ErrorCode.MATERIAL_INVALID: {
      const match = response.message.match(/材料[：: ]*([^\s,，]+)[^:：]*[：: ]*(.+)/);
      const materialName = match ? match[1] : 'unknown';
      const reason = match && match[2] ? match[2].trim() : response.message;
      return new MaterialInvalidError(materialName, reason, response.traceId);
    }
    case ErrorCode.UNAUTHORIZED:
      return new UnauthorizedError(response.message, response.traceId);
    case ErrorCode.TOKEN_EXPIRED:
      return new TokenExpiredError(response.message, response.traceId);
    case ErrorCode.NO_PERMISSION:
      return new NoPermissionError('requested resource', response.traceId);
    case ErrorCode.RESOURCE_NOT_FOUND:
      return new ResourceNotFoundError('', '资源', response.traceId);
    case ErrorCode.RESOURCE_EXPIRED:
      return new ResourceExpiredError('', response.traceId);
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return new SDKError(response.code, response.message, response.traceId);
    case ErrorCode.INTERNAL_ERROR:
      return new InternalServerError(response.message, response.traceId);
    default:
      return new SDKError(response.code, response.message || '未知错误', response.traceId);
  }
}

export function validateRequiredParams(
  params: Record<string, unknown>,
  requiredFields: string[]
): void {
  for (const field of requiredFields) {
    const value = params[field];
    if (value === undefined || value === null || value === '') {
      throw new ParameterMissingError(field);
    }
  }
}

export function validateParamRange(
  paramName: string,
  value: number,
  min: number,
  max: number
): void {
  if (value < min || value > max) {
    throw new ParameterInvalidError(paramName, `值必须在 ${min} 到 ${max} 之间`);
  }
}

export function validateParamEnum<T extends string>(
  paramName: string,
  value: string,
  validValues: T[]
): void {
  if (!validValues.includes(value as T)) {
    throw new ParameterInvalidError(paramName, `有效值为: ${validValues.join(', ')}`);
  }
}

export function validateEmail(paramName: string, value: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new ParameterInvalidError(paramName, '邮箱格式不正确');
  }
}

export function validatePhone(paramName: string, value: string): void {
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(value)) {
    throw new ParameterInvalidError(paramName, '手机号格式不正确');
  }
}
