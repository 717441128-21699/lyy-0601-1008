import {
  DataCatalogSDK,
  SyncTaskState,
  SyncCheckpoint,
  DEFAULT_RETRY_POLICY,
  isParameterError
} from '../src';

async function testSyncTaskStatus() {
  console.log('=== 同步任务状态查询测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 10 });

  try {
    console.log('\n1. 启动同步任务，实时查询状态...');

    let stateHistory: SyncTaskState[] = [];

    const result = await sdk.usage.syncUsageRecordsWithTask({
      batchSize: 30,
      maxBatches: 4,
      onStateChange: (state) => {
        stateHistory.push({ ...state });
        if (stateHistory.length <= 3) {
          console.log(`   [${state.status}] 批次: ${state.currentBatch}, 累计: ${state.totalSynced}, 游标: ${state.lastCursor?.substring(0, 15)}...`);
        }
      }
    });

    console.log(`\n   同步完成: 任务ID=${result.taskState.taskId}`);
    console.log(`   状态: ${result.taskState.status}`);
    console.log(`   总批次: ${result.taskState.statistics.totalBatches}`);
    console.log(`   成功批次: ${result.taskState.statistics.successfulBatches}`);
    console.log(`   平均耗时: ${result.taskState.statistics.averageBatchTimeMs.toFixed(0)}ms`);
    console.log(`   总重试次数: ${result.taskState.statistics.totalRetries}`);

    console.log('\n2. 通过任务ID查询状态...');
    const queriedState = sdk.usage.getSyncTaskStatus(result.taskState.taskId);
    if (queriedState) {
      console.log(`   查询成功: 状态=${queriedState.status}, 累计=${queriedState.totalSynced}`);
    } else {
      console.log('   ❌ 查询失败');
    }

    console.log('\n3. 查询所有同步任务...');
    const allTasks = sdk.usage.getAllSyncTaskStatuses();
    console.log(`   共有 ${allTasks.length} 个同步任务`);
    allTasks.forEach((t, i) => {
      console.log(`     ${i + 1}. ${t.taskId} - ${t.status} - ${t.totalSynced}条`);
    });

    console.log('\n4. 清除任务状态...');
    const cleared = sdk.usage.clearSyncTask(result.taskState.taskId);
    console.log(`   清除成功: ${cleared}`);
    console.log(`   清除后任务数: ${sdk.usage.getAllSyncTaskStatuses().length}`);

    console.log('\n✅ 同步任务状态查询测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testChangeNoticeFiltering() {
  console.log('\n=== 变更通知筛选稳定性测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 10 });

  try {
    const productId1 = 'product-001';
    const productId2 = 'product-002';

    console.log('\n1. 按产品ID筛选变更通知...');
    const result1 = await sdk.usage.syncChangeNoticesWithTask({
      productId: productId1,
      batchSize: 10,
      maxBatches: 2,
      invalidateCache: true
    });

    const notices1 = result1.list;
    console.log(`   返回 ${notices1.length} 条通知`);

    const allMatchProduct = notices1.every((n) => n.productId === productId1);
    console.log(`   所有通知都属于 ${productId1}: ${allMatchProduct ? '✅' : '❌'}`);

    if (notices1.length > 0) {
      console.log(`   示例: [${notices1[0].level}] ${notices1[0].title} (${notices1[0].productId})`);
    }

    console.log('\n2. 按级别筛选 critical 通知...');
    const result2 = await sdk.usage.syncChangeNoticesWithTask({
      level: 'critical',
      batchSize: 10,
      maxBatches: 2
    });

    const notices2 = result2.list;
    console.log(`   返回 ${notices2.length} 条通知`);

    const allMatchLevel = notices2.every((n) => n.level === 'critical');
    console.log(`   所有通知都是 critical 级别: ${allMatchLevel ? '✅' : '❌'}`);

    if (notices2.length > 0) {
      console.log(`   示例: [${notices2[0].level}] ${notices2[0].title}`);
    }

    console.log('\n3. 按类型筛选 update 通知...');
    const result3 = await sdk.usage.syncChangeNoticesWithTask({
      type: 'update',
      batchSize: 10,
      maxBatches: 2
    });

    const notices3 = result3.list;
    console.log(`   返回 ${notices3.length} 条通知`);

    const allMatchType = notices3.every((n) => n.type === 'update');
    console.log(`   所有通知都是 update 类型: ${allMatchType ? '✅' : '❌'}`);

    if (notices3.length > 0) {
      console.log(`   示例: [${notices3[0].type}] ${notices3[0].title}`);
    }

    console.log('\n4. 组合筛选: product-002 + warning 级别...');
    const result4 = await sdk.usage.syncChangeNoticesWithTask({
      productId: productId2,
      level: 'warning',
      batchSize: 10,
      maxBatches: 2
    });

    const notices4 = result4.list;
    console.log(`   返回 ${notices4.length} 条通知`);

    const allMatchCombo = notices4.every((n) => n.productId === productId2 && n.level === 'warning');
    console.log(`   所有通知都匹配筛选条件: ${allMatchCombo ? '✅' : '❌'}`);

    console.log('\n5. 验证缓存精确失效...');

    const detail1a = await sdk.resource.getDetail(productId1);
    const detail2a = await sdk.resource.getDetail(productId2);
    console.log(`   缓存两个产品: ${productId1}, ${productId2}`);

    await sdk.usage.syncChangeNoticesWithTask({
      productId: productId1,
      batchSize: 10,
      invalidateCache: true
    });
    console.log(`   拉取 ${productId1} 通知并失效缓存`);

    const start1 = Date.now();
    const detail1b = await sdk.resource.getDetail(productId1);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const detail2b = await sdk.resource.getDetail(productId2);
    const time2 = Date.now() - start2;

    console.log(`   ${productId1} 耗时: ${time1}ms (重新请求)`);
    console.log(`   ${productId2} 耗时: ${time2}ms (命中缓存)`);

    if (time1 > 5 && time2 < 5) {
      console.log('   ✅ 缓存精确失效正确');
    }

    console.log('\n✅ 变更通知筛选稳定性测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function testMockAuthErrorScenarios() {
  console.log('\n=== Mock授权错误场景测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 10 });

  try {
    const testCases = [
      { id: 'auth-valid-001', desc: '有效授权' },
      { id: 'auth-expired-002', desc: '已过期' },
      { id: 'auth-suspended-003', desc: '已暂停' },
      { id: 'auth-calls-exhausted-004', desc: '次数用尽' },
      { id: 'auth-revoked-005', desc: '已撤销' },
      { id: 'auth-pending-006', desc: '待审核' },
      { id: 'auth-rejected-007', desc: '已拒绝' },
      { id: 'auth-cancelled-008', desc: '已取消' },
      { id: 'auth-network-error-009', desc: '网络错误' },
      { id: 'auth-timeout-010', desc: '请求超时' },
      { id: 'auth-platform-error-011', desc: '平台错误' },
      { id: 'auth-not-found-012', desc: '未找到' },
      { id: 'auth-param-error-013', desc: '参数错误' }
    ];

    console.log('\n批量检查各种授权场景...');
    const result = await sdk.authorization.batchCheckAuthorizationValid(
      testCases.map((t) => t.id),
      { concurrency: 5 }
    );

    console.log(`\n总计: ${result.total}`);
    console.log(`查询状态汇总:`);
    console.log(`  ✅ 成功: ${result.summary.success}`);
    console.log(`  🌐 网络错误: ${result.summary.networkError}`);
    console.log(`  🏢 平台错误: ${result.summary.platformError}`);
    console.log(`  📝 参数错误: ${result.summary.invalidRequest}`);
    console.log(`  ⏱️  超时: ${result.summary.timeout}`);
    console.log(`  ❓ 未知: ${result.summary.unknownError}`);

    if (result.authorizationSummary) {
      console.log(`\n授权状态汇总:`);
      console.log(`  ✅ 有效: ${result.authorizationSummary.valid}`);
      console.log(`  ⏰ 已过期: ${result.authorizationSummary.expired}`);
      console.log(`  📊 次数用尽: ${result.authorizationSummary.callsExhausted}`);
      console.log(`  ⏸️  已暂停: ${result.authorizationSummary.suspended}`);
      console.log(`  🚫 已撤销: ${result.authorizationSummary.revoked}`);
      console.log(`  📋 待审核: ${result.authorizationSummary.pending}`);
      console.log(`  ❌ 已拒绝: ${result.authorizationSummary.rejected}`);
      console.log(`  📴 已取消: ${result.authorizationSummary.cancelled}`);
    }

    console.log(`\n详细结果:`);
    result.results.forEach((item, i) => {
      const tc = testCases[i];
      if (item.status === 'success') {
        if (item.data?.valid) {
          console.log(`  ✅ ${tc.id} (${tc.desc}): 授权有效`);
        } else {
          console.log(`  ⚠️  ${tc.id} (${tc.desc}): ${item.data?.reasonMessage}`);
        }
      } else {
        console.log(`  ❌ ${tc.id} (${tc.desc}): [${item.status}] ${item.error?.message}`);
      }
    });

    const expected = {
      success: 8,
      networkError: 1,
      platformError: 1,
      invalidRequest: 1,
      timeout: 1
    };

    const match =
      result.summary.success === expected.success &&
      result.summary.networkError === expected.networkError &&
      result.summary.platformError === expected.platformError &&
      result.summary.invalidRequest === expected.invalidRequest &&
      result.summary.timeout === expected.timeout;

    console.log(`\n统计结果符合预期: ${match ? '✅' : '❌'}`);

    console.log('\n✅ Mock授权错误场景测试完成！');

  } catch (error) {
    if (isParameterError(error)) {
      console.error('参数错误:', error.message);
    } else {
      console.error('测试失败:', error);
    }
  }
}

async function testSyncRetryPolicy() {
  console.log('\n=== 同步重试策略测试 ===');

  const sdk = DataCatalogSDK.createMockSDK({}, { delay: 10 });

  try {
    console.log('\n1. 使用自定义重试策略...');
    console.log(`   默认重试策略: maxRetries=${DEFAULT_RETRY_POLICY.maxRetries}, initialDelay=${DEFAULT_RETRY_POLICY.initialDelayMs}ms`);

    const customPolicy = {
      maxRetries: 2,
      initialDelayMs: 500,
      maxDelayMs: 2000,
      backoffMultiplier: 1.5
    };

    console.log(`   自定义重试策略: maxRetries=${customPolicy.maxRetries}, initialDelay=${customPolicy.initialDelayMs}ms`);

    console.log('\n2. 同步任务带重试策略和状态回调...');

    let retryCount = 0;
    const stateTransitions: string[] = [];

    const result = await sdk.usage.syncUsageRecordsWithTask({
      batchSize: 30,
      maxBatches: 3,
      retryPolicy: customPolicy,
      onStateChange: (state) => {
        stateTransitions.push(state.status);
        if (state.status === 'retrying') {
          retryCount++;
          console.log(`   🔄 重试中: 批次=${state.currentBatch}, 重试次数=${state.lastError?.retryCount}, 原因=${state.lastError?.message.substring(0, 30)}...`);
        }
      }
    });

    console.log(`\n   状态转换: ${stateTransitions.join(' → ')}`);
    console.log(`   最终状态: ${result.taskState.status}`);
    console.log(`   总重试次数: ${result.taskState.statistics.totalRetries}`);
    console.log(`   成功批次: ${result.taskState.statistics.successfulBatches}/${result.taskState.statistics.totalBatches}`);

    console.log('\n3. 测试断点续传...');

    const partialCheckpoint: SyncCheckpoint = {
      syncType: 'usage_records',
      cursor: 'Y3Vyc29yOjYw',
      lastSyncTime: new Date().toISOString(),
      totalSynced: 60,
      batchCount: 2,
      lastBatchTime: new Date().toISOString(),
      filters: {}
    };

    console.log(`   从检查点恢复: cursor=${partialCheckpoint.cursor}, totalSynced=${partialCheckpoint.totalSynced}`);

    const resumeResult = await sdk.usage.syncUsageRecordsWithTask({
      batchSize: 30,
      maxBatches: 2,
      checkpoint: partialCheckpoint,
      retryPolicy: customPolicy
    });

    console.log(`   恢复后累计: ${resumeResult.taskState.totalSynced} 条`);
    console.log(`   恢复后批次: ${resumeResult.taskState.currentBatch} 批`);
    console.log(`   hasMore: ${resumeResult.hasMore}`);

    if (resumeResult.taskState.totalSynced > partialCheckpoint.totalSynced) {
      console.log('   ✅ 从断点成功继续同步');
    }

    console.log('\n4. 测试变更通知同步重试...');

    const noticeResult = await sdk.usage.syncChangeNoticesWithTask({
      productId: 'product-001',
      batchSize: 10,
      maxBatches: 3,
      invalidateCache: true,
      retryPolicy: { maxRetries: 1, initialDelayMs: 300 }
    });

    console.log(`   变更通知同步: ${noticeResult.taskState.totalSynced} 条, 状态=${noticeResult.taskState.status}`);
    console.log(`   受影响产品缓存已失效: ${noticeResult.list.length > 0 ? '✅' : '⚠️ '}`);

    console.log('\n✅ 同步重试策略测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

async function runAllTests() {
  await testSyncTaskStatus();
  await testChangeNoticeFiltering();
  await testMockAuthErrorScenarios();
  await testSyncRetryPolicy();

  console.log('\n=== 所有运维能力测试完成 ===');
}

if (require.main === module) {
  runAllTests();
}
