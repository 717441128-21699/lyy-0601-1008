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
  status: 'active' | 'expired' | 'revoked' | 'suspended';
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

export * from '../errors';
