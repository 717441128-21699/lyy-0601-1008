export enum Industry {
  FINANCE = 'finance',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  TRANSPORTATION = 'transportation',
  ENERGY = 'energy',
  RETAIL = 'retail',
  MANUFACTURING = 'manufacturing',
  AGRICULTURE = 'agriculture',
  GOVERNMENT = 'government',
  OTHER = 'other'
}

export enum Region {
  BEIJING = 'beijing',
  SHANGHAI = 'shanghai',
  GUANGDONG = 'guangdong',
  ZHEJIANG = 'zhejiang',
  JIANGSU = 'jiangsu',
  SICHUAN = 'sichuan',
  HUBEI = 'hubei',
  HUNAN = 'hunan',
  SHANDONG = 'shandong',
  NATIONAL = 'national',
  OTHER = 'other'
}

export enum UpdateCycle {
  REAL_TIME = 'realtime',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  IRREGULAR = 'irregular'
}

export enum AuditStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum ApplyPurpose {
  RESEARCH = 'research',
  COMMERCIAL = 'commercial',
  PUBLIC_SERVICE = 'public_service',
  INTERNAL_MANAGEMENT = 'internal_management',
  OTHER = 'other'
}

export interface DataProduct {
  id: string;
  name: string;
  description: string;
  provider: string;
  industry: Industry;
  region: Region;
  tags: string[];
  updateCycle: UpdateCycle;
  category: string;
  price: number;
  priceUnit: string;
  updateTime: string;
  publishTime: string;
  viewCount: number;
  applyCount: number;
  rating: number;
  status: 'online' | 'offline' | 'maintenance';
  samplePreviewAvailable: boolean;
  authorizationRequired: boolean;
}

export interface DataField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  description: string;
  isNullable: boolean;
  isEncrypted: boolean;
  sampleValue: string;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface SampleData {
  summary: string;
  recordCount: number;
  fields: string[];
  previewRecords: Record<string, unknown>[];
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    uniqueness: number;
  };
}

export interface SearchParams {
  keyword?: string;
  industry?: Industry | Industry[];
  region?: Region | Region[];
  tags?: string[];
  updateCycle?: UpdateCycle | UpdateCycle[];
  category?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'updateTime' | 'viewCount' | 'applyCount' | 'rating' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  total: number;
  page: number;
  pageSize: number;
  list: DataProduct[];
  facets: {
    industries: Array<{ code: Industry; name: string; count: number }>;
    regions: Array<{ code: Region; name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    updateCycles: Array<{ code: UpdateCycle; name: string; count: number }>;
  };
}

export interface ResourceDetail {
  product: DataProduct;
  fields: DataField[];
  sampleData: SampleData;
  usageGuide: string;
  apiSpec?: {
    endpoints: Array<{
      path: string;
      method: string;
      description: string;
      requestParams: Record<string, unknown>;
      responseSchema: Record<string, unknown>;
    }>;
  };
  serviceLevel?: {
    availability: number;
    responseTime: number;
    supportChannel: string[];
  };
}

export interface ApplyMaterial {
  name: string;
  type: string;
  required: boolean;
  description: string;
  uploaded?: boolean;
  fileUrl?: string;
}

export interface ApplyRequest {
  productId: string;
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
}

export interface MaterialValidationResult {
  valid: boolean;
  missingMaterials: string[];
  invalidMaterials: Array<{ name: string; reason: string }>;
  warnings: string[];
}

export interface ApplyResponse {
  applyId: string;
  productId: string;
  status: AuditStatus;
  submitTime: string;
  estimatedAuditTime: string;
}

export interface AuditRecord {
  id: string;
  applyId: string;
  status: AuditStatus;
  operator: string;
  operationTime: string;
  comment: string;
}

export interface Authorization {
  id: string;
  applyId: string;
  productId: string;
  productName: string;
  status: 'active' | 'expired' | 'revoked' | 'suspended' | 'pending' | 'rejected' | 'cancelled';
  scope: {
    callLimit: number;
    callCount: number;
    ipWhitelist?: string[];
    dataRange?: string[];
  };
  validFrom: string;
  validTo: string;
  createdAt: string;
}

export interface ExpireReminder {
  authorizationId: string;
  productId: string;
  productName: string;
  daysRemaining: number;
  validTo: string;
  callCount: number;
  callLimit: number;
}

export interface UsageRecord {
  id: string;
  authorizationId: string;
  productId: string;
  productName: string;
  callTime: string;
  endpoint: string;
  status: 'success' | 'failed';
  responseTime: number;
  inputSize?: number;
  outputSize?: number;
  errorMessage?: string;
}

export interface ChangeNotice {
  id: string;
  productId: string;
  productName: string;
  type: 'update' | 'deprecation' | 'price_change' | 'policy_change' | 'maintenance';
  title: string;
  content: string;
  level: 'info' | 'warning' | 'critical';
  publishTime: string;
  effectiveTime: string;
}

export interface CitationInfo {
  productId: string;
  productName: string;
  provider: string;
  version: string;
  accessDate: string;
  sourceUrl: string;
  citationText: string;
  formats: {
    apa: string;
    gb: string;
    bibtex: string;
  };
}

export interface SDKConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  timeout?: number;
  debug?: boolean;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId: string;
  timestamp: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
}

