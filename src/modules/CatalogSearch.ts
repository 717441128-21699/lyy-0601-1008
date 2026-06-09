import { HttpClient } from '../client/HttpClient';
import {
  SearchParams,
  SearchResult,
  DataProduct,
  Industry,
  Region,
  UpdateCycle
} from '../types';
import {
  validateRequiredParams,
  validateParamEnum,
  validateParamRange,
  ParameterInvalidError
} from '../errors';

export class CatalogSearch {
  private readonly client: HttpClient;
  private readonly industryNames: Record<Industry, string> = {
    [Industry.FINANCE]: '金融',
    [Industry.HEALTHCARE]: '医疗健康',
    [Industry.EDUCATION]: '教育',
    [Industry.TRANSPORTATION]: '交通运输',
    [Industry.ENERGY]: '能源',
    [Industry.RETAIL]: '零售',
    [Industry.MANUFACTURING]: '制造业',
    [Industry.AGRICULTURE]: '农业',
    [Industry.GOVERNMENT]: '政务',
    [Industry.OTHER]: '其他'
  };

  private readonly regionNames: Record<Region, string> = {
    [Region.BEIJING]: '北京',
    [Region.SHANGHAI]: '上海',
    [Region.GUANGDONG]: '广东',
    [Region.ZHEJIANG]: '浙江',
    [Region.JIANGSU]: '江苏',
    [Region.SICHUAN]: '四川',
    [Region.HUBEI]: '湖北',
    [Region.HUNAN]: '湖南',
    [Region.SHANDONG]: '山东',
    [Region.NATIONAL]: '全国',
    [Region.OTHER]: '其他'
  };

  private readonly updateCycleNames: Record<UpdateCycle, string> = {
    [UpdateCycle.REAL_TIME]: '实时',
    [UpdateCycle.DAILY]: '每日',
    [UpdateCycle.WEEKLY]: '每周',
    [UpdateCycle.MONTHLY]: '每月',
    [UpdateCycle.QUARTERLY]: '每季度',
    [UpdateCycle.YEARLY]: '每年',
    [UpdateCycle.IRREGULAR]: '不定期'
  };

  constructor(client: HttpClient) {
    this.client = client;
  }

  public async search(params: SearchParams = {}): Promise<SearchResult> {
    const validatedParams = this.validateSearchParams(params);

    const queryParams: Record<string, unknown> = {};

    if (validatedParams.keyword) {
      queryParams.keyword = validatedParams.keyword;
    }
    if (validatedParams.industry) {
      queryParams.industry = Array.isArray(validatedParams.industry)
        ? validatedParams.industry.join(',')
        : validatedParams.industry;
    }
    if (validatedParams.region) {
      queryParams.region = Array.isArray(validatedParams.region)
        ? validatedParams.region.join(',')
        : validatedParams.region;
    }
    if (validatedParams.tags && validatedParams.tags.length > 0) {
      queryParams.tags = validatedParams.tags.join(',');
    }
    if (validatedParams.updateCycle) {
      queryParams.updateCycle = Array.isArray(validatedParams.updateCycle)
        ? validatedParams.updateCycle.join(',')
        : validatedParams.updateCycle;
    }
    if (validatedParams.category) {
      queryParams.category = validatedParams.category;
    }
    if (validatedParams.priceMin !== undefined) {
      queryParams.priceMin = validatedParams.priceMin;
    }
    if (validatedParams.priceMax !== undefined) {
      queryParams.priceMax = validatedParams.priceMax;
    }
    if (validatedParams.page !== undefined) {
      queryParams.page = validatedParams.page;
    }
    if (validatedParams.pageSize !== undefined) {
      queryParams.pageSize = validatedParams.pageSize;
    }
    if (validatedParams.sortBy) {
      queryParams.sortBy = validatedParams.sortBy;
    }
    if (validatedParams.sortOrder) {
      queryParams.sortOrder = validatedParams.sortOrder;
    }

    const result = await this.client.get<SearchResult>('/api/v1/catalog/search', queryParams);

    return this.enrichSearchResult(result);
  }

