import dayjs from 'dayjs';
import {
  Industry,
  Region,
  UpdateCycle,
  AuditStatus,
  ApplyPurpose,
  DataProduct,
  SearchResult,
  ResourceDetail,
  DataField,
  SampleData,
  ApplyResponse,
  ApplyMaterial,
  Authorization,
  AuditRecord,
  UsageRecord,
  UsageStats,
  ChangeNotice,
  CitationInfo,
  ExpireReminder
} from '../../types';

export class MockDataGenerator {
  private idCounter = 0;

  public generateId(prefix: string): string {
    this.idCounter++;
    return `${prefix}-${String(this.idCounter).padStart(6, '0')}`;
  }

  public randomFromArray<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  public randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  public randomFloat(min: number, max: number, decimals: number = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  }

  public randomBoolean(): boolean {
    return Math.random() > 0.5;
  }

  generateDataProduct(overrides?: Partial<DataProduct>): DataProduct {
    const industries = Object.values(Industry);
    const regions = Object.values(Region);
    const cycles = Object.values(UpdateCycle);
    const categories = ['基础数据', '行业数据', '融合数据', '专题数据', '实时数据'];
    const tagsPool = ['信用', '企业', '个人', '金融', '交通', '医疗', '教育', '能源', '环保', '政务'];

    const name = this.randomFromArray([
      '全国企业信用信息数据集',
      '城市交通流量实时数据',
      '居民健康档案统计数据',
      '教育资源分布数据集',
      '能源消耗统计分析',
      '环境空气质量监测数据',
      '政务服务办理数据',
      '商品零售价格指数',
      '人口统计分析数据',
      '科技创新成果数据集'
    ]);

    return {
      id: this.generateId('prod'),
      name,
      description: `这是${name}的详细描述，包含数据来源、更新频率、使用范围等信息。`,
      provider: this.randomFromArray(['国家数据局', '某省大数据局', '某市政务服务中心', '行业协会', '第三方数据服务商']),
      industry: this.randomFromArray(industries),
      region: this.randomFromArray(regions),
      tags: [this.randomFromArray(tagsPool), this.randomFromArray(tagsPool)].filter((v, i, a) => a.indexOf(v) === i),
      updateCycle: this.randomFromArray(cycles),
      category: this.randomFromArray(categories),
      price: this.randomInt(0, 10000),
      priceUnit: this.randomFromArray(['元/次', '元/月', '元/年', '元/GB', '免费']),
      updateTime: dayjs().subtract(this.randomInt(0, 30), 'day').toISOString(),
      publishTime: dayjs().subtract(this.randomInt(30, 365), 'day').toISOString(),
      viewCount: this.randomInt(100, 10000),
      applyCount: this.randomInt(10, 1000),
      rating: this.randomFloat(3, 5, 1),
      status: this.randomFromArray(['online', 'online', 'online', 'maintenance'] as const),
      samplePreviewAvailable: this.randomBoolean(),
      authorizationRequired: this.randomBoolean(),
      ...overrides
    };
  }

  generateSearchResult(page: number = 1, pageSize: number = 10): SearchResult {
    const total = this.randomInt(50, 200);
    const list: DataProduct[] = [];

    for (let i = 0; i < Math.min(pageSize, total - (page - 1) * pageSize); i++) {
      list.push(this.generateDataProduct());
    }

    const industries = Object.values(Industry).map((code) => ({
      code,
      name: code,
      count: this.randomInt(10, 100)
    }));

    const regions = Object.values(Region).map((code) => ({
      code,
      name: code,
      count: this.randomInt(5, 80)
    }));

    const tags = ['信用', '企业', '金融', '交通', '医疗', '教育', '能源', '环保'].map((name) => ({
      name,
      count: this.randomInt(10, 200)
    }));

    const updateCycles = Object.values(UpdateCycle).map((code) => ({
      code,
      name: code,
      count: this.randomInt(5, 100)
    }));

    return {
      total,
      page,
      pageSize,
      list,
      facets: {
        industries,
        regions,
        tags,
        updateCycles
      }
    };
  }

  generateDataField(): DataField {
    const types: DataField['type'][] = ['string', 'number', 'boolean', 'date', 'object', 'array'];
    const type = this.randomFromArray(types);

    const sampleValues: Record<string, string> = {
      string: '"示例文本内容"',
      number: String(this.randomInt(0, 10000)),
      boolean: String(this.randomBoolean()),
      date: dayjs().subtract(this.randomInt(0, 365), 'day').format('YYYY-MM-DD'),
      object: '{"key": "value"}',
      array: '[1, 2, 3]'
    };

    const fieldNames = ['id', 'name', 'age', 'address', 'phone', 'email', 'createTime', 'updateTime', 'status', 'amount', 'category', 'region'];

    return {
      name: this.randomFromArray(fieldNames) + '_' + this.randomInt(1, 100),
      type,
      description: `这是${type}类型字段的描述说明`,
      isNullable: this.randomBoolean(),
      isEncrypted: Math.random() > 0.7,
      sampleValue: sampleValues[type],
      constraints: this.randomBoolean() ? {
        min: this.randomInt(0, 10),
        max: this.randomInt(100, 1000)
      } : undefined
    };
  }

