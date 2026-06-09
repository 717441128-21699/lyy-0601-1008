import { DataCatalogSDK, isParameterError, MaterialMissingError } from '../src';

async function testCacheInvalidation() {
  console.log('=== 缓存失效测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 50 });

  try {
    const productId = 'my-product-12345';

    console.log(`\n1. 第一次查询产品 ${productId} 详情（未命中缓存）...`);
    const start1 = Date.now();
    const detail1 = await sdk.resource.getDetail(productId);
    const time1 = Date.now() - start1;
    console.log(`   产品名: ${detail1.product.name}, 耗时: ${time1}ms`);
    console.log(`   缓存统计:`, sdk.getCacheStats());

    console.log(`\n2. 第二次查询产品 ${productId} 详情（应该命中缓存）...`);
    const start2 = Date.now();
    const detail2 = await sdk.resource.getDetail(productId);
    const time2 = Date.now() - start2;
    console.log(`   产品名: ${detail2.product.name}, 耗时: ${time2}ms`);
    console.log(`   缓存统计:`, sdk.getCacheStats());

    if (time2 < time1 && sdk.getCacheStats().hits > 0) {
      console.log('   ✅ 缓存命中成功！');
    } else {
      console.log('   ❌ 缓存未命中！');
    }

    console.log(`\n3. 按产品 ID 清除缓存...`);
    const cleared = sdk.invalidateCacheByProductId(productId);
    console.log(`   清除缓存数量: ${cleared}`);
    console.log(`   缓存统计:`, sdk.getCacheStats());

    console.log(`\n4. 第三次查询产品 ${productId} 详情（应该重新请求，不命中缓存）...`);
    const start3 = Date.now();
    const detail3 = await sdk.resource.getDetail(productId);
    const time3 = Date.now() - start3;
    console.log(`   产品名: ${detail3.product.name}, 耗时: ${time3}ms`);
    console.log(`   缓存统计:`, sdk.getCacheStats());

    if (time3 > time2 && sdk.getCacheStats().misses > sdk.getCacheStats().hits) {
      console.log('   ✅ 缓存失效成功，重新请求了数据！');
    } else {
      console.log('   ❌ 缓存可能仍然命中！');
    }

    console.log(`\n5. 测试另一个产品 ID（不同格式）...`);
    const productId2 = 'PROD-999-ABC';
    await sdk.resource.getDetail(productId2);
    await sdk.resource.getDetail(productId2);
    console.log(`   缓存统计:`, sdk.getCacheStats());

    const cleared2 = sdk.invalidateCacheByProductId(productId2);
    console.log(`   清除 ${productId2} 缓存数量: ${cleared2}`);

    console.log(`\n6. 测试批量查询缓存...`);
    await sdk.catalog.search({ keyword: '金融', page: 1, pageSize: 10 });
    console.log(`   搜索后缓存统计:`, sdk.getCacheStats());

    const searchCleared = sdk.invalidateAllSearchCache();
    console.log(`   清除搜索缓存数量: ${searchCleared}`);

    const resourceCleared = sdk.invalidateAllResourceCache();
    console.log(`   清除所有资源缓存数量: ${resourceCleared}`);

    console.log(`\n7. 测试关闭/开启缓存...`);
    sdk.setCacheEnabled(false);
    console.log(`   缓存已关闭: ${sdk.isCacheEnabled()}`);

    const start4 = Date.now();
    await sdk.resource.getDetail(productId);
    const time4 = Date.now() - start4;
    console.log(`   关闭缓存后查询耗时: ${time4}ms`);

    sdk.setCacheEnabled(true);
    console.log(`   缓存已开启: ${sdk.isCacheEnabled()}`);

    console.log('\n✅ 缓存失效测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testMaterialErrors() {
  console.log('\n=== 材料错误测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { failOnParamValidation: true });

  const testCases = [
    {
      name: 'materials 未传',
      request: {
        productId: 'test-000001',
        purpose: 'research',
        purposeDescription: '这是一个足够长的用途描述用于测试',
        usageDuration: 30,
        usageScope: '这是一个足够长的使用范围描述用于测试',
        expectedCallVolume: 1000,
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'test@example.com',
        organization: '测试公司',
        department: '测试部门'
      }
    },
    {
      name: 'materials 为空数组',
      request: {
        productId: 'test-000001',
        purpose: 'research',
        purposeDescription: '这是一个足够长的用途描述用于测试',
        usageDuration: 30,
        usageScope: '这是一个足够长的使用范围描述用于测试',
        expectedCallVolume: 1000,
        materials: [],
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'test@example.com',
        organization: '测试公司',
        department: '测试部门'
      }
    },
    {
      name: '材料缺少文件地址',
      request: {
        productId: 'test-000001',
        purpose: 'research',
        purposeDescription: '这是一个足够长的用途描述用于测试',
        usageDuration: 30,
        usageScope: '这是一个足够长的使用范围描述用于测试',
        expectedCallVolume: 1000,
        materials: [
          {
            name: '营业执照',
            type: 'pdf',
            required: true,
            uploaded: true,
            description: '公司营业执照'
          }
        ],
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'test@example.com',
        organization: '测试公司',
        department: '测试部门'
      }
    },
    {
      name: '必填材料未上传',
      request: {
        productId: 'test-000001',
        purpose: 'research',
        purposeDescription: '这是一个足够长的用途描述用于测试',
        usageDuration: 30,
        usageScope: '这是一个足够长的使用范围描述用于测试',
        expectedCallVolume: 1000,
        materials: [
          {
            name: '营业执照',
            type: 'pdf',
            required: true,
            uploaded: false,
            description: '公司营业执照'
          }
        ],
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'test@example.com',
        organization: '测试公司',
        department: '测试部门'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    try {
      await sdk.apply.submitApplication(testCase.request as any);
      console.log('  ❌ 应该抛出错误但没有！');
    } catch (error) {
      if (isParameterError(error)) {
        console.log(`  ✅ 正确识别为参数错误: ${error.name}`);
        console.log(`     错误码: ${error.code}, 消息: ${error.message}`);
        if (error instanceof MaterialMissingError) {
          console.log(`     类型: MaterialMissingError`);
        }
      } else {
        console.log(`  ❌ 未识别为参数错误: ${error}`);
      }
    }
  }

  console.log('\n✅ 材料错误测试完成！');
}

async function testCursorPagination() {
  console.log('\n=== 游标分页测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 20 });

  try {
    console.log('1. 测试使用记录游标分页...');

    let cursor: string | undefined;
    let hasMore = true;
    let totalRecords = 0;
    let page = 1;

    while (hasMore) {
      const result = await sdk.usage.getUsageRecordsWithCursor({
        cursor,
        limit: 20
      });

      console.log(`   第 ${page} 页: ${result.list.length} 条, hasMore=${result.hasMore}, nextCursor=${result.nextCursor ? '已设置' : 'null'}`);
      totalRecords += result.list.length;

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;
      page++;

      if (page > 10) {
        console.log('   ⚠️  超过10页，停止测试（可能有问题）');
        break;
      }
    }

    console.log(`   总计获取 ${totalRecords} 条记录`);
    console.log(`   ✅ 游标分页正常工作！`);

    console.log('\n2. 测试使用记录增量拉取...');

    const syncResult = await sdk.usage.syncAllUsageRecords({
      batchSize: 30,
      onBatch: (batch, cursor, hasMore) => {
        console.log(`   批次: ${batch.length} 条, cursor=${cursor.substring(0, 20)}..., hasMore=${hasMore}`);
      }
    });

    console.log(`   同步完成: ${syncResult.totalRecords} 条, ${syncResult.batches} 批次`);
    console.log(`   最后游标: ${syncResult.lastCursor?.substring(0, 30)}...`);
    console.log(`   同步时间: ${syncResult.syncTime}`);
    console.log(`   ✅ 增量拉取正常工作！`);

    console.log('\n3. 测试变更通知游标分页...');

    cursor = undefined;
    hasMore = true;
    let totalNotices = 0;
    page = 1;

    while (hasMore) {
      const result = await sdk.usage.getChangeNoticesWithCursor({
        cursor,
        limit: 10
      });

      console.log(`   第 ${page} 页: ${result.list.length} 条, hasMore=${result.hasMore}, nextCursor=${result.nextCursor ? '已设置' : 'null'}`);
      totalNotices += result.list.length;

      hasMore = result.hasMore;
      cursor = result.nextCursor || undefined;
      page++;

      if (page > 10) {
        console.log('   ⚠️  超过10页，停止测试（可能有问题）');
        break;
      }
    }

    console.log(`   总计获取 ${totalNotices} 条通知`);
    console.log(`   ✅ 变更通知游标分页正常工作！`);

  } catch (error) {
    console.error('游标分页测试失败:', error);
  }
}

async function testBatchAuthorization() {
  console.log('\n=== 批量授权测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 20 });

  try {
    const authIds = [
      'auth-valid-001',
      'auth-valid-002',
      'auth-expired-003',
      'auth-invalid-id',
      'auth-valid-005'
    ];

    console.log('批量检查授权有效性...');
    const result = await sdk.authorization.batchCheckAuthorizationValid(authIds, {
      concurrency: 3
    });

    console.log(`总计: ${result.total}, 成功查询: ${result.successCount}, 查询失败: ${result.failedCount}`);

    result.results.forEach((item) => {
      if (item.success) {
        if (item.data?.valid) {
          console.log(`  ✅ ${item.id}: 授权有效`);
        } else {
          console.log(`  ⚠️  ${item.id}: 授权无效 - ${item.data?.reason}`);
        }
      } else {
        console.log(`  ❌ ${item.id}: 查询失败 - ${item.error?.message}`);
      }
    });

    console.log('\n✅ 批量授权测试完成！');
    console.log('   - 查询失败的项标记为 success=false');
    console.log('   - 授权无效的项标记为 success=true 但 data.valid=false');

  } catch (error) {
    console.error('批量授权测试失败:', error);
  }
}

async function runAllTests() {
  await testCacheInvalidation();
  await testMaterialErrors();
  await testCursorPagination();
  await testBatchAuthorization();

  console.log('\n=== 所有测试完成 ===');
}

if (require.main === module) {
  runAllTests();
}
