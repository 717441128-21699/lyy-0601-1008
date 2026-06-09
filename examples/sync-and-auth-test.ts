import {
  DataCatalogSDK,
  SyncCheckpoint,
  isParameterError
} from '../src';

async function testCheckpointPersistence() {
  console.log('=== 同步检查点持久化测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 20 });

  try {
    console.log('\n1. 首次同步使用记录，保存检查点...');

    let savedCheckpoint: SyncCheckpoint | null = null;

    const result1 = await sdk.usage.syncUsageRecordsWithCheckpoint({
      batchSize: 20,
      maxBatches: 3,
      onBatch: (batch, checkpoint, hasMore) => {
        console.log(`   批次: ${batch.length} 条, 游标: ${checkpoint.cursor?.substring(0, 20)}..., hasMore: ${hasMore}`);
        savedCheckpoint = checkpoint;
      }
    });

    console.log(`   同步完成: ${result1.updatedCount} 条, ${result1.checkpoint.batchCount} 批次`);
    console.log(`   检查点 cursor: ${result1.checkpoint.cursor?.substring(0, 30)}...`);
    console.log(`   检查点 lastSyncTime: ${result1.checkpoint.lastSyncTime}`);
    console.log(`   检查点 totalSynced: ${result1.checkpoint.totalSynced}`);

    console.log('\n2. 模拟程序重启，从检查点恢复同步...');

    const checkpointToRestore: SyncCheckpoint = savedCheckpoint as unknown as SyncCheckpoint;
    console.log(`   从检查点恢复: cursor=${checkpointToRestore.cursor?.substring(0, 30)}..., totalSynced=${checkpointToRestore.totalSynced}`);

    const result2 = await sdk.usage.syncUsageRecordsWithCheckpoint({
      batchSize: 20,
      maxBatches: 5,
      checkpoint: checkpointToRestore,
      onBatch: (batch, checkpoint, hasMore) => {
        console.log(`   恢复批次: ${batch.length} 条, 累计: ${checkpoint.totalSynced} 条, hasMore: ${hasMore}`);
        savedCheckpoint = checkpoint;
      }
    });

    console.log(`   恢复同步完成: 累计 ${result2.checkpoint.totalSynced} 条`);
    console.log(`   最终检查点: cursor=${result2.checkpoint.cursor?.substring(0, 30)}...`);

    console.log('\n3. 测试检查点持久化（模拟保存到数据库）...');

    const checkpointToSave = result1.checkpoint;
    const checkpointJson = JSON.stringify(checkpointToSave, null, 2);
    console.log(`   检查点 JSON (可持久化):`);
    console.log(`   ${checkpointJson.substring(0, 300)}...`);

    const restoredCheckpoint: SyncCheckpoint = JSON.parse(checkpointJson);
    console.log(`   反序列化成功: syncType=${restoredCheckpoint.syncType}, totalSynced=${restoredCheckpoint.totalSynced}`);

    console.log('\n✅ 同步检查点测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testChangeNoticeCacheInvalidation() {
  console.log('\n=== 变更通知缓存精确失效测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 20 });

  try {
    const productId1 = 'product-001';
    const productId2 = 'product-002';

    console.log(`\n1. 查询两个产品的详情，缓存数据...`);

    const detail1a = await sdk.resource.getDetail(productId1);
    const detail2a = await sdk.resource.getDetail(productId2);
    console.log(`   ${productId1}: ${detail1a.product.name}`);
    console.log(`   ${productId2}: ${detail2a.product.name}`);
    console.log(`   缓存统计: ${JSON.stringify(sdk.getCacheStats())}`);

    console.log(`\n2. 拉取 ${productId1} 的变更通知，应该只失效该产品的缓存...`);

    const noticeResult = await sdk.usage.syncChangeNoticesWithCheckpoint({
      productId: productId1,
      batchSize: 10,
      invalidateCache: true,
      onBatch: (batch, checkpoint) => {
        console.log(`   收到 ${batch.length} 条 ${productId1} 的变更通知`);
        batch.forEach((n, i) => {
          if (i < 5) console.log(`     - [${n.level}] ${n.title}`);
        });
      }
    });

    console.log(`   变更通知处理完成`);
    console.log(`   缓存统计: ${JSON.stringify(sdk.getCacheStats())}`);

    console.log(`\n3. 再次查询两个产品详情...`);

    const start1 = Date.now();
    const detail1b = await sdk.resource.getDetail(productId1);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const detail2b = await sdk.resource.getDetail(productId2);
    const time2 = Date.now() - start2;

    console.log(`   ${productId1}: ${detail1b.product.name}, 耗时: ${time1}ms (应该重新请求)`);
    console.log(`   ${productId2}: ${detail2b.product.name}, 耗时: ${time2}ms (应该命中缓存)`);

    if (time1 > 10 && time2 < 10) {
      console.log('   ✅ 缓存精确失效：product-001 重新请求，product-002 命中缓存');
    } else {
      console.log('   ⚠️  缓存失效可能不正确');
    }

    console.log('\n✅ 变更通知缓存精确失效测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testDetailedBatchAuthorization() {
  console.log('\n=== 批量授权详细结果测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 20 });

  try {
    const authIds = [
      'auth-valid-001',
      'auth-expired-002',
      'auth-suspended-003',
      'auth-calls-exhausted-004',
      'auth-revoked-005',
      'auth-pending-006',
      'auth-network-error-007',
      'auth-platform-error-008'
    ];

    console.log('批量检查授权有效性...');
    const result = await sdk.authorization.batchCheckAuthorizationValid(authIds, {
      concurrency: 4
    });

    console.log(`\n总计: ${result.total}, 成功查询: ${result.successCount}, 查询失败: ${result.failedCount}`);

    console.log('\n查询状态汇总:');
    console.log(`  ✅ 成功: ${result.summary.success}`);
    console.log(`  🌐 网络错误: ${result.summary.networkError}`);
    console.log(`  🏢 平台错误: ${result.summary.platformError}`);
    console.log(`  📝 参数错误: ${result.summary.invalidRequest}`);
    console.log(`  ⏱️  超时: ${result.summary.timeout}`);
    console.log(`  ❓ 未知错误: ${result.summary.unknownError}`);

    if (result.authorizationSummary) {
      console.log('\n授权状态汇总:');
      console.log(`  ✅ 有效: ${result.authorizationSummary.valid}`);
      console.log(`  ⏰ 已过期: ${result.authorizationSummary.expired}`);
      console.log(`  📊 次数用尽: ${result.authorizationSummary.callsExhausted}`);
      console.log(`  ⏸️  已暂停: ${result.authorizationSummary.suspended}`);
      console.log(`  🚫 已撤销: ${result.authorizationSummary.revoked}`);
      console.log(`  📋 待审核: ${result.authorizationSummary.pending}`);
      console.log(`  ❌ 已拒绝: ${result.authorizationSummary.rejected}`);
      console.log(`  📴 已取消: ${result.authorizationSummary.cancelled}`);
      console.log(`  🔍 未找到: ${result.authorizationSummary.notFound}`);
      console.log(`  ❓ 未知: ${result.authorizationSummary.unknown}`);
    }

    console.log('\n详细结果:');
    result.results.forEach((item) => {
      if (item.status === 'success') {
        if (item.data?.valid) {
          console.log(`  ✅ ${item.id}: 授权有效`);
        } else {
          console.log(`  ⚠️  ${item.id}: 授权无效 - ${item.data?.reasonMessage}`);
        }
      } else {
        console.log(`  ❌ ${item.id}: 查询失败 [${item.status}] - ${item.error?.message}`);
      }
    });

    console.log('\n✅ 批量授权详细结果测试完成！');

  } catch (error) {
    if (isParameterError(error)) {
      console.error('参数错误:', error.message);
    } else {
      console.error('测试失败:', error);
    }
  }
}

async function testIncrementalSyncResume() {
  console.log('\n=== 增量同步断点续传测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 10 });

  try {
    console.log('\n1. 第一次全量同步...');

    let checkpoint: SyncCheckpoint | null = null;
    const sync1 = await sdk.usage.syncUsageRecordsWithCheckpoint({
      batchSize: 30,
      maxBatches: 2,
      onBatch: (batch, cp) => {
        console.log(`   同步 ${batch.length} 条, 累计 ${cp.totalSynced} 条`);
        checkpoint = cp;
      }
    });

    console.log(`   第一次同步完成: ${sync1.updatedCount} 条, 游标: ${sync1.checkpoint.cursor?.substring(0, 20)}...`);

    console.log('\n2. 模拟中断后从上次位置继续...');

    const resumeCheckpoint: SyncCheckpoint = checkpoint as unknown as SyncCheckpoint;
    const sync2 = await sdk.usage.syncUsageRecordsWithCheckpoint({
      batchSize: 30,
      checkpoint: resumeCheckpoint,
      onBatch: (batch, cp) => {
        console.log(`   继续同步 ${batch.length} 条, 累计 ${cp.totalSynced} 条`);
        checkpoint = cp;
      }
    });

    console.log(`   第二次同步完成: 累计 ${sync2.checkpoint.totalSynced} 条`);

    console.log('\n3. 保存最后检查点到"数据库"...');
    const dbCheckpoint = { ...sync2.checkpoint };
    console.log(`   保存成功: syncTime=${dbCheckpoint.lastBatchTime}, cursor=${dbCheckpoint.cursor?.substring(0, 20)}...`);

    console.log('\n4. 下次启动时从"数据库"恢复...');
    const sync3 = await sdk.usage.syncUsageRecordsWithCheckpoint({
      batchSize: 30,
      checkpoint: dbCheckpoint,
      onBatch: (batch, cp) => {
        console.log(`   恢复同步 ${batch.length} 条, 累计 ${cp.totalSynced} 条`);
      }
    });

    console.log(`   恢复同步完成: 累计 ${sync3.checkpoint.totalSynced} 条, hasMore=${sync3.hasMore}`);

    if (!sync3.hasMore) {
      console.log('   ✅ 全部数据同步完成！');
    }

    console.log('\n✅ 增量同步断点续传测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function runAllTests() {
  await testCheckpointPersistence();
  await testChangeNoticeCacheInvalidation();
  await testDetailedBatchAuthorization();
  await testIncrementalSyncResume();

  console.log('\n=== 所有测试完成 ===');
}

if (require.main === module) {
  runAllTests();
}