  public async getProductDetail(productId: string): Promise<DataProduct> {
    validateRequiredParams({ productId }, ['productId']);

    const result = await this.client.get<DataProduct>(`/api/v1/catalog/products/${productId}`);

    return result;
  }

  public async getHotProducts(limit: number = 10): Promise<DataProduct[]> {
    validateParamRange('limit', limit, 1, 100);

    const result = await this.client.get<DataProduct[]>('/api/v1/catalog/hot', { limit });

    return result;
  }

  public async getNewProducts(limit: number = 10): Promise<DataProduct[]> {
    validateParamRange('limit', limit, 1, 100);

    const result = await this.client.get<DataProduct[]>('/api/v1/catalog/new', { limit });

    return result;
  }

  public async getRecommendations(userId?: string, limit: number = 10): Promise<DataProduct[]> {
    validateParamRange('limit', limit, 1, 100);

    const params: Record<string, unknown> = { limit };
    if (userId) {
      params.userId = userId;
    }

    const result = await this.client.get<DataProduct[]>('/api/v1/catalog/recommendations', params);

    return result;
  }

  public getIndustryName(code: Industry): string {
    return this.industryNames[code] || code;
  }

  public getRegionName(code: Region): string {
    return this.regionNames[code] || code;
  }

  public getUpdateCycleName(code: UpdateCycle): string {
    return this.updateCycleNames[code] || code;
  }

  public getIndustryList(): Array<{ code: Industry; name: string }> {
    return Object.entries(this.industryNames).map(([code, name]) => ({
      code: code as Industry,
      name
    }));
  }

  public getRegionList(): Array<{ code: Region; name: string }> {
    return Object.entries(this.regionNames).map(([code, name]) => ({
      code: code as Region,
      name
    }));
  }

  public getUpdateCycleList(): Array<{ code: UpdateCycle; name: string }> {
    return Object.entries(this.updateCycleNames).map(([code, name]) => ({
      code: code as UpdateCycle,
      name
    }));
  }

  private validateSearchParams(params: SearchParams): SearchParams {
    const validated = { ...params };

    if (validated.page !== undefined) {
      validateParamRange('page', validated.page, 1, 10000);
    }

    if (validated.pageSize !== undefined) {
      validateParamRange('pageSize', validated.pageSize, 1, 100);
    }

    if (validated.priceMin !== undefined && validated.priceMin < 0) {
      throw new ParameterInvalidError('priceMin', '价格最小值不能为负数');
    }

    if (validated.priceMax !== undefined && validated.priceMax < 0) {
      throw new ParameterInvalidError('priceMax', '价格最大值不能为负数');
    }

    if (
      validated.priceMin !== undefined &&
      validated.priceMax !== undefined &&
      validated.priceMin > validated.priceMax
    ) {
      throw new ParameterInvalidError('priceMin', '价格最小值不能大于最大值');
    }

    if (validated.sortBy) {
      validateParamEnum('sortBy', validated.sortBy, [
        'relevance',
        'updateTime',
        'viewCount',
        'applyCount',
        'rating',
        'price'
      ]);
    }

    if (validated.sortOrder) {
      validateParamEnum('sortOrder', validated.sortOrder, ['asc', 'desc']);
    }

    if (validated.keyword && validated.keyword.length > 100) {
      throw new ParameterInvalidError('keyword', '关键词长度不能超过100个字符');
    }

    return validated;
  }

  private enrichSearchResult(result: SearchResult): SearchResult {
    if (!result.facets) {
      return result;
    }

    return {
      ...result,
      facets: {
        ...result.facets,
        industries: result.facets.industries.map((item) => ({
          ...item,
          name: this.getIndustryName(item.code)
        })),
        regions: result.facets.regions.map((item) => ({
          ...item,
          name: this.getRegionName(item.code)
        })),
        updateCycles: result.facets.updateCycles.map((item) => ({
          ...item,
          name: this.getUpdateCycleName(item.code)
        }))
      }
    };
  }
}
