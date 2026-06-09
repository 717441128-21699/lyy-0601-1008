import {
  DataCatalogSDK,
  DataCatalogSDKOptions,
  MockRequestAdapter,
  MemoryCache,
  isParameterError,
  ParameterMissingError,
  MaterialMissingError,
  Industry,
  Region,
  UpdateCycle,
  ApplyPurpose,
  BatchResponse,
  ResourceDetail,
  Authorization
} from '../src';

async function mockModeExample() {
  console.log('=== Mock 模式示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, {
    delay: 200,
    failureRate: 0,
    failOnParamValidation: true
  });

  try {
    const searchResult = await sdk.catalog.search({
      keyword: '金融',
      industry: Industry.FINANCE,
      page: 1,
      pageSize: 10
    });
    console.log('搜索结果:', searchResult.total, '条');

    if (searchResult.list.length > 0) {
      const productId = searchResult.list[0].id;
      const detail = await sdk.resource.getDetail(productId);
      console.log('资源详情:', detail.product.name);
    }
  } catch (error) {
    console.error('Mock 模式错误:', error);
  }
}

async function customAdapterExample() {
  console.log('\n=== 自定义适配器示例 ===');

  const customAdapter: DataCatalogSDKOptions['adapter'] = {
    request: async (options) => {
      console.log('自定义请求:', options.method, options.url);
      return {
        code: 0,
        message: 'success',
        data: {} as never,
        traceId: 'custom-' + Date.now(),
        timestamp: Date.now()
      };
    },
    get: async (url) => {
      console.log('自定义 GET:', url);
      return {
        code: 0,
        message: 'success',
        data: {} as never,
        traceId: 'custom-' + Date.now(),
        timestamp: Date.now()
      };
    },
    post: async (url) => {
      console.log('自定义 POST:', url);
      return {
        code: 0,
        message: 'success',
        data: {} as never,
        traceId: 'custom-' + Date.now(),
        timestamp: Date.now()
      };
    },
    put: async (url) => {
      console.log('自定义 PUT:', url);
      return {
        code: 0,
        message: 'success',
        data: {} as never,
        traceId: 'custom-' + Date.now(),
        timestamp: Date.now()
      };
    },
    delete: async (url) => {
      console.log('自定义 DELETE:', url);
      return {
        code: 0,
        message: 'success',
        data: {} as never,
        traceId: 'custom-' + Date.now(),
        timestamp: Date.now()
      };
    }
  };

  const sdk = new DataCatalogSDK({
    baseUrl: 'https://api.example.com',
    appKey: 'your-app-key',
    appSecret: 'your-app-secret'
  }, {
    adapter: customAdapter
  });

  try {
    await sdk.catalog.search({ keyword: 'test' });
  } catch (error) {
    console.error('自定义适配器错误:', error);
  }
}

