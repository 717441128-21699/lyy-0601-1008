import DataCatalogSDK, {
  Industry,
  Region,
  UpdateCycle,
  ApplyPurpose,
  AuditStatus,
  SDKError,
  ParameterMissingError,
  NoPermissionError,
  ResourceExpiredError
} from '../src';

const sdk = new DataCatalogSDK({
  baseUrl: 'https://data-catalog.example.com',
  appKey: 'your-app-key',
  appSecret: 'your-app-secret',
  timeout: 30000,
  debug: true
});

async function runExamples() {
  try {
    const health = await sdk.healthCheck();
    console.log('服务健康状态:', health);

    console.log('\n=== 1. 目录搜索 ===');
    const searchResult = await sdk.catalog.search({
      keyword: '企业信用',
      industry: [Industry.FINANCE, Industry.GOVERNMENT],
      region: Region.BEIJING,
      tags: ['信用', '企业'],
      updateCycle: UpdateCycle.DAILY,
      page: 1,
      pageSize: 10,
      sortBy: 'updateTime',
      sortOrder: 'desc'
    });
    console.log('搜索结果总数:', searchResult.total);
    console.log('搜索结果列表:', searchResult.list.map(p => ({ id: p.id, name: p.name })));
    console.log('行业统计:', searchResult.facets.industries);

    const industries = sdk.catalog.getIndustryList();
    console.log('支持的行业:', industries);

    console.log('\n=== 2. 资源详情 ===');
    if (searchResult.list.length > 0) {
      const productId = searchResult.list[0].id;

      const detail = await sdk.resource.getDetail(productId);
      console.log('产品名称:', detail.product.name);
      console.log('字段数量:', detail.fields.length);

      const fields = await sdk.resource.getFields(productId);
      const fieldMarkdown = sdk.resource.generateFieldMarkdown(fields);
      console.log('字段表格(Markdown):\n', fieldMarkdown);

      const sampleData = await sdk.resource.getSampleData(productId, 5);
      const sampleSummary = sdk.resource.generateSampleSummary(sampleData);
      console.log('样例摘要:\n', sampleSummary);

      const apiSpec = await sdk.resource.getApiSpec(productId);
      console.log('API接口数量:', apiSpec.endpoints.length);

      const pricing = await sdk.resource.getPricingInfo(productId);
      console.log('定价模式:', pricing.pricingModel);
    }

    console.log('\n=== 3. 申请提交 ===');
    const productId = 'product-001';

    const requiredMaterials = await sdk.apply.getRequiredMaterials(productId);
    console.log('所需材料:', requiredMaterials);

    const materials = [
      { name: '营业执照', type: 'pdf', required: true, description: '企业营业执照', uploaded: true, fileUrl: 'https://example.com/license.pdf' },
      { name: '使用申请函', type: 'pdf', required: true, description: '加盖公章的使用申请函', uploaded: true, fileUrl: 'https://example.com/application.pdf' }
    ];

    const validation = sdk.apply.validateMaterials(materials, requiredMaterials);
    console.log('材料校验结果:', validation);

    if (validation.valid) {
      const applyResult = await sdk.apply.submitApplication({
        productId,
        purpose: ApplyPurpose.RESEARCH,
        purposeDescription: '用于学术研究项目，分析企业信用状况与经济发展的关联关系',
        usageDuration: 365,
        usageScope: '仅用于课题研究和论文撰写，不对外提供或用于商业目的',
        expectedCallVolume: 10000,
        materials,
        contactName: '张三',
        contactPhone: '13800138000',
        contactEmail: 'zhangsan@example.com',
        organization: '某某大学',
        department: '经济管理学院'
      });
      console.log('申请提交成功:', applyResult);

      const applyList = await sdk.apply.getApplicationList({ status: AuditStatus.PENDING });
      console.log('待审核申请数量:', applyList.total);

      const applyDetail = await sdk.apply.getApplicationDetail(applyResult.applyId);
      console.log('申请详情:', {
        applyId: applyDetail.applyId,
        status: applyDetail.status,
        auditRecords: applyDetail.auditRecords.length
      });
    }

    console.log('\n=== 4. 授权状态 ===');
    const applyId = 'apply-001';

    const auditProgress = await sdk.authorization.getAuditProgress(applyId);
    console.log('审批进度:', {
      status: auditProgress.currentStatusName,
      progress: `${auditProgress.progress}%`,
      records: auditProgress.auditRecords.length
    });

    const authList = await sdk.authorization.getAuthorizationList({ status: 'active' });
    console.log('有效授权数量:', authList.total);

    if (authList.list.length > 0) {
      const authId = authList.list[0].id;

      const authScope = await sdk.authorization.getAuthorizationScope(authId);
      console.log('授权范围:', {
        callLimit: authScope.scope.callLimit,
        remainingCalls: authScope.scope.remainingCalls,
        daysRemaining: authScope.daysRemaining
      });

      const validCheck = await sdk.authorization.checkAuthorizationValid(authId);
      console.log('授权有效性:', validCheck);

      const reminders = await sdk.authorization.getExpireReminders(30);
      console.log('到期提醒数量:', reminders.length);

      const remainingDays = sdk.authorization.getRemainingDays(authScope.validTo);
      console.log('剩余天数:', remainingDays);
      console.log('是否即将到期:', sdk.authorization.isExpiringSoon(authScope.validTo, 30));
    }

    console.log('\n=== 5. 使用记录 ===');
    const authorizationId = 'auth-001';

    await sdk.usage.recordCall(
      authorizationId,
      '/api/v1/data/query',
      'success',
      150,
      { inputSize: 1024, outputSize: 2048 }
    );
    console.log('调用记录已上报');

    const usageRecords = await sdk.usage.getUsageRecords({
      authorizationId,
      page: 1,
      pageSize: 20
    });
    console.log('使用记录总数:', usageRecords.total);

    const usageStats = await sdk.usage.getUsageStats({
      authorizationId,
      groupBy: 'day'
    });
    console.log('使用统计:', {
      totalCalls: usageStats.totalCalls,
      successRate: `${usageStats.successRate.toFixed(2)}%`,
      avgResponseTime: sdk.usage.formatResponseTime(usageStats.avgResponseTime)
    });

    const notices = await sdk.usage.getChangeNotices({ unreadOnly: true });
    console.log('未读通知数量:', notices.unreadCount);

    if (notices.list.length > 0) {
      await sdk.usage.markNoticeAsRead(notices.list[0].id);
      console.log('已标记通知为已读');
    }

    const citationInfo = await sdk.usage.getCitationInfo(productId);
    console.log('引用信息(APA):', citationInfo.formats.apa);
    console.log('引用信息(GB):', citationInfo.formats.gb);

    const expireReminders = await sdk.usage.getExpireReminders(30);
    console.log('到期提醒:', expireReminders.expiring.map(r => ({
      product: r.productName,
      days: r.daysRemaining,
      urgency: r.urgency
    })));

  } catch (error) {
    if (error instanceof ParameterMissingError) {
      console.error('参数缺失:', error.message, '参数名:', error.code);
    } else if (error instanceof NoPermissionError) {
      console.error('无权限访问:', error.message);
    } else if (error instanceof ResourceExpiredError) {
      console.error('资源已过期:', error.message);
    } else if (error instanceof SDKError) {
      console.error('SDK错误:', {
        code: error.code,
        message: error.message,
        traceId: error.traceId
      });
    } else {
      console.error('未知错误:', error);
    }
  }
}

runExamples();