  generateSampleData(): SampleData {
    const fields = ['id', 'name', 'value', 'date', 'region', 'status'];
    const recordCount = this.randomInt(1000, 1000000);

    const previewRecords: Record<string, unknown>[] = [];
    for (let i = 0; i < 10; i++) {
      const record: Record<string, unknown> = {};
      fields.forEach((field) => {
        record[field] = this.randomInt(1, 1000);
      });
      previewRecords.push(record);
    }

    return {
      summary: '本数据集包含多维度的统计信息，数据来源于权威机构，经过严格清洗和校验。',
      recordCount,
      fields,
      previewRecords,
      dataQuality: {
        completeness: this.randomFloat(0.9, 1, 4),
        accuracy: this.randomFloat(0.95, 1, 4),
        timeliness: this.randomFloat(0.8, 1, 4),
        uniqueness: this.randomFloat(0.85, 1, 4)
      }
    };
  }

  generateResourceDetail(productId?: string): ResourceDetail {
    const product = this.generateDataProduct({ id: productId || this.generateId('prod') });
    const fields: DataField[] = [];

    for (let i = 0; i < this.randomInt(5, 20); i++) {
      fields.push(this.generateDataField());
    }

    return {
      product,
      fields,
      sampleData: this.generateSampleData(),
      usageGuide: `## 使用说明\n\n1. 申请授权\n2. 获取API密钥\n3. 调用接口\n4. 查看使用统计\n\n## 注意事项\n\n- 请遵守数据使用规范\n- 不得用于非法用途\n- 请妥善保管密钥`,
      apiSpec: this.randomBoolean() ? {
        endpoints: [
          {
            path: '/api/v1/data/query',
            method: 'POST',
            description: '数据查询接口',
            requestParams: {},
            responseSchema: {}
          },
          {
            path: '/api/v1/data/batch',
            method: 'POST',
            description: '批量数据查询',
            requestParams: {},
            responseSchema: {}
          }
        ]
      } : undefined,
      serviceLevel: this.randomBoolean() ? {
        availability: 0.999,
        responseTime: 100,
        supportChannel: ['在线客服', '邮件', '电话']
      } : undefined
    };
  }

  generateRequiredMaterials(): ApplyMaterial[] {
    return [
      {
        name: '营业执照',
        type: 'pdf',
        required: true,
        description: '企业营业执照扫描件，需加盖公章'
      },
      {
        name: '法人身份证',
        type: 'image',
        required: true,
        description: '法人身份证正反面照片'
      },
      {
        name: '使用申请函',
        type: 'pdf',
        required: true,
        description: '加盖公章的数据使用申请函'
      },
      {
        name: '数据安全承诺书',
        type: 'pdf',
        required: true,
        description: '数据安全和保密承诺书'
      },
      {
        name: '经办人授权书',
        type: 'pdf',
        required: false,
        description: '非法人办理时需提供经办人授权书'
      }
    ];
  }

  generateApplyResponse(productId?: string): ApplyResponse {
    return {
      applyId: this.generateId('apply'),
      productId: productId || this.generateId('prod'),
      status: AuditStatus.PENDING,
      submitTime: dayjs().toISOString(),
      estimatedAuditTime: dayjs().add(3, 'day').toISOString()
    };
  }

  generateAuthorization(productId?: string): Authorization {
    const validFrom = dayjs().subtract(this.randomInt(0, 30), 'day');
    const validTo = validFrom.add(this.randomInt(30, 365), 'day');

    return {
      id: this.generateId('auth'),
      applyId: this.generateId('apply'),
      productId: productId || this.generateId('prod'),
      productName: '企业信用信息数据集',
      status: this.randomFromArray(['active', 'active', 'active', 'expired', 'suspended'] as const),
      scope: {
        callLimit: this.randomInt(1000, 100000),
        callCount: this.randomInt(0, 5000),
        ipWhitelist: this.randomBoolean() ? ['192.168.1.1', '10.0.0.0/24'] : undefined,
        dataRange: this.randomBoolean() ? ['北京', '上海', '广东'] : undefined
      },
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      createdAt: validFrom.toISOString()
    };
  }

  generateAuditRecords(): AuditRecord[] {
    const records: AuditRecord[] = [
      {
        id: this.generateId('audit'),
        applyId: this.generateId('apply'),
        status: AuditStatus.PENDING,
        operator: 'system',
        operationTime: dayjs().subtract(2, 'day').toISOString(),
        comment: '申请已提交，等待审核'
      },
      {
        id: this.generateId('audit'),
        applyId: this.generateId('apply'),
        status: AuditStatus.REVIEWING,
        operator: '审核员A',
        operationTime: dayjs().subtract(1, 'day').toISOString(),
        comment: '材料审核通过，进入复核阶段'
      }
    ];

    if (this.randomBoolean()) {
      records.push({
        id: this.generateId('audit'),
        applyId: this.generateId('apply'),
        status: AuditStatus.APPROVED,
        operator: '审核主管',
        operationTime: dayjs().toISOString(),
        comment: '申请已通过，授权已生效'
      });
    }

    return records;
  }