async function cacheExample() {
  console.log('\n=== 缓存功能示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 100 });

  try {
    const productId = 'finance-000001';

    console.log('第一次请求（未命中缓存）...');
    const start1 = Date.now();
    const detail1 = await sdk.resource.getDetail(productId);
    console.log(`耗时: ${Date.now() - start1}ms`);

    console.log('第二次请求（命中缓存）...');
    const start2 = Date.now();
    const detail2 = await sdk.resource.getDetail(productId);
    console.log(`耗时: ${Date.now() - start2}ms`);

    console.log('缓存状态:', sdk.getCacheStats());

    console.log('跳过缓存请求...');
    const start3 = Date.now();
    const detail3 = await sdk.client.get<typeof detail1>(
      `/api/v1/resources/${productId}/detail`,
      undefined,
      { skipCache: true }
    );
    console.log(`耗时: ${Date.now() - start3}ms`);

    console.log('按产品ID清除缓存...');
    const cleared = sdk.invalidateCacheByProductId(productId);
    console.log('清除缓存数量:', cleared);

    console.log('关闭全局缓存...');
    sdk.setCacheEnabled(false);
    console.log('缓存状态:', sdk.isCacheEnabled());

    console.log('重新开启缓存...');
    sdk.setCacheEnabled(true);

    console.log('清除所有搜索缓存...');
    const searchCleared = sdk.invalidateAllSearchCache();
    console.log('清除搜索缓存数量:', searchCleared);

  } catch (error) {
    console.error('缓存功能错误:', error);
  }
}

async function customCacheExample() {
  console.log('\n=== 自定义缓存示例 ===');

  const customCache = new MemoryCache({
    defaultTTL: 10 * 60 * 1000,
    maxEntries: 500,
    enabled: true
  });

  const sdk = new DataCatalogSDK({
    baseUrl: 'https://api.example.com',
    appKey: 'your-app-key',
    appSecret: 'your-app-secret'
  }, {
    enableMock: true,
    cache: customCache,
    cacheConfig: {
      enabled: true,
      defaultTTL: 10 * 60 * 1000,
      maxEntries: 500
    }
  });

  try {
    await sdk.resource.getDetail('finance-000001');
    await sdk.resource.getDetail('finance-000002');

    console.log('自定义缓存统计:', sdk.getCacheStats());
  } catch (error) {
    console.error('自定义缓存错误:', error);
  }
}

async function parameterErrorExample() {
  console.log('\n=== 统一参数错误处理示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, {
    failOnParamValidation: true
  });

  try {
    await sdk.resource.getDetail('');
  } catch (error) {
    if (isParameterError(error)) {
      console.log('✅ 识别为参数错误:', error.name);
      console.log('   错误码:', error.code);
      console.log('   错误信息:', error.message);
    } else {
      console.log('❌ 未识别为参数错误:', error);
    }
  }

  try {
    await sdk.apply.submitApplication({
      productId: 'finance-000001',
      purpose: ApplyPurpose.RESEARCH,
      purposeDescription: '这是一个测试用途描述，长度足够',
      usageDuration: 30,
      usageScope: '这是使用范围描述，长度足够',
      expectedCallVolume: 1000,
      materials: [],
      contactName: '张三',
      contactPhone: '13800138000',
      contactEmail: 'test@example.com',
      organization: '测试公司',
      department: '测试部门'
    });
  } catch (error) {
    if (error instanceof MaterialMissingError) {
      console.log('✅ 识别为材料缺失错误:', error.name);
      console.log('   缺失材料:', error.message);
      console.log('   错误码:', error.code);
    } else if (isParameterError(error)) {
      console.log('✅ 识别为参数错误:', error.name);
      console.log('   错误码:', error.code);
    } else {
      console.log('❌ 其他错误:', error);
    }
  }

  try {
    await sdk.apply.submitApplication({
      productId: '',
      purpose: ApplyPurpose.RESEARCH,
      purposeDescription: 'test',
      usageDuration: 30,
      usageScope: 'test',
      expectedCallVolume: 1000,
      materials: [],
      contactName: '',
      contactPhone: '123',
      contactEmail: 'invalid-email',
      organization: '',
      department: ''
    });
  } catch (error) {
    if (error instanceof ParameterMissingError) {
      console.log('✅ 识别为参数缺失错误:', error.name);
      console.log('   缺失参数:', error.message);
    } else if (isParameterError(error)) {
      console.log('✅ 识别为参数错误:', error.name);
      console.log('   错误信息:', error.message);
    } else {
      console.log('❌ 其他错误:', error);
    }
  }
}