export interface UsageStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgResponseTime: number;
  totalInputSize: number;
  totalOutputSize: number;
  details: Array<{
    date: string;
    callCount: number;
    successCount: number;
    avgResponseTime: number;
  }>;
}

export interface BatchResult<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: number;
    message: string;
    traceId?: string;
  };
}

export interface BatchResponse<T> {
  total: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    id: string;
    success: boolean;
    data: T | null;
    error?: {
      code: number;
      message: string;
      traceId?: string;
    };
  }>;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  startTime?: string;
  endTime?: string;
}

export interface CursorResponse<T> {
  list: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface IncrementalPullParams extends CursorPaginationParams {
  lastSyncTime?: string;
  includeDeleted?: boolean;
}

export interface IncrementalResponse<T> extends CursorResponse<T> {
  syncTime: string;
  updatedCount: number;
  deletedCount: number;
}

export interface SyncCheckpoint {
  syncType: 'usage_records' | 'change_notices';
  cursor: string | null;
  lastSyncTime: string;
  totalSynced: number;
  batchCount: number;
  lastBatchTime: string;
  filters?: {
    productId?: string;
    authorizationId?: string;
    status?: string;
    type?: string;
    level?: string;
    startTime?: string;
    endTime?: string;
  };
  error?: {
    message: string;
    batchNumber: number;
    timestamp: string;
  };
  metadata?: Record<string, unknown>;
}

export interface SyncResultWithCheckpoint<T> {
  list: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
  syncTime: string;
  updatedCount: number;
  deletedCount: number;
  checkpoint: SyncCheckpoint;
}

export type AuthorizationInvalidReason =
  | 'expired'
  | 'calls_exhausted'
  | 'status_suspended'
  | 'status_revoked'
  | 'status_pending'
  | 'status_rejected'
  | 'status_cancelled'
  | 'not_found'
  | 'unknown';

export interface AuthorizationCheckResult {
  valid: boolean;
  reason?: AuthorizationInvalidReason;
  reasonMessage?: string;
  authorization?: Authorization;
}

export type BatchQueryStatus =
  | 'success'
  | 'network_error'
  | 'platform_error'
  | 'invalid_request'
  | 'timeout'
  | 'unknown_error';

export interface DetailedBatchResult<T> {
  id: string;
  status: BatchQueryStatus;
  data: T | null;
  error?: {
    code: number;
    message: string;
    traceId?: string;
  };
}

export interface DetailedBatchResponse<T> {
  total: number;
  successCount: number;
  failedCount: number;
  summary: {
    success: number;
    networkError: number;
    platformError: number;
    invalidRequest: number;
    timeout: number;
    unknownError: number;
  };
  authorizationSummary?: {
    valid: number;
    expired: number;
    callsExhausted: number;
    suspended: number;
    revoked: number;
    pending: number;
    rejected: number;
    cancelled: number;
    notFound: number;
    unknown: number;
  };
  results: DetailedBatchResult<T>[];
}

export * from '../errors';