  generateUsageRecord(authorizationId?: string): UsageRecord {
    return {
      id: this.generateId('usage'),
      authorizationId: authorizationId || this.generateId('auth'),
      productId: this.generateId('prod'),
      productName: '企业信用信息数据集',
      callTime: dayjs().subtract(this.randomInt(0, 24 * 7), 'hour').toISOString(),
      endpoint: this.randomFromArray(['/api/v1/data/query', '/api/v1/data/batch', '/api/v1/data/detail']),
      status: this.randomFromArray(['success', 'success', 'success', 'failed'] as const),
      responseTime: this.randomInt(50, 500),
      inputSize: this.randomInt(100, 10000),
      outputSize: this.randomInt(500, 100000),
      errorMessage: Math.random() > 0.9 ? '参数校验失败：缺少必填字段 id' : undefined
    };
  }

  generateUsageStats(): UsageStats {
    const totalCalls = this.randomInt(100, 10000);
    const failedCalls = this.randomInt(0, Math.floor(totalCalls * 0.1));
    const successCalls = totalCalls - failedCalls;

    const details: UsageStats['details'] = [];
    for (let i = 6; i >= 0; i--) {
      const dayCalls = this.randomInt(10, 1000);
      details.push({
        date: dayjs().subtract(i, 'day').format('YYYY-MM-DD'),
        callCount: dayCalls,
        successCount: Math.floor(dayCalls * this.randomFloat(0.9, 1, 2)),
        avgResponseTime: this.randomInt(50, 300)
      });
    }

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate: totalCalls > 0 ? successCalls / totalCalls : 0,
      avgResponseTime: this.randomInt(80, 200),
      totalInputSize: this.randomInt(10000, 1000000),
      totalOutputSize: this.randomInt(100000, 10000000),
      details
    };
  }

  generateChangeNotice(productId?: string): ChangeNotice {
    const types: ChangeNotice['type'][] = ['update', 'deprecation', 'price_change', 'policy_change', 'maintenance'];
    const levels: ChangeNotice['level'][] = ['info', 'warning', 'critical'];
    const type = this.randomFromArray(types);

    const titles: Record<ChangeNotice['type'], string[]> = {
      update: ['功能优化更新', '新增数据字段', '接口版本升级'],
      deprecation: ['旧版接口即将下线', '数据产品即将下架', 'API v1 停止维护通知'],
      price_change: ['服务价格调整通知', '计费模式优化', '新增套餐类型'],
      policy_change: ['用户协议更新', '数据使用规范变更', '安全策略升级'],
      maintenance: ['系统维护通知', '服务升级公告', '数据同步暂停通知']
    };

    return {
      id: this.generateId('notice'),
      productId: productId || this.generateId('prod'),
      productName: '企业信用信息数据集',
      type,
      title: this.randomFromArray(titles[type]),
      content: `这是关于${this.randomFromArray(titles[type])}的详细说明内容。请相关用户注意调整业务逻辑。`,
      level: this.randomFromArray(levels),
      publishTime: dayjs().subtract(this.randomInt(0, 7), 'day').toISOString(),
      effectiveTime: dayjs().add(this.randomInt(1, 30), 'day').toISOString()
    };
  }

  generateCitationInfo(productId?: string): CitationInfo {
    const productName = '全国企业信用信息数据集';
    const provider = '国家数据局';
    const version = 'v2.1.0';
    const accessDate = dayjs().format('YYYY-MM-DD');
    const sourceUrl = `https://data.example.com/dataset/${productId || 'prod-000001'}`;

    return {
      productId: productId || this.generateId('prod'),
      productName,
      provider,
      version,
      accessDate,
      sourceUrl,
      citationText: `${provider}. (${dayjs().format('YYYY')}). ${productName} [Data set]. ${sourceUrl}. Accessed ${accessDate}.`,
      formats: {
        apa: `${provider}. (${dayjs().format('YYYY')}). ${productName} [Data set]. ${sourceUrl}. Accessed ${accessDate}.`,
        gb: `${provider}. ${productName}[DB/OL]. ${sourceUrl}. (${dayjs().format('YYYY-MM-DD')})[${accessDate}].`,
        bibtex: `@misc{dataset_${productId || 'prod001'},\n  author       = {${provider}},\n  title        = {${productName}},\n  howpublished = {${sourceUrl}},\n  year         = {${dayjs().format('YYYY')}},\n  note         = {Accessed: ${accessDate}},\n  version      = {${version}}\n}`
      }
    };
  }

  generateExpireReminder(): ExpireReminder {
    const daysRemaining = this.randomInt(1, 30);
    return {
      authorizationId: this.generateId('auth'),
      productId: this.generateId('prod'),
      productName: '企业信用信息数据集',
      daysRemaining,
      validTo: dayjs().add(daysRemaining, 'day').toISOString(),
      callCount: this.randomInt(0, 10000),
      callLimit: this.randomInt(1000, 100000)
    };
  }
}

export const mockDataGenerator = new MockDataGenerator();