async function batchQueryExample() {
  console.log('\n=== 批量查询示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 50 });

  try {
    const productIds = [
      'finance-000001',
      'finance-000002',
      'finance-000003',
      'invalid-id',
      'finance-000005'
    ];

    console.log('批量查询资源详情...');
    const batchResult = await sdk.resource.batchGetDetails(productIds, {
      concurrency: 3
    });

    console.log(`总计: ${batchResult.total}, 成功: ${batchResult.successCount}, 失败: ${batchResult.failedCount}`);

    batchResult.results.forEach((result) => {
      if (result.success) {
        console.log(`✅ ${result.id}: ${result.data?.product.name}`);
      } else {
        console.log(`❌ ${result.id}: ${result.error?.message} (code: ${result.error?.code})`);
      }
    });

    const successItems = batchResult.results.filter(r => r.success);
    const failedItems = batchResult.results.filter(r => !r.success);

    console.log(`成功获取 ${successItems.length} 个资源详情`);
    console.log(`失败 ${failedItems.length} 个资源`);

    console.log('\n批量查询授权有效性...');
    const authIds = [
      'auth-001',
      'auth-002',
      'auth-003',
      'invalid-auth',
      'auth-005'
    ];

    const authBatchResult = await sdk.authorization.batchCheckAuthorizationValid(authIds, {
      concurrency: 5
    });

    console.log(`总计: ${authBatchResult.total}, 成功: ${authBatchResult.successCount}, 失败: ${authBatchResult.failedCount}`);

    authBatchResult.results.forEach((result) => {
      if (result.success) {
        console.log(`✅ ${result.id}: valid=${result.data?.valid}`);
      } else {
        console.log(`❌ ${result.id}: ${result.error?.message}`);
      }
    });

  } catch (error) {
    console.error('批量查询错误:', error);
  }
}

async function cursorPaginationExample() {
  console.log('\n=== 游标分页示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 50 });

  try {
    console.log('游标分页查询使用记录...');

    let cursor: string | undefined;
    let hasMore = true;
    let page = 1;

    while (hasMore) {
      const result = await sdk.usage.getUsageRecordsWithCursor({
        cursor,
        limit: 10,
        productId: 'finance-000001'
      });

      console.log(`第 ${page} 页: ${result.list.length} 条记录, hasMore=${result.hasMore}, nextCursor=${result.nextCursor}`);

      result.list.forEach((record, index) => {
        console.log(`  ${(page - 1) * 10 + index + 1}. ${record.id} - ${record.callTime}`);
      });

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;
      page++;

      if (page > 3) break;
    }

    console.log('\n游标分页查询变更通知...');

    cursor = undefined;
    hasMore = true;
    page = 1;

    while (hasMore) {
      const result = await sdk.usage.getChangeNoticesWithCursor({
        cursor,
        limit: 5,
        level: 'info'
      });

      console.log(`第 ${page} 页: ${result.list.length} 条通知, hasMore=${result.hasMore}`);

      result.list.forEach((notice) => {
        console.log(`  - ${notice.title} (${notice.type})`);
      });

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;
      page++;

      if (page > 3) break;
    }

  } catch (error) {
    console.error('游标分页错误:', error);
  }
}

async function incrementalPullExample() {
  console.log('\n=== 增量拉取示例 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 50 });

  try {
    let lastSyncTime: string | undefined;
    let lastCursor: string | undefined;

    console.log('首次全量同步使用记录...');
    const firstSync = await sdk.usage.syncAllUsageRecords({
      productId: 'finance-000001',
      batchSize: 20,
      onBatch: (batch, cursor, hasMore) => {
        console.log(`  处理批次: ${batch.length} 条, cursor=${cursor}, hasMore=${hasMore}`);
      }
    });

    console.log(`首次同步完成: ${firstSync.totalRecords} 条记录, ${firstSync.batches} 批次`);
    lastSyncTime = firstSync.syncTime;
    lastCursor = firstSync.lastCursor;

    console.log('\n等待模拟数据更新...');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('增量同步使用记录（从上次位置继续）...');
    const incrementalSync = await sdk.usage.syncAllUsageRecords({
      productId: 'finance-000001',
      lastSyncTime,
      batchSize: 20,
      onBatch: (batch, cursor, hasMore) => {
        console.log(`  处理增量批次: ${batch.length} 条`);
      }
    });

    console.log(`增量同步完成: ${incrementalSync.totalRecords} 条新记录`);

    console.log('\n增量拉取变更通知并自动失效缓存...');
    const noticeSync = await sdk.usage.syncAllChangeNotices({
      level: 'warning',
      lastSyncTime,
      batchSize: 10,
      onBatch: (batch) => {
        console.log(`  处理通知批次: ${batch.length} 条`);
        batch.forEach(notice => {
          console.log(`    - [${notice.level}] ${notice.title}`);
        });
      }
    });

    console.log(`通知同步完成: ${noticeSync.totalNotices} 条通知`);
    console.log('相关资源缓存已自动失效');

  } catch (error) {
    console.error('增量拉取错误:', error);
  }
}

async function comprehensiveExample() {
  console.log('\n=== 综合使用示例 ===');

  const sdk = DataCatalogSDK.createMockSDK(
    { debug: true },
    { delay: 50, failOnParamValidation: true }
  );

  try {
    console.log('1. 搜索数据产品...');
    const searchResult = await sdk.catalog.search({
      keyword: '金融',
      industry: Industry.FINANCE,
      region: Region.BEIJING,
      updateCycle: UpdateCycle.DAILY,
      tags: ['脱敏', '结构化'],
      page: 1,
      pageSize: 5
    });

    console.log(`找到 ${searchResult.total} 个产品`);

    if (searchResult.list.length === 0) {
      console.log('没有找到产品，退出示例');
      return;
    }

    const productIds = searchResult.list.slice(0, 3).map(p => p.id);

    console.log('\n2. 批量获取产品详情...');
    const details = await sdk.resource.batchGetDetails(productIds);

    const validProducts = details.results
      .filter(r => r.success && r.data)
      .map(r => ({
        id: r.id,
        name: r.data!.product.name,
        fields: r.data!.fields.length
      }));

    console.log('有效产品:', validProducts);

    console.log('\n3. 申请使用第一个产品...');
    const firstProduct = validProducts[0];

    if (firstProduct) {
      try {
        const applyResult = await sdk.apply.submitApplication({
          productId: firstProduct.id,
          purpose: ApplyPurpose.RESEARCH,
          purposeDescription: '本项目旨在研究金融数据的应用场景，通过分析历史数据建立预测模型，为业务决策提供数据支持。',
          usageDuration: 180,
          usageScope: '仅限于本公司内部的数据分析和模型训练使用，不得对外提供或用于其他商业目的。',
          expectedCallVolume: 10000,
          materials: [
            {
              name: '营业执照',
              type: 'pdf',
              required: true,
              description: '公司营业执照',
              uploaded: true,
              fileUrl: 'https://example.com/license.pdf'
            },
            {
              name: '项目说明',
              type: 'doc',
              required: true,
              description: '详细项目说明文档',
              uploaded: true,
              fileUrl: 'https://example.com/project.docx'
            }
          ],
          contactName: '张三',
          contactPhone: '13800138000',
          contactEmail: 'zhangsan@example.com',
          organization: '科技创新有限公司',
          department: '数据研发部'
        });

        console.log('申请提交成功:', applyResult.applyId);

      } catch (error) {
        if (isParameterError(error)) {
          console.log('申请参数错误，请修正后重试:', error.message);
        } else {
          throw error;
        }
      }
    }

    console.log('\n4. 同步使用记录...');
    let lastSyncTime: string | undefined;
    const usageSync = await sdk.usage.syncAllUsageRecords({
      batchSize: 50,
      lastSyncTime,
      onBatch: (batch) => {
        console.log(`同步 ${batch.length} 条使用记录...`);
      }
    });
    console.log(`使用记录同步完成: ${usageSync.totalRecords} 条`);

    console.log('\n5. 查看缓存统计...');
    const cacheStats = sdk.getCacheStats();
    console.log('缓存大小:', cacheStats.size);
    console.log('命中次数:', cacheStats.hits);
    console.log('未命中次数:', cacheStats.misses);
    console.log('命中率:', (cacheStats.hitRate * 100).toFixed(2) + '%');

  } catch (error) {
    if (isParameterError(error)) {
      console.error('参数错误:', error.message);
    } else {
      console.error('综合示例错误:', error);
    }
  }
}

async function runAllExamples() {
  try {
    await mockModeExample();
    await customAdapterExample();
    await cacheExample();
    await customCacheExample();
    await parameterErrorExample();
    await batchQueryExample();
    await cursorPaginationExample();
    await incrementalPullExample();
    await comprehensiveExample();

    console.log('\n=== 所有示例执行完成 ===');
  } catch (error) {
    console.error('示例执行出错:', error);
  }
}

if (require.main === module) {
  runAllExamples();
}

export {
  mockModeExample,
  customAdapterExample,
  cacheExample,
  customCacheExample,
  parameterErrorExample,
  batchQueryExample,
  cursorPaginationExample,
  incrementalPullExample,
  comprehensiveExample
};
